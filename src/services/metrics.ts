import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '@/services/twitch'

export type MetricSnapshot = {
  id: number
  talentId: string
  login: string
  viewers: number
  isLive: boolean
  category: string | null
  followers: number | null
  capturedAt: string
}

export type StreamEvent = {
  id: number
  login: string
  eventType: 'stream.online' | 'stream.offline'
  streamId: string | null
  categoryName: string | null
  title: string | null
  occurredAt: string
}

export type EventSubStatus = {
  state: 'disconnected' | 'connecting' | 'connected' | 'fallback_polling'
  sessionId: string | null
  subscriptions: number
  lastEventAt: string | null
}

export type WeeklyTalentMetrics = {
  login: string
  displayName: string
  thisWeek: {
    avgViewers: number
    peakViewers: number
    liveSnapshots: number
    streamDays: number
  }
  lastWeek: {
    avgViewers: number
    peakViewers: number
    liveSnapshots: number
    streamDays: number
  }
  deltaAvgViewers: number
  deltaPeakViewers: number
  deltaPct: number
}

export type StreakIndicator = {
  login: string
  displayName: string
  type: 'days_offline' | 'viewer_drop' | 'atypical_category'
  severity: 'info' | 'warning' | 'critical'
  label: string
  detail: string
}

type RawSnapshot = {
  id: number
  talentId: string
  login: string
  viewers: number
  isLive: boolean
  category?: string | null
  followers?: number | null
  capturedAt: string
}

type RawStreamEvent = {
  id: number
  login: string
  eventType: string
  streamId?: string | null
  categoryName?: string | null
  title?: string | null
  occurredAt: string
}

function mapSnapshot(row: RawSnapshot): MetricSnapshot {
  return {
    id: row.id,
    talentId: row.talentId,
    login: row.login,
    viewers: row.viewers,
    isLive: row.isLive,
    category: row.category ?? null,
    followers: row.followers ?? null,
    capturedAt: row.capturedAt,
  }
}

function mapStreamEvent(row: RawStreamEvent): StreamEvent {
  return {
    id: row.id,
    login: row.login,
    eventType: row.eventType as StreamEvent['eventType'],
    streamId: row.streamId ?? null,
    categoryName: row.categoryName ?? null,
    title: row.title ?? null,
    occurredAt: row.occurredAt,
  }
}

export async function fetchMetricSnapshots(hours = 168, login?: string): Promise<MetricSnapshot[]> {
  if (!isTauri) return []
  const rows = await invoke<RawSnapshot[]>('fetch_metric_snapshots', { hours, login })
  return rows.map(mapSnapshot)
}

export async function fetchStreamEvents(hours = 168, login?: string): Promise<StreamEvent[]> {
  if (!isTauri) return []
  const rows = await invoke<RawStreamEvent[]>('fetch_stream_events', { hours, login: login ?? null })
  return rows.map(mapStreamEvent)
}

export async function fetchEventSubStatus(): Promise<EventSubStatus | null> {
  if (!isTauri) return null
  return invoke<EventSubStatus>('eventsub_status')
}

export function startOfWeek(date: Date) {
  const copy = new Date(date)
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setHours(0, 0, 0, 0)
  copy.setDate(copy.getDate() + diff)
  return copy
}

export function snapshotsInRange(snapshots: MetricSnapshot[], from: Date, to: Date) {
  const start = from.getTime()
  const end = to.getTime()
  return snapshots.filter((row) => {
    const ts = new Date(row.capturedAt).getTime()
    return ts >= start && ts < end
  })
}

function aggregateWeek(rows: MetricSnapshot[]) {
  const liveRows = rows.filter((row) => row.isLive)
  const avgViewers = liveRows.length
    ? liveRows.reduce((sum, row) => sum + row.viewers, 0) / liveRows.length
    : 0
  const peakViewers = liveRows.reduce((max, row) => Math.max(max, row.viewers), 0)
  const streamDays = new Set(
    liveRows.map((row) => new Date(row.capturedAt).toISOString().slice(0, 10)),
  ).size
  return {
    avgViewers: Math.round(avgViewers),
    peakViewers,
    liveSnapshots: liveRows.length,
    streamDays,
  }
}

export function buildWeeklyComparison(
  snapshots: MetricSnapshot[],
  displayNames: Record<string, string>,
): WeeklyTalentMetrics[] {
  const now = new Date()
  const thisStart = startOfWeek(now)
  const lastStart = new Date(thisStart)
  lastStart.setDate(lastStart.getDate() - 7)
  const lastEnd = new Date(thisStart)

  const logins = [...new Set(snapshots.map((row) => row.login))]
  return logins.map((login) => {
    const talentSnapshots = snapshots.filter((row) => row.login === login)
    const thisWeek = aggregateWeek(snapshotsInRange(talentSnapshots, thisStart, now))
    const lastWeek = aggregateWeek(snapshotsInRange(talentSnapshots, lastStart, lastEnd))
    const deltaAvgViewers = thisWeek.avgViewers - lastWeek.avgViewers
    const deltaPeakViewers = thisWeek.peakViewers - lastWeek.peakViewers
    const deltaPct = lastWeek.avgViewers > 0
      ? ((thisWeek.avgViewers - lastWeek.avgViewers) / lastWeek.avgViewers) * 100
      : thisWeek.avgViewers > 0 ? 100 : 0
    return {
      login,
      displayName: displayNames[login] ?? login,
      thisWeek,
      lastWeek,
      deltaAvgViewers,
      deltaPeakViewers,
      deltaPct,
    }
  }).sort((a, b) => b.thisWeek.avgViewers - a.thisWeek.avgViewers)
}

export function buildStreakIndicators(
  snapshots: MetricSnapshot[],
  events: StreamEvent[],
  displayNames: Record<string, string>,
): StreakIndicator[] {
  const indicators: StreakIndicator[] = []
  const now = Date.now()
  const logins = [...new Set(snapshots.map((row) => row.login))]

  for (const login of logins) {
    const displayName = displayNames[login] ?? login
    const rows = snapshots.filter((row) => row.login === login).sort(
      (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime(),
    )
    const loginEvents = events.filter((event) => event.login === login)

    const lastOnlineEvent = loginEvents.find((event) => event.eventType === 'stream.online')
    const lastLiveSnapshot = [...rows].reverse().find((row) => row.isLive)
    const lastActivity = lastOnlineEvent?.occurredAt ?? lastLiveSnapshot?.capturedAt
    if (lastActivity) {
      const daysOffline = Math.floor((now - new Date(lastActivity).getTime()) / 86_400_000)
      if (daysOffline >= 2) {
        indicators.push({
          login,
          displayName,
          type: 'days_offline',
          severity: daysOffline >= 5 ? 'critical' : daysOffline >= 3 ? 'warning' : 'info',
          label: `${daysOffline} días sin stream`,
          detail: `Última actividad: ${new Date(lastActivity).toLocaleString('es-MX')}`,
        })
      }
    } else if (rows.length > 0) {
      indicators.push({
        login,
        displayName,
        type: 'days_offline',
        severity: 'warning',
        label: 'Sin streams registrados',
        detail: 'No hay eventos online ni snapshots live en el periodo.',
      })
    }

    const liveRows = rows.filter((row) => row.isLive)
    if (liveRows.length >= 4) {
      const recent = liveRows.slice(-4)
      const peak = Math.max(...recent.map((row) => row.viewers))
      const latest = recent[recent.length - 1]?.viewers ?? 0
      if (peak >= 20 && latest <= peak * 0.45) {
        const dropPct = Math.round(((peak - latest) / peak) * 100)
        indicators.push({
          login,
          displayName,
          type: 'viewer_drop',
          severity: dropPct >= 60 ? 'critical' : 'warning',
          label: `Caída de viewers (−${dropPct}%)`,
          detail: `Pico reciente ${peak.toLocaleString('es-MX')} → actual ${latest.toLocaleString('es-MX')}`,
        })
      }
    }

    const categories = liveRows
      .map((row) => row.category?.trim())
      .filter((value): value is string => Boolean(value && value !== 'Offline'))
    if (categories.length >= 3) {
      const counts = new Map<string, number>()
      for (const category of categories) {
        counts.set(category, (counts.get(category) ?? 0) + 1)
      }
      const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
      const dominant = sorted[0]
      const latestCategory = categories[categories.length - 1]
      if (dominant && latestCategory && dominant[0] !== latestCategory) {
        const dominantShare = dominant[1] / categories.length
        if (dominantShare >= 0.5) {
          indicators.push({
            login,
            displayName,
            type: 'atypical_category',
            severity: 'info',
            label: 'Categoría atípica',
            detail: `Habitual: ${dominant[0]} · Actual: ${latestCategory}`,
          })
        }
      }
    }
  }

  const severityOrder = { critical: 0, warning: 1, info: 2 }
  return indicators.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
  )
}

export function historySeriesByLogin(snapshots: MetricSnapshot[], login: string, maxPoints = 120) {
  const rows = snapshots
    .filter((row) => row.login === login)
    .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime())
  const step = Math.max(1, Math.floor(rows.length / maxPoints))
  return rows
    .filter((_, index) => index % step === 0 || index === rows.length - 1)
    .map((row) => ({
      at: new Date(row.capturedAt).toLocaleString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      viewers: row.viewers,
      live: row.isLive ? 1 : 0,
    }))
}

export function weeklyComparisonCsv(rows: WeeklyTalentMetrics[]) {
  const header = [
    'login', 'talento',
    'avg_viewers_semana_actual', 'peak_viewers_semana_actual', 'dias_stream_semana_actual',
    'avg_viewers_semana_anterior', 'peak_viewers_semana_anterior', 'dias_stream_semana_anterior',
    'delta_avg_viewers', 'delta_peak_viewers', 'delta_pct_avg',
  ]
  const body = rows.map((row) => [
    row.login,
    row.displayName,
    row.thisWeek.avgViewers,
    row.thisWeek.peakViewers,
    row.thisWeek.streamDays,
    row.lastWeek.avgViewers,
    row.lastWeek.peakViewers,
    row.lastWeek.streamDays,
    row.deltaAvgViewers,
    row.deltaPeakViewers,
    row.deltaPct.toFixed(1),
  ])
  return [header, ...body]
    .map((line) => line.map((cell) => {
      const text = String(cell)
      return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
    }).join(','))
    .join('\n')
}

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export async function exportWeeklyExcel(rows: WeeklyTalentMetrics[]) {
  const XLSX = await import('xlsx')
  const sheet = XLSX.utils.json_to_sheet(rows.map((row) => ({
    Login: row.login,
    Talento: row.displayName,
    'Avg viewers (sem. actual)': row.thisWeek.avgViewers,
    'Peak viewers (sem. actual)': row.thisWeek.peakViewers,
    'Días con stream (actual)': row.thisWeek.streamDays,
    'Avg viewers (sem. anterior)': row.lastWeek.avgViewers,
    'Peak viewers (sem. anterior)': row.lastWeek.peakViewers,
    'Días con stream (anterior)': row.lastWeek.streamDays,
    'Δ avg viewers': row.deltaAvgViewers,
    'Δ peak viewers': row.deltaPeakViewers,
    'Δ % avg': Number(row.deltaPct.toFixed(1)),
  })))
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Comparativa semanal')
  XLSX.writeFile(book, `neuragest-semanal-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export async function exportWeeklyPdf(rows: WeeklyTalentMetrics[]) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'landscape' })
  doc.setFontSize(14)
  doc.text('NeuraGest — Comparativa semanal Twitch', 14, 16)
  doc.setFontSize(9)
  let y = 26
  for (const row of rows) {
    const line = `${row.displayName}: avg ${row.thisWeek.avgViewers} (${row.deltaPct >= 0 ? '+' : ''}${row.deltaPct.toFixed(1)}%) · peak ${row.thisWeek.peakViewers}`
    doc.text(line, 14, y)
    y += 6
    if (y > 190) {
      doc.addPage()
      y = 16
    }
  }
  doc.save(`neuragest-semanal-${new Date().toISOString().slice(0, 10)}.pdf`)
}
