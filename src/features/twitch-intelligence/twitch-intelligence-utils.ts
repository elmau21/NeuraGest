import type { TalentManagerRecord } from '@/services/agency'
import type { PipelineItem } from '@/services/agency'
import type { MetricSnapshot, StreamEvent } from '@/services/metrics'

export type CategoryRadarPoint = {
  login: string
  displayName: string
  category: string
  share: number
  isDominant: boolean
  isCurrent: boolean
  atypical: boolean
}

export type CategoryRadarTalent = {
  login: string
  displayName: string
  dominantCategory: string
  currentCategory: string
  atypical: boolean
  points: CategoryRadarPoint[]
}

export type HeatmapCell = {
  day: number
  hour: number
  intensity: number
  snapshots: number
}

export type MovingAveragePoint = {
  at: string
  viewers: number
  sma: number | null
  ema: number | null
}

export type HighlightQueueItem = PipelineItem & {
  score: number
  scoreBreakdown: string
}

export type ManagerLoadRow = {
  managerId: string
  managerLogin: string
  managerDisplayName: string
  talentCount: number
  liveCount: number
  loadIndex: number
  suggestedAction?: string
}

export type PostStreamChecklistItem = {
  id: string
  label: string
  done: boolean
}

export type PostStreamSession = {
  id: string
  login: string
  displayName: string
  title?: string
  category?: string
  offlineAt: string
  items: PostStreamChecklistItem[]
  completed: boolean
}

const POST_STREAM_STORAGE_KEY = 'neuragest-post-stream-checklists'

export const DEFAULT_POST_STREAM_ITEMS: Omit<PostStreamChecklistItem, 'done'>[] = [
  { id: 'vod', label: 'Revisar VOD y marcar momentos clave' },
  { id: 'clips', label: 'Crear clips destacados' },
  { id: 'highlights', label: 'Encolar highlights en pipeline' },
  { id: 'discord', label: 'Avisar en Discord / comunidad' },
  { id: 'metrics', label: 'Registrar métricas del stream' },
  { id: 'schedule', label: 'Confirmar próximo horario en calendario' },
]

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export function dayLabel(day: number) {
  return DAY_LABELS[day] ?? '?'
}

export function buildCategoryRadar(
  snapshots: MetricSnapshot[],
  displayNames: Record<string, string>,
  talentsLive: Record<string, string>,
): CategoryRadarTalent[] {
  const logins = [...new Set(snapshots.map((row) => row.login))]
  return logins.map((login) => {
    const liveRows = snapshots.filter((row) => row.login === login && row.isLive)
    const categories = liveRows
      .map((row) => row.category?.trim())
      .filter((value): value is string => Boolean(value && value !== 'Offline'))

    const counts = new Map<string, number>()
    for (const category of categories) {
      counts.set(category, (counts.get(category) ?? 0) + 1)
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
    const total = categories.length || 1
    const dominant = sorted[0]?.[0] ?? 'Sin datos'
    const currentCategory = talentsLive[login] ?? categories[categories.length - 1] ?? 'Offline'
    const dominantShare = sorted[0] ? sorted[0][1] / total : 0
    const atypical = Boolean(
      dominantShare >= 0.5
      && currentCategory !== 'Offline'
      && currentCategory !== dominant,
    )

    const points: CategoryRadarPoint[] = sorted.slice(0, 6).map(([category, count]) => ({
      login,
      displayName: displayNames[login] ?? login,
      category: category.length > 18 ? `${category.slice(0, 16)}…` : category,
      share: Math.round((count / total) * 100),
      isDominant: category === dominant,
      isCurrent: category === currentCategory,
      atypical: category === currentCategory && atypical,
    }))

    if (points.length === 0) {
      points.push({
        login,
        displayName: displayNames[login] ?? login,
        category: 'Sin histórico',
        share: 0,
        isDominant: true,
        isCurrent: true,
        atypical: false,
      })
    }

    return {
      login,
      displayName: displayNames[login] ?? login,
      dominantCategory: dominant,
      currentCategory,
      atypical,
      points,
    }
  }).sort((a, b) => Number(b.atypical) - Number(a.atypical))
}

export function buildScheduleHeatmap(snapshots: MetricSnapshot[]): HeatmapCell[] {
  const grid = new Map<string, { live: number; total: number }>()
  for (const row of snapshots) {
    const date = new Date(row.capturedAt)
    const jsDay = date.getDay()
    const day = jsDay === 0 ? 6 : jsDay - 1
    const hour = date.getHours()
    const key = `${day}-${hour}`
    const cell = grid.get(key) ?? { live: 0, total: 0 }
    cell.total += 1
    if (row.isLive) cell.live += 1
    grid.set(key, cell)
  }

  const cells: HeatmapCell[] = []
  for (let day = 0; day < 7; day += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      const cell = grid.get(`${day}-${hour}`)
      const intensity = cell && cell.total > 0
        ? Math.round((cell.live / cell.total) * 100)
        : 0
      cells.push({
        day,
        hour,
        intensity,
        snapshots: cell?.total ?? 0,
      })
    }
  }
  return cells
}

export function computeMovingAverage(
  snapshots: MetricSnapshot[],
  login: string,
  windowSize: number,
  emaAlpha: number,
): MovingAveragePoint[] {
  const rows = snapshots
    .filter((row) => row.login === login && row.isLive)
    .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime())

  let ema: number | null = null
  return rows.map((row, index) => {
    const viewers = row.viewers
    const start = Math.max(0, index - windowSize + 1)
    const window = rows.slice(start, index + 1)
    const sma = Math.round(window.reduce((sum, item) => sum + item.viewers, 0) / window.length)
    ema = ema === null ? viewers : Math.round(emaAlpha * viewers + (1 - emaAlpha) * ema)
    return {
      at: new Date(row.capturedAt).toLocaleString('es-MX', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      viewers,
      sma,
      ema,
    }
  })
}

export function simulateMovingAverageProjection(
  lastValue: number,
  growthPct: number,
  periods: number,
): number[] {
  const rate = 1 + growthPct / 100
  const projected: number[] = []
  let value = lastValue
  for (let i = 0; i < periods; i += 1) {
    value = Math.max(0, Math.round(value * rate))
    projected.push(value)
  }
  return projected
}

export function scoreHighlightItem(
  item: PipelineItem,
  snapshots: MetricSnapshot[],
  events: StreamEvent[],
): { score: number; breakdown: string } {
  let score = 40
  const parts: string[] = ['Base 40']

  if (item.contentType === 'highlight') {
    score += 15
    parts.push('+15 highlight')
  } else if (item.contentType === 'clip') {
    score += 10
    parts.push('+10 clip')
  }

  if (item.status === 'idea') {
    score += 5
    parts.push('+5 en cola')
  } else if (item.status === 'editing') {
    score += 12
    parts.push('+12 editando')
  }

  const login = item.talentLogin?.toLowerCase()
  if (login) {
    const liveRows = snapshots.filter((row) => row.login.toLowerCase() === login && row.isLive)
    const peak = liveRows.reduce((max, row) => Math.max(max, row.viewers), 0)
    if (peak >= 100) {
      score += 20
      parts.push('+20 pico ≥100')
    } else if (peak >= 50) {
      score += 12
      parts.push('+12 pico ≥50')
    } else if (peak >= 20) {
      score += 6
      parts.push('+6 pico ≥20')
    }

    const recentOffline = events.find(
      (event) => event.login.toLowerCase() === login && event.eventType === 'stream.offline',
    )
    if (recentOffline) {
      const hoursAgo = (Date.now() - new Date(recentOffline.occurredAt).getTime()) / 3_600_000
      if (hoursAgo <= 24) {
        score += 15
        parts.push('+15 post-stream <24h')
      } else if (hoursAgo <= 72) {
        score += 8
        parts.push('+8 post-stream <72h')
      }
    }
  }

  const ageDays = (Date.now() - new Date(item.createdAt).getTime()) / 86_400_000
  if (ageDays <= 2) {
    score += 8
    parts.push('+8 reciente')
  } else if (ageDays >= 14) {
    score -= 10
    parts.push('−10 antiguo')
  }

  return { score: Math.max(0, Math.min(100, score)), breakdown: parts.join(' · ') }
}

export function buildHighlightsQueue(
  items: PipelineItem[],
  snapshots: MetricSnapshot[],
  events: StreamEvent[],
): HighlightQueueItem[] {
  return items
    .filter((item) => item.contentType === 'highlight' || item.contentType === 'clip')
    .map((item) => {
      const { score, breakdown } = scoreHighlightItem(item, snapshots, events)
      return { ...item, score, scoreBreakdown: breakdown }
    })
    .sort((a, b) => b.score - a.score)
}

export function buildManagerLoad(
  managers: TalentManagerRecord[],
  liveLogins: Set<string>,
): ManagerLoadRow[] {
  const byManager = new Map<string, ManagerLoadRow>()
  for (const row of managers) {
    const existing = byManager.get(row.managerAppUserId) ?? {
      managerId: row.managerAppUserId,
      managerLogin: row.managerLogin,
      managerDisplayName: row.managerDisplayName ?? row.managerLogin,
      talentCount: 0,
      liveCount: 0,
      loadIndex: 0,
    }
    existing.talentCount += 1
    if (liveLogins.has(row.talentLogin.toLowerCase())) {
      existing.liveCount += 1
    }
    byManager.set(row.managerAppUserId, existing)
  }

  const rows = [...byManager.values()]
  const avg = rows.length ? rows.reduce((sum, row) => sum + row.talentCount, 0) / rows.length : 0

  return rows.map((row) => {
    const loadIndex = avg > 0 ? Math.round((row.talentCount / avg) * 100) : row.talentCount * 100
    let suggestedAction: string | undefined
    if (loadIndex >= 130) suggestedAction = 'Sobrecarga — considera reasignar talentos'
    else if (loadIndex <= 70 && row.talentCount > 0) suggestedAction = 'Capacidad disponible'
    else if (row.talentCount === 0) suggestedAction = 'Sin talentos asignados'
    return { ...row, loadIndex, suggestedAction }
  }).sort((a, b) => b.loadIndex - a.loadIndex)
}

export function suggestManagerRebalance(
  managers: TalentManagerRecord[],
): { fromManager: string; toManager: string; talentLogin: string; reason: string }[] {
  const load = buildManagerLoad(managers, new Set())
  const overloaded = load.filter((row) => row.loadIndex >= 130)
  const underloaded = load.filter((row) => row.loadIndex <= 70 && row.talentCount > 0)
  const suggestions: { fromManager: string; toManager: string; talentLogin: string; reason: string }[] = []

  for (const heavy of overloaded) {
    const talents = managers.filter((m) => m.managerAppUserId === heavy.managerId)
    const movable = talents[0]
    const target = underloaded.find((row) => row.managerId !== heavy.managerId)
    if (movable && target) {
      suggestions.push({
        fromManager: heavy.managerDisplayName,
        toManager: target.managerDisplayName,
        talentLogin: movable.talentLogin,
        reason: `Balancear carga (${heavy.loadIndex}% → ${target.loadIndex}%)`,
      })
    }
  }
  return suggestions
}

export function loadPostStreamSessions(): PostStreamSession[] {
  try {
    const raw = localStorage.getItem(POST_STREAM_STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as PostStreamSession[]
  } catch {
    return []
  }
}

export function savePostStreamSessions(sessions: PostStreamSession[]) {
  localStorage.setItem(POST_STREAM_STORAGE_KEY, JSON.stringify(sessions))
}

export function createPostStreamSession(
  login: string,
  displayName: string,
  offlineAt: string,
  title?: string,
  category?: string,
): PostStreamSession {
  return {
    id: `${login}-${offlineAt}`,
    login,
    displayName,
    title,
    category,
    offlineAt,
    items: DEFAULT_POST_STREAM_ITEMS.map((item) => ({ ...item, done: false })),
    completed: false,
  }
}

export function upsertPostStreamSession(session: PostStreamSession) {
  const sessions = loadPostStreamSessions().filter((row) => row.id !== session.id)
  sessions.unshift(session)
  savePostStreamSessions(sessions.slice(0, 30))
}
