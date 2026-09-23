import type { MetricSnapshot } from '@/services/metrics'
import type { Talent } from '@/types'
import type { ClipRecord } from '@/services/ops'
import type { WeeklyClip } from '@/services/twitch-intelligence'
import type { TwitchTrackerSnapshot } from '@/services/twitchtracker'
import {
  aggregateInstagramPortfolio,
  type InstagramMonthlySnapshot,
} from '@/services/instagram-monthly'

/** Intervalo típico de captura Helix en la app (~60s). */
const SNAPSHOT_MINUTES = 1

export type PortfolioOpsKpis = {
  /** Suma followers Twitch (Helix / talents). */
  totalFollowers: number
  /** totalFollowers + igFollowers (alcance combinado). */
  combinedFollowers: number
  ttAvgViewers: number
  ttHoursWatched: number
  ttFollowersGrowth: number
  ttChannels: number
  clips7d: number
  clipsViewCount7d: number
  peakViewers7d: number
  peakViewers24h: number
  streamDays7d: number
  /** Horas de señal live estimadas (snapshots live × ~1 min). */
  estimatedLiveHours7d: number
  /** % de talentos con al menos un snapshot live en 7d. */
  activityPct7d: number
  activeTalents7d: number
  languages: number
  uniqueTags: number
  cclCount: number
  /** Suma followers IG del snapshot mensual de cartera. */
  igFollowers: number
  igHandles: number
  igSnapshotMonth: string | null
}

function latestTtByLogin(rows: TwitchTrackerSnapshot[]) {
  const map = new Map<string, TwitchTrackerSnapshot>()
  const sorted = [...rows].sort(
    (a, b) => new Date(b.syncedAt).getTime() - new Date(a.syncedAt).getTime(),
  )
  for (const row of sorted) {
    const key = row.login.toLowerCase()
    if (!map.has(key)) map.set(key, row)
  }
  return map
}

function inLastHours(iso: string, hours: number, now = Date.now()) {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return false
  return t >= now - hours * 3600_000
}

/** Cuenta clips publicados en los últimos `days` (Helix weekly o DB). */
export function countClipsInWindow(
  weekly: WeeklyClip[],
  dbClips: ClipRecord[],
  days = 7,
  now = Date.now(),
): { count: number; viewCount: number } {
  const since = now - days * 24 * 3600_000
  if (weekly.length > 0) {
    const inWindow = weekly.filter((c) => {
      const t = new Date(c.createdAt).getTime()
      return !Number.isNaN(t) && t >= since
    })
    return {
      count: inWindow.length,
      viewCount: inWindow.reduce((s, c) => s + (c.viewCount || 0), 0),
    }
  }
  const inWindow = dbClips.filter((c) => {
    if (!c.publishedAt) return false
    const t = new Date(c.publishedAt).getTime()
    return !Number.isNaN(t) && t >= since
  })
  return {
    count: inWindow.length,
    viewCount: inWindow.reduce((s, c) => s + (c.viewCount || 0), 0),
  }
}

export function buildPortfolioOpsKpis(input: {
  talents: Talent[]
  snapshots: MetricSnapshot[]
  ttSnapshots: TwitchTrackerSnapshot[]
  weeklyClips: WeeklyClip[]
  dbClips: ClipRecord[]
  igSnapshots?: InstagramMonthlySnapshot[]
  now?: number
}): PortfolioOpsKpis {
  const now = input.now ?? Date.now()
  const { talents, snapshots } = input

  const totalFollowers = talents.reduce((sum, t) => sum + (t.followers || 0), 0)
  const ig = aggregateInstagramPortfolio(input.igSnapshots ?? [])

  const latest = latestTtByLogin(input.ttSnapshots)
  const ttRows = [...latest.values()].filter((row) =>
    talents.some((t) => t.login.toLowerCase() === row.login.toLowerCase()),
  )
  const ttAvgViewers = ttRows.length
    ? Math.round(ttRows.reduce((s, r) => s + r.avgViewers, 0) / ttRows.length)
    : 0
  const ttHoursWatched = ttRows.reduce((s, r) => s + r.hoursWatched, 0)
  const ttFollowersGrowth = ttRows.reduce((s, r) => s + (r.followersGrowth ?? 0), 0)

  const clips = countClipsInWindow(input.weeklyClips, input.dbClips, 7, now)

  const live7d = snapshots.filter((s) => s.isLive && inLastHours(s.capturedAt, 168, now))
  const live24h = snapshots.filter((s) => s.isLive && inLastHours(s.capturedAt, 24, now))
  const peakViewers7d = live7d.reduce((max, s) => Math.max(max, s.viewers), 0)
  const peakViewers24h = live24h.reduce((max, s) => Math.max(max, s.viewers), 0)
  const streamDays7d = new Set(
    live7d.map((s) => new Date(s.capturedAt).toISOString().slice(0, 10)),
  ).size
  const estimatedLiveHours7d = Math.round((live7d.length * SNAPSHOT_MINUTES) / 60)

  const activeLogins = new Set(live7d.map((s) => s.login.toLowerCase()))
  const rosterLogins = new Set(talents.map((t) => t.login.toLowerCase()))
  const activeTalents7d = [...activeLogins].filter((l) => rosterLogins.has(l)).length
  const activityPct7d =
    talents.length > 0 ? Math.round((activeTalents7d / talents.length) * 100) : 0

  const languages = new Set(
    talents.map((t) => (t.language || '').trim().toLowerCase()).filter(Boolean),
  ).size
  const uniqueTags = new Set(
    talents.flatMap((t) => (t.tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean)),
  ).size
  const cclCount = new Set(
    talents.flatMap((t) =>
      (t.contentClassificationLabels ?? []).map((l) => l.trim().toLowerCase()).filter(Boolean),
    ),
  ).size

  return {
    totalFollowers,
    combinedFollowers: totalFollowers + ig.followers,
    ttAvgViewers,
    ttHoursWatched,
    ttFollowersGrowth,
    ttChannels: ttRows.length,
    clips7d: clips.count,
    clipsViewCount7d: clips.viewCount,
    peakViewers7d,
    peakViewers24h,
    streamDays7d,
    estimatedLiveHours7d,
    activityPct7d,
    activeTalents7d,
    languages,
    uniqueTags,
    cclCount,
    igFollowers: ig.followers,
    igHandles: ig.handles,
    igSnapshotMonth: ig.month,
  }
}
