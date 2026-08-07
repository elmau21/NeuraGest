import type { MetricSnapshot, StreamEvent } from '@/services/metrics'
import { snapshotsInRange } from '@/services/metrics'
import type { TwitchTrackerSnapshot } from '@/services/twitchtracker'
import type { ClipRecord } from '@/services/ops'
import { SNAPSHOT_INTERVAL_MIN } from '@/features/platform-stats/platform-stats-utils'
import {
  eventHoursInRange,
  externalStatsSourceLabel,
  helixLiveMetrics,
  latestTtFallback,
  sessionActiveDays,
  sessionCategoriesInRange,
  sessionHoursInRange,
  sessionPeakInRange,
  vodActiveDays,
  vodHoursInRange,
  type ExternalStatsSource,
  type StreamSessionRecord,
  type TalentVodRecord,
} from '@/services/external-stats'

export type { ExternalStatsSource, StreamSessionRecord, TalentVodRecord }
export { externalStatsSourceLabel }

export type TalentPeriod = '7d' | '30d' | '3m' | 'all'

export type PeriodMetrics = {
  hoursStreamed: number
  avgViewers: number
  peakViewers: number
  hoursWatched: number
  followersGained: number | null
  followersPerHour: number | null
  gamesStreamed: number
  activeDays: number
}

export type PeriodMetricsWithSources = PeriodMetrics & {
  sources: Partial<Record<keyof PeriodMetrics, ExternalStatsSource>>
}

export type MetricDelta = {
  value: number
  pct: number | null
}

export type TalentPerformanceSummary = {
  current: PeriodMetricsWithSources
  previous: PeriodMetricsWithSources
  deltas: Record<keyof PeriodMetrics, MetricDelta>
}

export type TalentLifetimeStats = {
  totalHoursStreamed: number
  highestViewers: number
  followersHelix: number | null
  followersTt: number | null
  gamesCount: number
  totalClips: number
  clipViews: number
  ttRank: number | null
}

export type TalentViewershipPoint = {
  at: string
  ts: number
  viewers: number
  live: boolean
  source?: ExternalStatsSource
}

export type TalentCategoryStat = {
  category: string
  snapshots: number
  avgViewers: number
  sharePct: number
}

const PERIOD_HOURS: Record<Exclude<TalentPeriod, 'all'>, number> = {
  '7d': 168,
  '30d': 720,
  '3m': 2160,
}

export function periodToHours(period: TalentPeriod, dataSpanHours = 8760): number {
  if (period === 'all') return dataSpanHours
  return PERIOD_HOURS[period]
}

export function periodLabel(period: TalentPeriod): string {
  if (period === '7d') return '7 días'
  if (period === '30d') return '30 días'
  if (period === '3m') return '3 meses'
  return 'Todo el histórico'
}

function filterByLogin<T extends { login: string }>(rows: T[], login: string): T[] {
  const key = login.toLowerCase()
  return rows.filter((row) => row.login.toLowerCase() === key)
}

function periodRange(period: TalentPeriod, now = new Date(), dataSpanHours = 8760) {
  const hours = periodToHours(period, dataSpanHours)
  const to = now
  const from = new Date(now.getTime() - hours * 3_600_000)
  const prevTo = from
  const prevFrom = new Date(from.getTime() - hours * 3_600_000)
  return { from, to, prevFrom, prevTo, hours }
}

function estimateHoursWatchedForTalent(rows: MetricSnapshot[]): number {
  const live = [...rows.filter((row) => row.isLive && row.viewers >= 0)].sort(
    (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime(),
  )
  if (live.length === 0) return 0
  if (live.length === 1) return Math.round((live[0].viewers * SNAPSHOT_INTERVAL_MIN) / 60)
  let hours = 0
  for (let i = 1; i < live.length; i += 1) {
    const prev = live[i - 1]
    const curr = live[i]
    const deltaHours = Math.max(0, (new Date(curr.capturedAt).getTime() - new Date(prev.capturedAt).getTime()) / 3_600_000)
    const avgCcv = (prev.viewers + curr.viewers) / 2
    hours += avgCcv * deltaHours
  }
  return Math.round(hours)
}

function followersDelta(snapshots: MetricSnapshot[]): number | null {
  const withFollowers = snapshots
    .filter((row) => row.followers != null && row.followers > 0)
    .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime())
  if (withFollowers.length < 2) return null
  const first = withFollowers[0].followers!
  const last = withFollowers[withFollowers.length - 1].followers!
  return last - first
}

function ttFollowersInRange(
  ttSnapshots: TwitchTrackerSnapshot[],
  from: Date,
  to: Date,
): number | null {
  const inRange = ttSnapshots
    .filter((row) => {
      const ts = new Date(row.syncedAt).getTime()
      return ts >= from.getTime() && ts <= to.getTime()
    })
    .sort((a, b) => new Date(a.syncedAt).getTime() - new Date(b.syncedAt).getTime())
  if (inRange.length === 0) {
    const latest = ttSnapshots
      .filter((row) => new Date(row.syncedAt).getTime() <= to.getTime())
      .sort((a, b) => new Date(b.syncedAt).getTime() - new Date(a.syncedAt).getTime())[0]
    return latest?.followersGrowth ?? null
  }
  const growthSum = inRange.reduce((sum, row) => sum + (row.followersGrowth ?? 0), 0)
  return growthSum || (inRange[inRange.length - 1]?.followersGrowth ?? null)
}

export function computePeriodMetrics(
  snapshots: MetricSnapshot[],
  events: StreamEvent[],
  ttSnapshots: TwitchTrackerSnapshot[],
  from: Date,
  to: Date,
  vods: TalentVodRecord[] = [],
  sessions: StreamSessionRecord[] = [],
): PeriodMetricsWithSources {
  const sources: Partial<Record<keyof PeriodMetrics, ExternalStatsSource>> = {}
  const periodEvents = events.filter((event) => {
    const ts = new Date(event.occurredAt).getTime()
    return ts >= from.getTime() && ts <= to.getTime()
  })

  const { live, avgViewers: helixAvg, peakViewers: helixPeak, rows } = helixLiveMetrics(snapshots, from, to)
  const tt = latestTtFallback(ttSnapshots, to)

  const eventHours = eventHoursInRange(periodEvents, from, to)
  const sessionHours = sessionHoursInRange(sessions, from, to)
  const vodHours = vodHoursInRange(vods, from, to)
  const snapshotHours = Math.round((live.length * SNAPSHOT_INTERVAL_MIN) / 60 * 10) / 10
  const ttHours = tt ? Math.round((tt.minutesStreamed / 60) * 10) / 10 : 0

  let hoursStreamed = 0
  if (eventHours > 0) {
    hoursStreamed = eventHours
    sources.hoursStreamed = 'eventsub'
  } else if (sessionHours > 0) {
    hoursStreamed = sessionHours
    sources.hoursStreamed = 'sessions'
  } else if (vodHours > 0) {
    hoursStreamed = vodHours
    sources.hoursStreamed = 'vods'
  } else if (snapshotHours > 0) {
    hoursStreamed = snapshotHours
    sources.hoursStreamed = 'helix'
  } else if (ttHours > 0) {
    hoursStreamed = ttHours
    sources.hoursStreamed = 'twitchtracker'
  }

  let avgViewers = helixAvg
  if (avgViewers > 0) {
    sources.avgViewers = 'helix'
  } else if (tt && tt.avgViewers > 0) {
    avgViewers = tt.avgViewers
    sources.avgViewers = 'twitchtracker'
  }

  let peakViewers = helixPeak
  const sessionPeak = sessionPeakInRange(sessions, from, to)
  if (peakViewers > 0) {
    sources.peakViewers = 'helix'
  } else if (sessionPeak > 0) {
    peakViewers = sessionPeak
    sources.peakViewers = 'sessions'
  } else if (tt && tt.maxViewers > 0) {
    peakViewers = tt.maxViewers
    sources.peakViewers = 'twitchtracker'
  }

  let hoursWatched = estimateHoursWatchedForTalent(rows)
  if (hoursWatched > 0) {
    sources.hoursWatched = 'helix'
  } else if (tt && tt.hoursWatched > 0) {
    hoursWatched = tt.hoursWatched
    sources.hoursWatched = 'twitchtracker'
  } else if (avgViewers > 0 && hoursStreamed > 0) {
    hoursWatched = Math.round(avgViewers * hoursStreamed)
    sources.hoursWatched = sources.avgViewers === 'twitchtracker' ? 'twitchtracker' : 'mixed'
  }

  const followersGained = ttFollowersInRange(ttSnapshots, from, to) ?? followersDelta(rows)
  if (followersGained != null) {
    sources.followersGained = ttFollowersInRange(ttSnapshots, from, to) != null ? 'twitchtracker' : 'helix'
  }

  const followersPerHour =
    followersGained != null && hoursStreamed > 0
      ? Math.round((followersGained / hoursStreamed) * 10) / 10
      : null
  if (followersPerHour != null) {
    sources.followersPerHour = sources.followersGained ?? 'mixed'
  }

  const categories = new Set(
    live
      .map((row) => row.category?.trim())
      .filter((value): value is string => Boolean(value && value !== 'Offline')),
  )
  for (const event of periodEvents) {
    if (event.categoryName?.trim()) categories.add(event.categoryName.trim())
  }
  for (const name of sessionCategoriesInRange(sessions, from, to)) {
    categories.add(name)
  }

  if (categories.size > 0) {
    const fromSessions = sessionCategoriesInRange(sessions, from, to).size > 0
    const fromHelix = live.some((row) => row.category?.trim())
    sources.gamesStreamed = fromHelix && fromSessions ? 'mixed' : fromSessions ? 'sessions' : 'helix'
  }

  const snapshotDays = new Set(
    live.map((row) => new Date(row.capturedAt).toISOString().slice(0, 10)),
  ).size
  const vodDays = vodActiveDays(vods, from, to)
  const sessionDays = sessionActiveDays(sessions, from, to)
  const activeDays = Math.max(snapshotDays, vodDays, sessionDays)
  if (activeDays > 0) {
    if (snapshotDays >= vodDays && snapshotDays >= sessionDays) sources.activeDays = 'helix'
    else if (vodDays >= sessionDays) sources.activeDays = 'vods'
    else sources.activeDays = 'sessions'
  }

  return {
    hoursStreamed,
    avgViewers,
    peakViewers,
    hoursWatched,
    followersGained,
    followersPerHour,
    gamesStreamed: categories.size,
    activeDays,
    sources,
  }
}

function computeDelta(current: number, previous: number): MetricDelta {
  const value = current - previous
  const pct = previous !== 0 ? (value / previous) * 100 : current !== 0 ? 100 : null
  return { value, pct }
}

function computeNullableDelta(current: number | null, previous: number | null): MetricDelta {
  if (current == null || previous == null) return { value: 0, pct: null }
  return computeDelta(current, previous)
}

export function buildTalentPerformanceSummary(
  snapshots: MetricSnapshot[],
  events: StreamEvent[],
  ttSnapshots: TwitchTrackerSnapshot[],
  period: TalentPeriod,
  vods: TalentVodRecord[] = [],
  sessions: StreamSessionRecord[] = [],
  now = new Date(),
): TalentPerformanceSummary {
  const oldest = snapshots[0]?.capturedAt
  const dataSpanHours = oldest
    ? Math.max(168, Math.ceil((now.getTime() - new Date(oldest).getTime()) / 3_600_000))
    : 8760
  const { from, to, prevFrom, prevTo } = periodRange(period, now, dataSpanHours)
  const current = computePeriodMetrics(snapshots, events, ttSnapshots, from, to, vods, sessions)
  const previous = computePeriodMetrics(snapshots, events, ttSnapshots, prevFrom, prevTo, vods, sessions)

  return {
    current,
    previous,
    deltas: {
      hoursStreamed: computeDelta(current.hoursStreamed, previous.hoursStreamed),
      avgViewers: computeDelta(current.avgViewers, previous.avgViewers),
      peakViewers: computeDelta(current.peakViewers, previous.peakViewers),
      hoursWatched: computeDelta(current.hoursWatched, previous.hoursWatched),
      followersGained: computeNullableDelta(current.followersGained, previous.followersGained),
      followersPerHour: computeNullableDelta(current.followersPerHour, previous.followersPerHour),
      gamesStreamed: computeDelta(current.gamesStreamed, previous.gamesStreamed),
      activeDays: computeDelta(current.activeDays, previous.activeDays),
    },
  }
}

export function buildLifetimeStats(
  snapshots: MetricSnapshot[],
  events: StreamEvent[],
  ttSnapshots: TwitchTrackerSnapshot[],
  clips: ClipRecord[],
  helixFollowers: number | null,
  vods: TalentVodRecord[] = [],
  sessions: StreamSessionRecord[] = [],
): TalentLifetimeStats {
  const metrics = computePeriodMetrics(
    snapshots,
    events,
    ttSnapshots,
    new Date(0),
    new Date(),
    vods,
    sessions,
  )
  const { peakViewers: helixPeak } = helixLiveMetrics(snapshots, new Date(0), new Date())
  const tt = latestTtFallback(ttSnapshots, new Date())
  const sessionPeak = sessionPeakInRange(sessions, new Date(0), new Date())

  const categories = new Set<string>()
  for (const row of snapshots.filter((r) => r.isLive && r.category?.trim() && r.category !== 'Offline')) {
    categories.add(row.category!.trim())
  }
  for (const name of sessionCategoriesInRange(sessions, new Date(0), new Date())) {
    categories.add(name)
  }

  const latestTt = [...ttSnapshots].sort(
    (a, b) => new Date(b.syncedAt).getTime() - new Date(a.syncedAt).getTime(),
  )[0]
  const latestFollowers = [...snapshots]
    .filter((row) => row.followers != null && row.followers > 0)
    .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0]

  return {
    totalHoursStreamed: metrics.hoursStreamed,
    highestViewers: Math.max(helixPeak, sessionPeak, tt?.maxViewers ?? 0),
    followersHelix: helixFollowers ?? latestFollowers?.followers ?? null,
    followersTt: latestTt?.followersTotal ?? null,
    gamesCount: categories.size,
    totalClips: clips.length,
    clipViews: clips.reduce((sum, clip) => sum + clip.viewCount, 0),
    ttRank: latestTt?.rank ?? null,
  }
}

export function buildTalentViewershipSeries(
  snapshots: MetricSnapshot[],
  ttSnapshots: TwitchTrackerSnapshot[],
  period: TalentPeriod,
  maxPoints = 120,
): TalentViewershipPoint[] {
  const now = new Date()
  const oldest = snapshots[0]?.capturedAt
  const dataSpanHours = oldest
    ? Math.max(168, Math.ceil((now.getTime() - new Date(oldest).getTime()) / 3_600_000))
    : 8760
  const hours = periodToHours(period, dataSpanHours)
  const from = new Date(now.getTime() - hours * 3_600_000)

  const helixRows = snapshotsInRange(snapshots, from, now)
    .filter((row) => row.isLive)
    .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime())
    .map((row) => ({
      at: new Date(row.capturedAt).toLocaleString('es-MX', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      ts: new Date(row.capturedAt).getTime(),
      viewers: row.viewers,
      live: row.isLive,
      source: 'helix' as ExternalStatsSource,
    }))

  if (helixRows.length >= 2) {
    const step = Math.max(1, Math.floor(helixRows.length / maxPoints))
    return helixRows.filter((_, index) => index % step === 0 || index === helixRows.length - 1)
  }

  const tt = latestTtFallback(
    ttSnapshots.filter((row) => new Date(row.syncedAt).getTime() <= now.getTime()),
    now,
  )
  if (!tt) return helixRows

  return [
    {
      at: new Date(tt.syncedAt).toLocaleString('es-MX', { month: 'short', day: 'numeric' }),
      ts: new Date(tt.syncedAt).getTime(),
      viewers: tt.avgViewers,
      live: true,
      source: 'twitchtracker',
    },
    {
      at: `${new Date(tt.syncedAt).toLocaleString('es-MX', { month: 'short', day: 'numeric' })} (pico)`,
      ts: new Date(tt.syncedAt).getTime() + 1,
      viewers: tt.maxViewers,
      live: true,
      source: 'twitchtracker',
    },
  ]
}

export function buildTalentCategoryBreakdown(
  snapshots: MetricSnapshot[],
  sessions: StreamSessionRecord[],
  period: TalentPeriod,
): TalentCategoryStat[] {
  const now = new Date()
  const oldest = snapshots[0]?.capturedAt
  const dataSpanHours = oldest
    ? Math.max(168, Math.ceil((now.getTime() - new Date(oldest).getTime()) / 3_600_000))
    : 8760
  const hours = periodToHours(period, dataSpanHours)
  const from = new Date(now.getTime() - hours * 3_600_000)
  const live = snapshotsInRange(snapshots, from, now).filter((row) => row.isLive && row.viewers >= 0)

  const totals = new Map<string, { count: number; viewers: number }>()
  for (const row of live) {
    const category = row.category?.trim()
    if (!category || category === 'Offline') continue
    const bucket = totals.get(category) ?? { count: 0, viewers: 0 }
    bucket.count += 1
    bucket.viewers += row.viewers
    totals.set(category, bucket)
  }

  for (const name of sessionCategoriesInRange(sessions, from, now)) {
    const bucket = totals.get(name) ?? { count: 0, viewers: 0 }
    bucket.count += 1
    totals.set(name, bucket)
  }

  const grand = [...totals.values()].reduce((sum, row) => sum + row.count, 0) || 1
  return [...totals.entries()]
    .map(([category, stats]) => ({
      category,
      snapshots: stats.count,
      avgViewers: stats.count && stats.viewers ? Math.round(stats.viewers / stats.count) : 0,
      sharePct: Math.round((stats.count / grand) * 1000) / 10,
    }))
    .sort((a, b) => b.snapshots - a.snapshots)
}

export function filterTalentData<T extends { login: string }>(rows: T[], login: string): T[] {
  return filterByLogin(rows, login)
}

export function formatHours(value: number): string {
  if (value >= 100) return `${Math.round(value).toLocaleString('es-MX')} h`
  return `${value.toLocaleString('es-MX', { maximumFractionDigits: 1 })} h`
}

export function formatCompact(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toLocaleString('es-MX')
}

export function formatDeltaBadge(value: number, pct: number | null): string {
  if (pct == null) {
    const sign = value >= 0 ? '+' : ''
    return `${sign}${value.toLocaleString('es-MX')}`
  }
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toLocaleString('es-MX')} (${sign}${pct.toFixed(1)}%)`
}

export function metricSourceBadge(source: ExternalStatsSource | undefined): string | null {
  if (!source) return null
  return externalStatsSourceLabel(source)
}
