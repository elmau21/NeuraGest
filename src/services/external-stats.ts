import type { MetricSnapshot, StreamEvent } from '@/services/metrics'
import type { TwitchTrackerSnapshot } from '@/services/twitchtracker'
import { snapshotsInRange } from '@/services/metrics'

/** Fuentes de datos admitidas para métricas de perfil (plug-in). */
export type ExternalStatsSource =
  | 'helix'
  | 'eventsub'
  | 'twitchtracker'
  | 'vods'
  | 'sessions'
  | 'mixed'

export type TalentVodRecord = {
  id: string
  login: string
  title: string | null
  durationSeconds: number
  viewCount: number
  publishedAt: string
  url: string | null
}

export type StreamSessionRecord = {
  id: string
  talentId: string
  login: string
  startedAt: string
  endedAt: string | null
  peakViewers: number | null
  categoryName: string | null
  title: string | null
}

export type ExternalStatsInput = {
  snapshots: MetricSnapshot[]
  events: StreamEvent[]
  ttSnapshots: TwitchTrackerSnapshot[]
  vods: TalentVodRecord[]
  sessions: StreamSessionRecord[]
  from: Date
  to: Date
}

export type TtPeriodFallback = {
  avgViewers: number
  maxViewers: number
  minutesStreamed: number
  hoursWatched: number
  syncedAt: string
}

const SOURCE_LABELS: Record<ExternalStatsSource, string> = {
  helix: 'Twitch en vivo',
  eventsub: 'Tiempo real',
  twitchtracker: 'Estadísticas externas',
  vods: 'Repeticiones',
  sessions: 'Sesiones locales',
  mixed: 'Varias fuentes',
}

export function externalStatsSourceLabel(source: ExternalStatsSource): string {
  return SOURCE_LABELS[source]
}

/** Último snapshot TT aplicable al rango (resumen rolling ~30d). */
export function latestTtFallback(
  ttSnapshots: TwitchTrackerSnapshot[],
  to: Date,
): TtPeriodFallback | null {
  const latest = [...ttSnapshots]
    .filter((row) => new Date(row.syncedAt).getTime() <= to.getTime())
    .sort((a, b) => new Date(b.syncedAt).getTime() - new Date(a.syncedAt).getTime())[0]
  if (!latest) return null
  if (latest.avgViewers <= 0 && latest.maxViewers <= 0 && latest.minutesStreamed <= 0) return null
  return {
    avgViewers: latest.avgViewers,
    maxViewers: latest.maxViewers,
    minutesStreamed: latest.minutesStreamed,
    hoursWatched: latest.hoursWatched,
    syncedAt: latest.syncedAt,
  }
}

export function vodHoursInRange(vods: TalentVodRecord[], from: Date, to: Date): number {
  const fromTs = from.getTime()
  const toTs = to.getTime()
  const seconds = vods
    .filter((vod) => {
      const ts = new Date(vod.publishedAt).getTime()
      return ts >= fromTs && ts <= toTs
    })
    .reduce((sum, vod) => sum + vod.durationSeconds, 0)
  return Math.round((seconds / 3600) * 10) / 10
}

export function vodActiveDays(vods: TalentVodRecord[], from: Date, to: Date): number {
  const fromTs = from.getTime()
  const toTs = to.getTime()
  const days = new Set(
    vods
      .filter((vod) => {
        const ts = new Date(vod.publishedAt).getTime()
        return ts >= fromTs && ts <= toTs
      })
      .map((vod) => new Date(vod.publishedAt).toISOString().slice(0, 10)),
  )
  return days.size
}

export function sessionHoursInRange(
  sessions: StreamSessionRecord[],
  from: Date,
  to: Date,
): number {
  const fromTs = from.getTime()
  const toTs = to.getTime()
  let totalMs = 0
  for (const session of sessions) {
    const start = new Date(session.startedAt).getTime()
    const end = session.endedAt ? new Date(session.endedAt).getTime() : Date.now()
    if (end < fromTs || start > toTs) continue
    const clampedStart = Math.max(start, fromTs)
    const clampedEnd = Math.min(end, toTs)
    totalMs += Math.max(0, clampedEnd - clampedStart)
  }
  return Math.round((totalMs / 3_600_000) * 10) / 10
}

export function sessionPeakInRange(
  sessions: StreamSessionRecord[],
  from: Date,
  to: Date,
): number {
  const fromTs = from.getTime()
  const toTs = to.getTime()
  return sessions
    .filter((session) => {
      const start = new Date(session.startedAt).getTime()
      return start >= fromTs && start <= toTs
    })
    .reduce((max, session) => Math.max(max, session.peakViewers ?? 0), 0)
}

export function sessionCategoriesInRange(
  sessions: StreamSessionRecord[],
  from: Date,
  to: Date,
): Set<string> {
  const fromTs = from.getTime()
  const toTs = to.getTime()
  const categories = new Set<string>()
  for (const session of sessions) {
    const start = new Date(session.startedAt).getTime()
    if (start < fromTs || start > toTs) continue
    const name = session.categoryName?.trim()
    if (name) categories.add(name)
  }
  return categories
}

export function sessionActiveDays(
  sessions: StreamSessionRecord[],
  from: Date,
  to: Date,
): number {
  const fromTs = from.getTime()
  const toTs = to.getTime()
  const days = new Set(
    sessions
      .filter((session) => {
        const start = new Date(session.startedAt).getTime()
        return start >= fromTs && start <= toTs
      })
      .map((session) => new Date(session.startedAt).toISOString().slice(0, 10)),
  )
  return days.size
}

/** Horas desde pares online/offline (EventSub o detección Helix). */
export function eventHoursInRange(events: StreamEvent[], from: Date, to: Date): number {
  const fromTs = from.getTime()
  const toTs = to.getTime()
  const sorted = [...events]
    .filter((event) => {
      const ts = new Date(event.occurredAt).getTime()
      return ts >= fromTs && ts <= toTs
    })
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())

  let totalMs = 0
  let onlineAt: number | null = null
  for (const event of sorted) {
    const ts = new Date(event.occurredAt).getTime()
    if (event.eventType === 'stream.online') {
      onlineAt = ts
    } else if (event.eventType === 'stream.offline' && onlineAt !== null) {
      totalMs += Math.max(0, ts - onlineAt)
      onlineAt = null
    }
  }
  if (onlineAt !== null) totalMs += Math.max(0, Math.min(Date.now(), toTs) - onlineAt)
  return Math.round((totalMs / 3_600_000) * 10) / 10
}

export function helixLiveMetrics(snapshots: MetricSnapshot[], from: Date, to: Date) {
  const rows = snapshotsInRange(snapshots, from, to)
  const live = rows.filter((row) => row.isLive && row.viewers >= 0)
  const avgViewers = live.length
    ? Math.round(live.reduce((sum, row) => sum + row.viewers, 0) / live.length)
    : 0
  const peakViewers = live.reduce((max, row) => Math.max(max, row.viewers), 0)
  return { live, avgViewers, peakViewers, rows }
}

/** Segunda fuente plug-in: enriquece TT como pseudo-snapshots (reutilizado en perfil y ML). */
export function ttAsViewerPoints(ttSnapshots: TwitchTrackerSnapshot[]): MetricSnapshot[] {
  return ttSnapshots.flatMap((row) => {
    const points: MetricSnapshot[] = [{
      id: -(row.id * 10),
      talentId: row.talentId,
      login: row.login,
      viewers: row.avgViewers,
      isLive: row.avgViewers > 0,
      category: null,
      followers: row.followersTotal,
      capturedAt: row.syncedAt,
    }]
    if (row.maxViewers > row.avgViewers) {
      points.push({
        id: -(row.id * 10 + 1),
        talentId: row.talentId,
        login: row.login,
        viewers: row.maxViewers,
        isLive: true,
        category: null,
        followers: row.followersTotal,
        capturedAt: row.syncedAt,
      })
    }
    return points
  })
}
