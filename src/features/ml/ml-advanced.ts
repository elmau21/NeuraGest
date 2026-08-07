import type { MetricSnapshot, StreamEvent } from '@/services/metrics'
import type { TalentCluster } from './ml-utils'

/* ── Descomposición tendencia + estacionalidad semanal ── */

export type DecompositionPoint = {
  at: string
  viewers: number
  trend: number
  seasonal: number
  residual: number
}

export function decomposeWeeklySeries(
  snapshots: MetricSnapshot[],
  login: string,
): DecompositionPoint[] {
  const rows = snapshots
    .filter((r) => r.login === login && r.viewers > 0)
    .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime())

  if (rows.length < 7) return []

  const trendWindow = Math.min(7, Math.max(3, Math.floor(rows.length / 5)))
  const seasonalByDow = new Map<number, number[]>()

  for (const row of rows) {
    const dow = new Date(row.capturedAt).getDay()
    const bucket = seasonalByDow.get(dow) ?? []
    bucket.push(row.viewers)
    seasonalByDow.set(dow, bucket)
  }

  const globalMean = rows.reduce((s, r) => s + r.viewers, 0) / rows.length
  const seasonalFactors = new Map<number, number>()
  for (const [dow, vals] of seasonalByDow) {
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length
    seasonalFactors.set(dow, mean - globalMean)
  }

  return rows.map((row, index) => {
    const start = Math.max(0, index - trendWindow + 1)
    const window = rows.slice(start, index + 1)
    const trend = window.reduce((s, r) => s + r.viewers, 0) / window.length
    const dow = new Date(row.capturedAt).getDay()
    const seasonal = seasonalFactors.get(dow) ?? 0
    const residual = row.viewers - trend - seasonal

    return {
      at: new Date(row.capturedAt).toLocaleString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit' }),
      viewers: row.viewers,
      trend: Math.round(trend),
      seasonal: Math.round(seasonal),
      residual: Math.round(residual),
    }
  })
}

/* ── Días hasta próximo stream (survival/heurística) ── */

export type StreamSurvivalEstimate = {
  login: string
  displayName: string
  daysSinceLastStream: number
  medianGapDays: number
  estimatedDaysUntil: number
  confidence: 'baja' | 'media' | 'alta'
  lastStreamAt?: string
}

function median(values: number[]): number {
  if (values.length === 0) return 7
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

export function estimateDaysUntilNextStream(
  snapshots: MetricSnapshot[],
  events: StreamEvent[],
  displayNames: Record<string, string>,
): StreamSurvivalEstimate[] {
  const logins = [...new Set(snapshots.map((r) => r.login))]
  const now = Date.now()

  return logins.map((login) => {
    const onlineEvents = events
      .filter((e) => e.login === login && e.eventType === 'stream.online')
      .map((e) => new Date(e.occurredAt).getTime())
      .sort((a, b) => a - b)

    const liveRows = snapshots.filter((r) => r.login === login && r.isLive)
    const lastLiveTs = liveRows.length
      ? new Date(liveRows[liveRows.length - 1].capturedAt).getTime()
      : onlineEvents[onlineEvents.length - 1]

    const gaps: number[] = []
    for (let i = 1; i < onlineEvents.length; i += 1) {
      gaps.push((onlineEvents[i] - onlineEvents[i - 1]) / 86_400_000)
    }

    if (gaps.length === 0 && liveRows.length >= 2) {
      const days = new Set(liveRows.map((r) => new Date(r.capturedAt).toISOString().slice(0, 10)))
      if (days.size >= 2) gaps.push(days.size)
    }

    const medianGap = Math.max(1, Math.round(median(gaps.length ? gaps : [3, 5, 7])))
    const daysSince = lastLiveTs
      ? Math.floor((now - lastLiveTs) / 86_400_000)
      : 999
    const estimatedDaysUntil = Math.max(0, medianGap - daysSince)
    const confidence: StreamSurvivalEstimate['confidence'] =
      gaps.length >= 5 ? 'alta' : gaps.length >= 2 ? 'media' : 'baja'

    return {
      login,
      displayName: displayNames[login] ?? login,
      daysSinceLastStream: daysSince === 999 ? -1 : daysSince,
      medianGapDays: medianGap,
      estimatedDaysUntil,
      confidence,
      lastStreamAt: lastLiveTs ? new Date(lastLiveTs).toISOString() : undefined,
    }
  }).sort((a, b) => a.estimatedDaysUntil - b.estimatedDaysUntil)
}

/* ── Recomendador collabs por similitud de clusters ── */

export type CollabRecommendation = {
  loginA: string
  loginB: string
  displayNameA: string
  displayNameB: string
  similarity: number
  clusterA: string
  clusterB: string
  reason: string
}

function clusterFeatureVector(cluster: TalentCluster, login: string): number[] {
  const idx = cluster.logins.indexOf(login)
  const spread = cluster.logins.length || 1
  return [
    cluster.centroid.avgViewers / 1000,
    cluster.centroid.liveRate,
    cluster.centroid.streamDays / 7,
    idx >= 0 ? idx / spread : 0.5,
  ]
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0)
  const normA = Math.sqrt(a.reduce((s, v) => s + v ** 2, 0)) || 1
  const normB = Math.sqrt(b.reduce((s, v) => s + v ** 2, 0)) || 1
  return dot / (normA * normB)
}

export function recommendCollabs(
  clusters: TalentCluster[],
  displayNames: Record<string, string>,
  topN = 10,
): CollabRecommendation[] {
  const recommendations: CollabRecommendation[] = []
  const allLogins = [...new Set(clusters.flatMap((c) => c.logins))]

  for (let i = 0; i < allLogins.length; i += 1) {
    for (let j = i + 1; j < allLogins.length; j += 1) {
      const loginA = allLogins[i]
      const loginB = allLogins[j]
      const clusterA = clusters.find((c) => c.logins.includes(loginA))
      const clusterB = clusters.find((c) => c.logins.includes(loginB))
      if (!clusterA || !clusterB) continue

      const vecA = clusterFeatureVector(clusterA, loginA)
      const vecB = clusterFeatureVector(clusterB, loginB)
      const similarity = cosineSimilarity(vecA, vecB)

      if (similarity < 0.55) continue
      const crossCluster = clusterA.clusterId !== clusterB.clusterId

      recommendations.push({
        loginA,
        loginB,
        displayNameA: displayNames[loginA] ?? loginA,
        displayNameB: displayNames[loginB] ?? loginB,
        similarity: Math.round(similarity * 100) / 100,
        clusterA: clusterA.label,
        clusterB: clusterB.label,
        reason: crossCluster
          ? 'Perfiles complementarios entre clusters distintos'
          : 'Alta afinidad de métricas en el mismo cluster',
      })
    }
  }

  return recommendations
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topN)
}

/* ── Detección cambio de régimen (CUSUM) ── */

export type RegimeChange = {
  login: string
  displayName: string
  capturedAt: string
  viewers: number
  cusum: number
  direction: 'up' | 'down'
  severity: 'moderate' | 'high'
}

export function detectRegimeChanges(
  snapshots: MetricSnapshot[],
  displayNames: Record<string, string>,
  threshold = 5,
): RegimeChange[] {
  const changes: RegimeChange[] = []
  const logins = [...new Set(snapshots.map((r) => r.login))]

  for (const login of logins) {
    const live = snapshots
      .filter((r) => r.login === login && r.isLive)
      .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime())

    if (live.length < 8) continue

    const values = live.map((r) => r.viewers)
    const mean = values.reduce((s, v) => s + v, 0) / values.length
    const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length) || 1

    let cusumPos = 0
    let cusumNeg = 0
    const k = 0.5 * std
    const h = threshold * std

    for (const row of live) {
      const x = row.viewers - mean
      cusumPos = Math.max(0, cusumPos + x - k)
      cusumNeg = Math.min(0, cusumNeg + x + k)

      if (cusumPos > h) {
        changes.push({
          login,
          displayName: displayNames[login] ?? login,
          capturedAt: row.capturedAt,
          viewers: row.viewers,
          cusum: Math.round(cusumPos),
          direction: 'up',
          severity: cusumPos > h * 1.5 ? 'high' : 'moderate',
        })
        cusumPos = 0
      } else if (cusumNeg < -h) {
        changes.push({
          login,
          displayName: displayNames[login] ?? login,
          capturedAt: row.capturedAt,
          viewers: row.viewers,
          cusum: Math.round(cusumNeg),
          direction: 'down',
          severity: cusumNeg < -h * 1.5 ? 'high' : 'moderate',
        })
        cusumNeg = 0
      }
    }
  }

  return changes.sort(
    (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
  ).slice(0, 30)
}

/* ── A/B horarios desde heatmap ── */

export type ScheduleAbVariant = {
  label: string
  day: number
  hour: number
  avgViewers: number
  samples: number
  intensity: number
}

export type ScheduleAbTest = {
  login: string
  displayName: string
  variantA: ScheduleAbVariant
  variantB: ScheduleAbVariant
  winner: 'A' | 'B' | 'empate'
  upliftPct: number
}

export function buildScheduleAbTests(
  snapshots: MetricSnapshot[],
  displayNames: Record<string, string>,
): ScheduleAbTest[] {
  const logins = [...new Set(snapshots.map((r) => r.login))]
  const tests: ScheduleAbTest[] = []

  for (const login of logins) {
    const rows = snapshots.filter((r) => r.login === login && r.isLive)
    if (rows.length < 6) continue

    const grid = new Map<string, { viewers: number[]; count: number }>()
    for (const row of rows) {
      const date = new Date(row.capturedAt)
      const jsDay = date.getDay()
      const day = jsDay === 0 ? 6 : jsDay - 1
      const hour = date.getHours()
      const key = `${day}-${hour}`
      const cell = grid.get(key) ?? { viewers: [], count: 0 }
      cell.viewers.push(row.viewers)
      cell.count += 1
      grid.set(key, cell)
    }

    const ranked = [...grid.entries()]
      .filter(([, cell]) => cell.count >= 2)
      .map(([key, cell]) => {
        const [dayStr, hourStr] = key.split('-')
        const avgViewers = cell.viewers.reduce((s, v) => s + v, 0) / cell.viewers.length
        return {
          day: Number(dayStr),
          hour: Number(hourStr),
          avgViewers,
          samples: cell.count,
          intensity: Math.round((cell.count / rows.length) * 100),
        }
      })
      .sort((a, b) => b.avgViewers - a.avgViewers)

    if (ranked.length < 2) continue

    const best = ranked[0]
    const worst = ranked[ranked.length - 1]
    const uplift = worst.avgViewers > 0
      ? ((best.avgViewers - worst.avgViewers) / worst.avgViewers) * 100
      : 0

    tests.push({
      login,
      displayName: displayNames[login] ?? login,
      variantA: {
        label: `Mejor franja (${best.hour}:00)`,
        day: best.day,
        hour: best.hour,
        avgViewers: Math.round(best.avgViewers),
        samples: best.samples,
        intensity: best.intensity,
      },
      variantB: {
        label: `Peor franja (${worst.hour}:00)`,
        day: worst.day,
        hour: worst.hour,
        avgViewers: Math.round(worst.avgViewers),
        samples: worst.samples,
        intensity: worst.intensity,
      },
      winner: Math.abs(uplift) < 5 ? 'empate' : 'A',
      upliftPct: Math.round(uplift),
    })
  }

  return tests.sort((a, b) => b.upliftPct - a.upliftPct)
}

/* ── Explicabilidad por predicción ── */

export type FeatureImportance = {
  feature: string
  weight: number
  contribution: number
}

export function computeFeatureImportance(
  w1: number[][],
  featureNames: string[],
): FeatureImportance[] {
  const importances = featureNames.map((feature, i) => {
    const row = w1[i] ?? []
    const weight = row.reduce((s, v) => s + Math.abs(v), 0)
    return { feature, weight, contribution: 0 }
  })
  const total = importances.reduce((s, f) => s + f.weight, 0) || 1
  return importances
    .map((f) => ({ ...f, contribution: Math.round((f.weight / total) * 100) }))
    .sort((a, b) => b.contribution - a.contribution)
}

export const RICH_FEATURE_NAMES = [
  'trend',
  'viewers t-1',
  'viewers t-2',
  'viewers t-3',
  'hora',
  'día semana',
  'categoría',
]

export function categoryHash(category?: string): number {
  if (!category) return 0
  let hash = 0
  for (let i = 0; i < category.length; i += 1) {
    hash = (hash * 31 + category.charCodeAt(i)) % 997
  }
  return hash / 997
}
