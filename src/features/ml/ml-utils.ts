import type { MetricSnapshot, StreamEvent } from '@/services/metrics'
import type { PipelineItem } from '@/services/agency'
import { dayLabel } from '@/features/twitch-intelligence/twitch-intelligence-utils'

/* ── Tipos ── */

export type AnomalyPoint = {
  login: string
  displayName: string
  capturedAt: string
  viewers: number
  zScore: number
  severity: 'moderate' | 'high'
  direction: 'spike' | 'drop'
}

export type TalentCluster = {
  clusterId: number
  label: string
  logins: string[]
  centroid: { avgViewers: number; liveRate: number; streamDays: number }
}

export type InactivityRisk = {
  login: string
  displayName: string
  riskScore: number
  riskLevel: 'bajo' | 'medio' | 'alto' | 'crítico'
  daysSinceStream: number
  avgViewersTrend: number
  factors: string[]
}

export type CategoryInsight = {
  login: string
  displayName: string
  typicalCategory: string
  currentCategory: string
  typicalShare: number
  isAtypical: boolean
  deviation: number
}

export type OptimalSlot = {
  login: string
  displayName: string
  day: number
  hour: number
  intensity: number
  avgViewers: number
  label: string
}

export type EnhancedHighlight = PipelineItem & {
  score: number
  scoreBreakdown: string
  mlBoost: number
}

export type TalentFeatures = {
  login: string
  avgViewers: number
  peakViewers: number
  liveRate: number
  streamDays: number
  categoryDiversity: number
  avgHour: number
}

export type ModelExplanation = {
  model: string
  description: string
  inputs: string[]
  output: string
  algorithm: string
  dataPoints: number
  lastRun?: string
}

/* ── Z-Score Anomalías ── */

export function detectAnomalies(
  snapshots: MetricSnapshot[],
  displayNames: Record<string, string>,
  threshold = 2,
): AnomalyPoint[] {
  const anomalies: AnomalyPoint[] = []
  const logins = [...new Set(snapshots.map((r) => r.login))]

  for (const login of logins) {
    const live = snapshots.filter((r) => r.login === login && r.isLive)
    if (live.length < 5) continue

    const values = live.map((r) => r.viewers)
    const mean = values.reduce((s, v) => s + v, 0) / values.length
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
    const std = Math.sqrt(variance) || 1

    for (const row of live) {
      const z = (row.viewers - mean) / std
      if (Math.abs(z) >= threshold) {
        anomalies.push({
          login,
          displayName: displayNames[login] ?? login,
          capturedAt: row.capturedAt,
          viewers: row.viewers,
          zScore: Math.round(z * 100) / 100,
          severity: Math.abs(z) >= 3 ? 'high' : 'moderate',
          direction: z > 0 ? 'spike' : 'drop',
        })
      }
    }
  }

  return anomalies.sort(
    (a, b) => Math.abs(b.zScore) - Math.abs(a.zScore),
  ).slice(0, 50)
}

/* ── K-Means Clustering ── */

function extractFeatures(
  snapshots: MetricSnapshot[],
): TalentFeatures[] {
  const logins = [...new Set(snapshots.map((r) => r.login))]
  return logins.map((login) => {
    const rows = snapshots.filter((r) => r.login === login)
    const live = rows.filter((r) => r.isLive)
    const viewers = live.map((r) => r.viewers)
    const avgViewers = viewers.length ? viewers.reduce((s, v) => s + v, 0) / viewers.length : 0
    const peakViewers = viewers.length ? Math.max(...viewers) : 0
    const liveRate = rows.length ? live.length / rows.length : 0
    const days = new Set(live.map((r) => new Date(r.capturedAt).toISOString().slice(0, 10)))
    const categories = new Set(live.map((r) => r.category).filter(Boolean))
    const hours = live.map((r) => new Date(r.capturedAt).getHours())
    const avgHour = hours.length ? hours.reduce((s, h) => s + h, 0) / hours.length : 12

    return {
      login,
      avgViewers,
      peakViewers,
      liveRate,
      streamDays: days.size,
      categoryDiversity: categories.size,
      avgHour,
    }
  }).filter((f) => f.avgViewers > 0 || f.liveRate > 0)
}

function euclidean(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0))
}

function normalizeFeatures(features: TalentFeatures[]): number[][] {
  const keys: (keyof TalentFeatures)[] = ['avgViewers', 'peakViewers', 'liveRate', 'streamDays', 'categoryDiversity', 'avgHour']
  const mins = keys.map((k) => Math.min(...features.map((f) => f[k] as number)))
  const maxs = keys.map((k) => Math.max(...features.map((f) => f[k] as number)))

  return features.map((f) =>
    keys.map((k, i) => {
      const range = maxs[i] - mins[i] || 1
      return ((f[k] as number) - mins[i]) / range
    }),
  )
}

const CLUSTER_LABELS = ['Emergentes', 'Estables', 'Top performers', 'Irregulares']

export function kMeansCluster(
  snapshots: MetricSnapshot[],
  _displayNames: Record<string, string>,
  k = 4,
  maxIter = 50,
): TalentCluster[] {
  const features = extractFeatures(snapshots)
  if (features.length < k) {
    return [{
      clusterId: 0,
      label: 'Sin suficientes datos',
      logins: features.map((f) => f.login),
      centroid: { avgViewers: 0, liveRate: 0, streamDays: 0 },
    }]
  }

  const normalized = normalizeFeatures(features)
  const actualK = Math.min(k, features.length)

  let centroids = normalized.slice(0, actualK).map((v) => [...v])
  let assignments = new Array(features.length).fill(0)

  for (let iter = 0; iter < maxIter; iter += 1) {
    let changed = false
    for (let i = 0; i < normalized.length; i += 1) {
      let bestDist = Infinity
      let bestCluster = 0
      for (let c = 0; c < actualK; c += 1) {
        const dist = euclidean(normalized[i], centroids[c])
        if (dist < bestDist) {
          bestDist = dist
          bestCluster = c
        }
      }
      if (assignments[i] !== bestCluster) {
        assignments[i] = bestCluster
        changed = true
      }
    }
    if (!changed) break

    for (let c = 0; c < actualK; c += 1) {
      const members = normalized.filter((_, i) => assignments[i] === c)
      if (members.length === 0) continue
      for (let d = 0; d < members[0].length; d += 1) {
        centroids[c][d] = members.reduce((s, m) => s + m[d], 0) / members.length
      }
    }
  }

  const clusters: TalentCluster[] = []
  for (let c = 0; c < actualK; c += 1) {
    const memberIdx = assignments.map((a, i) => (a === c ? i : -1)).filter((i) => i >= 0)
    const memberFeatures = memberIdx.map((i) => features[i])
    const avgViewers = memberFeatures.length
      ? memberFeatures.reduce((s, f) => s + f.avgViewers, 0) / memberFeatures.length
      : 0
    const liveRate = memberFeatures.length
      ? memberFeatures.reduce((s, f) => s + f.liveRate, 0) / memberFeatures.length
      : 0
    const streamDays = memberFeatures.length
      ? memberFeatures.reduce((s, f) => s + f.streamDays, 0) / memberFeatures.length
      : 0

    clusters.push({
      clusterId: c,
      label: CLUSTER_LABELS[c] ?? `Grupo ${c + 1}`,
      logins: memberIdx.map((i) => features[i].login),
      centroid: {
        avgViewers: Math.round(avgViewers),
        liveRate: Math.round(liveRate * 100) / 100,
        streamDays: Math.round(streamDays),
      },
    })
  }

  return clusters.sort((a, b) => b.centroid.avgViewers - a.centroid.avgViewers)
}

/* ── Riesgo de Inactividad ── */

export function computeInactivityRisk(
  snapshots: MetricSnapshot[],
  events: StreamEvent[],
  displayNames: Record<string, string>,
): InactivityRisk[] {
  const now = Date.now()
  const logins = [...new Set(snapshots.map((r) => r.login))]
  const risks: InactivityRisk[] = []

  for (const login of logins) {
    const factors: string[] = []
    let riskScore = 0

    const loginEvents = events.filter((e) => e.login === login)
    const lastOnline = loginEvents.find((e) => e.eventType === 'stream.online')
    const rows = snapshots.filter((r) => r.login === login)
    const lastLive = [...rows].reverse().find((r) => r.isLive)
    const lastActivity = lastOnline?.occurredAt ?? lastLive?.capturedAt
    const daysSince = lastActivity
      ? Math.floor((now - new Date(lastActivity).getTime()) / 86_400_000)
      : 999

    if (daysSince >= 7) {
      riskScore += 40
      factors.push(`${daysSince} días sin stream (+40)`)
    } else if (daysSince >= 3) {
      riskScore += 25
      factors.push(`${daysSince} días sin stream (+25)`)
    } else if (daysSince >= 1) {
      riskScore += 10
      factors.push(`${daysSince} día(s) sin stream (+10)`)
    }

    const live = rows.filter((r) => r.isLive)
    if (live.length >= 6) {
      const mid = Math.floor(live.length / 2)
      const firstHalf = live.slice(0, mid)
      const secondHalf = live.slice(mid)
      const avgFirst = firstHalf.reduce((s, r) => s + r.viewers, 0) / firstHalf.length
      const avgSecond = secondHalf.reduce((s, r) => s + r.viewers, 0) / secondHalf.length
      const trend = avgFirst > 0 ? ((avgSecond - avgFirst) / avgFirst) * 100 : 0

      if (trend < -20) {
        riskScore += 25
        factors.push(`Tendencia viewers ${trend.toFixed(0)}% (+25)`)
      } else if (trend < -10) {
        riskScore += 15
        factors.push(`Tendencia viewers ${trend.toFixed(0)}% (+15)`)
      }

      const streamDays = new Set(live.map((r) => new Date(r.capturedAt).toISOString().slice(0, 10))).size
      if (streamDays <= 1 && live.length >= 10) {
        riskScore += 15
        factors.push('Baja frecuencia de streams (+15)')
      }

      risks.push({
        login,
        displayName: displayNames[login] ?? login,
        riskScore: Math.min(100, riskScore),
        riskLevel: riskScore >= 60 ? 'crítico' : riskScore >= 40 ? 'alto' : riskScore >= 20 ? 'medio' : 'bajo',
        daysSinceStream: daysSince === 999 ? -1 : daysSince,
        avgViewersTrend: Math.round(trend),
        factors,
      })
    } else if (daysSince >= 2) {
      risks.push({
        login,
        displayName: displayNames[login] ?? login,
        riskScore: Math.min(100, riskScore + 20),
        riskLevel: 'medio',
        daysSinceStream: daysSince === 999 ? -1 : daysSince,
        avgViewersTrend: 0,
        factors: [...factors, 'Datos insuficientes (+20)'],
      })
    }
  }

  return risks.sort((a, b) => b.riskScore - a.riskScore)
}

/* ── Categoría Típica vs Actual ── */

export function analyzeCategoryTypical(
  snapshots: MetricSnapshot[],
  displayNames: Record<string, string>,
  currentCategories: Record<string, string>,
): CategoryInsight[] {
  const logins = [...new Set(snapshots.map((r) => r.login))]

  return logins.map((login) => {
    const live = snapshots.filter((r) => r.login === login && r.isLive)
    const cats = live.map((r) => r.category?.trim()).filter((c): c is string => Boolean(c && c !== 'Offline'))
    const counts = new Map<string, number>()
    for (const cat of cats) counts.set(cat, (counts.get(cat) ?? 0) + 1)
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
    const typical = sorted[0]?.[0] ?? 'Sin datos'
    const typicalShare = cats.length ? (sorted[0]?.[1] ?? 0) / cats.length : 0
    const current = currentCategories[login] ?? cats[cats.length - 1] ?? 'Offline'
    const isAtypical = typicalShare >= 0.4 && current !== 'Offline' && current !== typical
    const currentCount = counts.get(current) ?? 0
    const deviation = cats.length ? 1 - currentCount / cats.length : 1

    return {
      login,
      displayName: displayNames[login] ?? login,
      typicalCategory: typical,
      currentCategory: current,
      typicalShare: Math.round(typicalShare * 100),
      isAtypical,
      deviation: Math.round(deviation * 100),
    }
  }).sort((a, b) => Number(b.isAtypical) - Number(a.isAtypical) || b.deviation - a.deviation)
}

/* ── Horario Óptimo ── */

export function findOptimalSchedule(
  snapshots: MetricSnapshot[],
  displayNames: Record<string, string>,
  topN = 3,
): OptimalSlot[] {
  const logins = [...new Set(snapshots.map((r) => r.login))]
  const slots: OptimalSlot[] = []

  for (const login of logins) {
    const rows = snapshots.filter((r) => r.login === login && r.isLive)
    if (rows.length < 3) continue

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
      .map(([key, cell]) => {
        const [dayStr, hourStr] = key.split('-')
        const avgViewers = cell.viewers.reduce((s, v) => s + v, 0) / cell.viewers.length
        return {
          day: Number(dayStr),
          hour: Number(hourStr),
          intensity: Math.round((cell.count / rows.length) * 100),
          avgViewers: Math.round(avgViewers),
        }
      })
      .sort((a, b) => b.avgViewers - a.avgViewers)
      .slice(0, topN)

    for (const slot of ranked) {
      slots.push({
        login,
        displayName: displayNames[login] ?? login,
        ...slot,
        label: `${dayLabel(slot.day)} ${String(slot.hour).padStart(2, '0')}:00`,
      })
    }
  }

  return slots.sort((a, b) => b.avgViewers - a.avgViewers)
}

/* ── Score Highlight Mejorado ── */

export function scoreHighlightEnhanced(
  item: PipelineItem,
  snapshots: MetricSnapshot[],
  events: StreamEvent[],
  anomalies: AnomalyPoint[],
  clusters: TalentCluster[],
): EnhancedHighlight {
  let score = 35
  const parts: string[] = ['Base ML 35']
  let mlBoost = 0

  if (item.contentType === 'highlight') { score += 15; parts.push('+15 highlight') }
  else if (item.contentType === 'clip') { score += 12; parts.push('+12 clip') }
  else if (item.contentType === 'vod') { score += 8; parts.push('+8 VOD') }

  if (item.status === 'editing') { score += 12; parts.push('+12 editando') }
  else if (item.status === 'idea') { score += 5; parts.push('+5 en cola') }

  const login = item.talentLogin?.toLowerCase()
  if (login) {
    const liveRows = snapshots.filter((r) => r.login.toLowerCase() === login && r.isLive)
    const peak = liveRows.reduce((max, r) => Math.max(max, r.viewers), 0)
    if (peak >= 100) { score += 18; parts.push('+18 pico ≥100') }
    else if (peak >= 50) { score += 12; parts.push('+12 pico ≥50') }
    else if (peak >= 20) { score += 6; parts.push('+6 pico ≥20') }

    const talentAnomalies = anomalies.filter(
      (a) => a.login.toLowerCase() === login && a.direction === 'spike',
    )
    if (talentAnomalies.length > 0) {
      mlBoost += 12
      score += 12
      parts.push('+12 pico anómalo detectado')
    }

    const topCluster = clusters.find((c) => c.label === 'Top performers')
    if (topCluster?.logins.some((l) => l.toLowerCase() === login)) {
      mlBoost += 8
      score += 8
      parts.push('+8 cluster top performer')
    }

    const recentOffline = events.find(
      (e) => e.login.toLowerCase() === login && e.eventType === 'stream.offline',
    )
    if (recentOffline) {
      const hoursAgo = (Date.now() - new Date(recentOffline.occurredAt).getTime()) / 3_600_000
      if (hoursAgo <= 24) { score += 15; parts.push('+15 post-stream <24h') }
      else if (hoursAgo <= 72) { score += 8; parts.push('+8 post-stream <72h') }
    }
  }

  const ageDays = (Date.now() - new Date(item.createdAt).getTime()) / 86_400_000
  if (ageDays <= 2) { score += 8; parts.push('+8 reciente') }
  else if (ageDays >= 14) { score -= 10; parts.push('−10 antiguo') }

  return {
    ...item,
    score: Math.max(0, Math.min(100, score)),
    scoreBreakdown: parts.join(' · '),
    mlBoost,
  }
}

export function buildEnhancedHighlights(
  items: PipelineItem[],
  snapshots: MetricSnapshot[],
  events: StreamEvent[],
  anomalies: AnomalyPoint[],
  clusters: TalentCluster[],
): EnhancedHighlight[] {
  return items
    .filter((i) => i.contentType === 'highlight' || i.contentType === 'clip' || i.contentType === 'vod')
    .map((i) => scoreHighlightEnhanced(i, snapshots, events, anomalies, clusters))
    .sort((a, b) => b.score - a.score)
}

/* ── Explicabilidad ── */

export function buildModelExplanations(
  snapshots: MetricSnapshot[],
  trainedAt?: string,
): ModelExplanation[] {
  const liveCount = snapshots.filter((r) => r.isLive).length
  const viewerCount = snapshots.filter((r) => r.viewers > 0).length
  const loginCount = new Set(snapshots.map((r) => r.login)).size

  return [
    {
      model: 'Pronóstico viewers',
      description: 'Modelo de pronóstico con validación 80/20, señales enriquecidas y comparación vs media móvil y referencia.',
      inputs: ['viewers recientes', 'fecha y hora', 'día de la semana', 'categoría'],
      output: 'Proyección de viewers próximas 6 capturas + calidad y precisión del modelo',
      algorithm: 'Modelo neuronal + media móvil + referencia simple',
      dataPoints: viewerCount || liveCount,
      lastRun: trainedAt,
    },
    {
      model: 'Detección anomalías',
      description: 'Z-score sobre viewers por talento. Umbral ±2σ marca picos y caídas atípicas.',
      inputs: ['viewers', 'media/std por login'],
      output: 'Puntos anómalos con severidad',
      algorithm: 'Z-Score estadístico',
      dataPoints: liveCount,
    },
    {
      model: 'Clustering talentos',
      description: 'K-means (k=4) sobre features normalizados: avg viewers, peak, live rate, días stream, diversidad categoría, hora promedio.',
      inputs: ['6 features por talento'],
      output: '4 grupos: Emergentes, Estables, Top performers, Irregulares',
      algorithm: 'K-Means (implementación TS pura)',
      dataPoints: loginCount,
    },
    {
      model: 'Riesgo inactividad',
      description: 'Score compuesto: días sin stream, tendencia viewers, frecuencia de emisión.',
      inputs: ['eventos de stream', 'capturas en vivo', 'tendencia temporal'],
      output: 'Score 0-100 con nivel bajo/medio/alto/crítico',
      algorithm: 'Heurística ponderada',
      dataPoints: loginCount,
    },
    {
      model: 'Categoría típica',
      description: 'Compara categoría dominante histórica vs categoría actual en Twitch.',
      inputs: ['categoría en histórico', 'categoría en vivo'],
      output: 'Desviación % y flag atípico',
      algorithm: 'Distribución frecuencial',
      dataPoints: liveCount,
    },
    {
      model: 'Horario óptimo',
      description: 'Ranking de franjas día/hora con mayor avg viewers por talento.',
      inputs: ['capturedAt', 'viewers live'],
      output: 'Top 3 slots por talento',
      algorithm: 'Agregación heatmap + ranking',
      dataPoints: liveCount,
    },
    {
      model: 'Score highlights',
      description: 'Score base + boost ML por anomalías positivas y pertenencia a cluster top.',
      inputs: ['pipeline item', 'anomalías', 'clusters', 'eventos offline'],
      output: 'Score 0-100 con desglose',
      algorithm: 'Scoring ponderado + señales ML',
      dataPoints: liveCount,
    },
  ]
}

/* ── Series temporales para pronóstico ── */

export const MIN_FORECAST_SAMPLES = 8

export type ForecastSeriesMode = 'live' | 'viewers' | 'all'

export function getViewerSeries(
  snapshots: MetricSnapshot[],
  login: string,
  mode: ForecastSeriesMode = 'viewers',
): MetricSnapshot[] {
  const rows = snapshots.filter((r) => r.login === login)
  const filtered = rows.filter((r) => {
    if (mode === 'live') return r.isLive
    if (mode === 'viewers') return r.viewers > 0
    return true
  })
  return filtered.sort(
    (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime(),
  )
}

export type SnapshotStats = {
  total: number
  live: number
  withViewers: number
  trainableLogins: number
  perLogin: Record<string, { total: number; live: number; withViewers: number; trainable: boolean }>
}

export function computeSnapshotStats(
  snapshots: MetricSnapshot[],
  logins: string[],
  minSamples = MIN_FORECAST_SAMPLES,
  mode: ForecastSeriesMode = 'viewers',
): SnapshotStats {
  const live = snapshots.filter((r) => r.isLive).length
  const withViewers = snapshots.filter((r) => r.viewers > 0).length
  const perLogin: SnapshotStats['perLogin'] = {}
  let trainableLogins = 0

  for (const login of logins) {
    const loginRows = snapshots.filter((r) => r.login === login)
    const series = getViewerSeries(snapshots, login, mode)
    const trainable = series.length >= minSamples
    if (trainable) trainableLogins += 1
    perLogin[login] = {
      total: loginRows.length,
      live: loginRows.filter((r) => r.isLive).length,
      withViewers: loginRows.filter((r) => r.viewers > 0).length,
      trainable,
    }
  }

  return {
    total: snapshots.length,
    live,
    withViewers,
    trainableLogins,
    perLogin,
  }
}

/* ── Media móvil (fallback forecast) ── */

export function computeMaForecast(
  snapshots: MetricSnapshot[],
  login: string,
  periods = 6,
  windowSize = 5,
  mode: ForecastSeriesMode = 'viewers',
): { historical: { at: string; viewers: number; forecast?: number }[]; projected: number[] } {
  const rows = getViewerSeries(snapshots, login, mode)

  const historical = rows.map((row, index) => {
    const start = Math.max(0, index - windowSize + 1)
    const window = rows.slice(start, index + 1)
    const sma = Math.round(window.reduce((s, r) => s + r.viewers, 0) / window.length)
    return {
      at: new Date(row.capturedAt).toLocaleString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      viewers: row.viewers,
      forecast: index >= windowSize ? sma : undefined,
    }
  })

  const lastValues = rows.slice(-windowSize).map((r) => r.viewers)
  const avgGrowth = lastValues.length >= 2
    ? (lastValues[lastValues.length - 1] - lastValues[0]) / lastValues.length
    : 0

  const projected: number[] = []
  let last = lastValues[lastValues.length - 1] ?? 0
  for (let i = 0; i < periods; i += 1) {
    last = Math.max(0, Math.round(last + avgGrowth))
    projected.push(last)
  }

  return { historical, projected }
}
