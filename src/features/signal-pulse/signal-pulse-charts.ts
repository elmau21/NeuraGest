import type { MetricSnapshot } from '@/services/metrics'
import type { ClipRecord } from '@/services/ops'
import type { WeeklyClip } from '@/services/twitch-intelligence'
import type { TwitchTrackerSnapshot } from '@/services/twitchtracker'
import type { Talent } from '@/types'

export type SeriesPoint = { time: string; viewers: number; peak?: number }
export type NamedBar = {
  name: string
  login: string
  value: number
  live?: boolean
}
export type HeatCell = {
  day: string
  dayLabel: string
  hour: number
  count: number
  avgViewers: number
}
export type TalentBreakdownRow = {
  login: string
  name: string
  live: boolean
  viewers: number
  followers: number
  ttHours: number
  ttDelta: number
  ttAvg: number
  clips7d: number
  clipViews7d: number
  liveHoursEst7d: number
  peak7d: number
}
export type SparkSeries = { t: string; v: number }[]
/** Slice simple para pie/donut (nombre + valor). */
export type ShareSlice = { name: string; value: number; key?: string }

const SNAPSHOT_MINUTES = 1
const SHARE_PALETTE = ['#e12ec4', '#a1a1aa', '#71717a', '#52525b', '#3f3f46', '#27272a']

/** Paleta Graphite para recharts Cell. */
export function shareColor(index: number): string {
  return SHARE_PALETTE[index % SHARE_PALETTE.length]!
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

function displayMap(talents: Talent[]) {
  return new Map(talents.map((t) => [t.login.toLowerCase(), t.displayName || t.login]))
}

function inLastHours(iso: string, hours: number, now: number) {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return false
  return t >= now - hours * 3600_000
}

/** Audiencia agregada por hora (24h) o por día (7d+). */
export function portfolioAudienceSeries(
  snapshots: MetricSnapshot[],
  hours = 24,
  now = Date.now(),
): SeriesPoint[] {
  const since = now - hours * 3600_000
  const byDay = hours > 36
  const buckets = new Map<string, { sum: number; n: number; peak: number }>()

  for (const snap of snapshots) {
    const t = new Date(snap.capturedAt).getTime()
    if (Number.isNaN(t) || t < since || !snap.isLive) continue
    const iso = new Date(snap.capturedAt).toISOString()
    const key = byDay ? iso.slice(0, 10) : iso.slice(0, 13) + ':00'
    const prev = buckets.get(key) ?? { sum: 0, n: 0, peak: 0 }
    buckets.set(key, {
      sum: prev.sum + snap.viewers,
      n: prev.n + 1,
      peak: Math.max(prev.peak, snap.viewers),
    })
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, value]) => ({
      time: byDay
        ? new Date(time + 'T12:00:00Z').toLocaleDateString('es-MX', {
            weekday: 'short',
            day: 'numeric',
          })
        : time.slice(11, 16),
      viewers: Math.round(value.sum / Math.max(1, value.n)),
      peak: value.peak,
    }))
}

/** Sparkline de viewers cartera (promedio live por hora). */
export function viewersSparkline(
  snapshots: MetricSnapshot[],
  hours = 24,
  now = Date.now(),
): SparkSeries {
  return portfolioAudienceSeries(snapshots, hours, now).map((p) => ({
    t: p.time,
    v: p.viewers,
  }))
}

/** Hours watched por talento (TwitchTracker latest). */
export function hoursWatchedBars(
  ttSnapshots: TwitchTrackerSnapshot[],
  talents: Talent[],
  limit = 12,
): NamedBar[] {
  const latest = latestTtByLogin(ttSnapshots)
  const names = displayMap(talents)
  const live = new Set(talents.filter((t) => t.isLive).map((t) => t.login.toLowerCase()))
  const roster = new Set(talents.map((t) => t.login.toLowerCase()))

  return [...latest.values()]
    .filter((r) => roster.has(r.login.toLowerCase()))
    .map((r) => ({
      login: r.login,
      name: names.get(r.login.toLowerCase()) ?? r.login,
      value: Math.round(r.hoursWatched),
      live: live.has(r.login.toLowerCase()),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

/** Δ followers ranking (TwitchTracker). */
export function followersDeltaBars(
  ttSnapshots: TwitchTrackerSnapshot[],
  talents: Talent[],
  limit = 12,
): NamedBar[] {
  const latest = latestTtByLogin(ttSnapshots)
  const names = displayMap(talents)
  const live = new Set(talents.filter((t) => t.isLive).map((t) => t.login.toLowerCase()))
  const roster = new Set(talents.map((t) => t.login.toLowerCase()))

  return [...latest.values()]
    .filter((r) => roster.has(r.login.toLowerCase()))
    .map((r) => ({
      login: r.login,
      name: names.get(r.login.toLowerCase()) ?? r.login,
      value: r.followersGrowth ?? 0,
      live: live.has(r.login.toLowerCase()),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

function clipsInWindow(
  weekly: WeeklyClip[],
  dbClips: ClipRecord[],
  days: number,
  now: number,
): Array<{ login: string; views: number; count: number }> {
  const since = now - days * 24 * 3600_000
  const byLogin = new Map<string, { views: number; count: number }>()

  const add = (login: string, views: number) => {
    const key = login.toLowerCase()
    if (!key) return
    const prev = byLogin.get(key) ?? { views: 0, count: 0 }
    byLogin.set(key, { views: prev.views + views, count: prev.count + 1 })
  }

  if (weekly.length > 0) {
    for (const c of weekly) {
      const t = new Date(c.createdAt).getTime()
      if (Number.isNaN(t) || t < since) continue
      add(c.login, c.viewCount || 0)
    }
  } else {
    for (const c of dbClips) {
      if (!c.publishedAt) continue
      const t = new Date(c.publishedAt).getTime()
      if (Number.isNaN(t) || t < since) continue
      add(c.talentLogin ?? c.talentId, c.viewCount || 0)
    }
  }

  return [...byLogin.entries()].map(([login, v]) => ({
    login,
    views: v.views,
    count: v.count,
  }))
}

/** Views de clips 7d por talento. */
export function clipsViewsBars(
  weekly: WeeklyClip[],
  dbClips: ClipRecord[],
  talents: Talent[],
  days = 7,
  now = Date.now(),
  limit = 12,
): NamedBar[] {
  const names = displayMap(talents)
  const live = new Set(talents.filter((t) => t.isLive).map((t) => t.login.toLowerCase()))
  const roster = new Set(talents.map((t) => t.login.toLowerCase()))

  return clipsInWindow(weekly, dbClips, days, now)
    .filter((r) => roster.has(r.login.toLowerCase()) || names.has(r.login.toLowerCase()))
    .map((r) => ({
      login: r.login,
      name: names.get(r.login.toLowerCase()) ?? r.login,
      value: r.views,
      live: live.has(r.login.toLowerCase()),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

/**
 * Heatmap de actividad: celdas día×hora con conteo de snapshots live
 * y promedio de viewers en esa celda.
 */
export function activityHeatmap(
  snapshots: MetricSnapshot[],
  days = 7,
  now = Date.now(),
): HeatCell[] {
  const since = now - days * 24 * 3600_000
  const cells = new Map<string, { count: number; sum: number }>()

  for (const snap of snapshots) {
    const t = new Date(snap.capturedAt).getTime()
    if (Number.isNaN(t) || t < since || !snap.isLive) continue
    const d = new Date(snap.capturedAt)
    const day = d.toISOString().slice(0, 10)
    const hour = d.getUTCHours()
    const key = `${day}|${hour}`
    const prev = cells.get(key) ?? { count: 0, sum: 0 }
    cells.set(key, { count: prev.count + 1, sum: prev.sum + snap.viewers })
  }

  const dayKeys: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 24 * 3600_000)
    dayKeys.push(d.toISOString().slice(0, 10))
  }

  const out: HeatCell[] = []
  for (const day of dayKeys) {
    const dayLabel = new Date(day + 'T12:00:00Z').toLocaleDateString('es-MX', {
      weekday: 'short',
      day: 'numeric',
    })
    for (let hour = 0; hour < 24; hour++) {
      const cell = cells.get(`${day}|${hour}`)
      out.push({
        day,
        dayLabel,
        hour,
        count: cell?.count ?? 0,
        avgViewers: cell ? Math.round(cell.sum / cell.count) : 0,
      })
    }
  }
  return out
}

/** Tabla compacta de breakdown por talento. */
export function talentBreakdownTable(
  talents: Talent[],
  snapshots: MetricSnapshot[],
  ttSnapshots: TwitchTrackerSnapshot[],
  weekly: WeeklyClip[],
  dbClips: ClipRecord[],
  now = Date.now(),
): TalentBreakdownRow[] {
  const latest = latestTtByLogin(ttSnapshots)
  const clips = clipsInWindow(weekly, dbClips, 7, now)
  const clipMap = new Map(clips.map((c) => [c.login.toLowerCase(), c]))

  const live7d = snapshots.filter((s) => s.isLive && inLastHours(s.capturedAt, 168, now))
  const hoursByLogin = new Map<string, number>()
  const peakByLogin = new Map<string, number>()
  for (const s of live7d) {
    const key = s.login.toLowerCase()
    hoursByLogin.set(key, (hoursByLogin.get(key) ?? 0) + SNAPSHOT_MINUTES)
    peakByLogin.set(key, Math.max(peakByLogin.get(key) ?? 0, s.viewers))
  }

  return [...talents]
    .map((t) => {
      const key = t.login.toLowerCase()
      const tt = latest.get(key)
      const clip = clipMap.get(key)
      return {
        login: t.login,
        name: t.displayName,
        live: t.isLive,
        viewers: t.isLive ? t.viewers : 0,
        followers: t.followers || 0,
        ttHours: tt ? Math.round(tt.hoursWatched) : 0,
        ttDelta: tt?.followersGrowth ?? 0,
        ttAvg: tt ? Math.round(tt.avgViewers) : 0,
        clips7d: clip?.count ?? 0,
        clipViews7d: clip?.views ?? 0,
        liveHoursEst7d: Math.round((hoursByLogin.get(key) ?? 0) / 60),
        peak7d: peakByLogin.get(key) ?? 0,
      }
    })
    .sort((a, b) => {
      if (a.live !== b.live) return a.live ? -1 : 1
      return b.followers - a.followers
    })
}

export function heatIntensity(count: number, maxCount: number): number {
  if (maxCount <= 0 || count <= 0) return 0
  return Math.min(1, count / maxCount)
}

/** Live vs offline (conteo de canales). */
export function liveOfflineShare(talents: Talent[]): ShareSlice[] {
  const live = talents.filter((t) => t.isLive).length
  const offline = Math.max(0, talents.length - live)
  return [
    { name: 'En vivo', value: live, key: 'live' },
    { name: 'Offline', value: offline, key: 'offline' },
  ].filter((s) => s.value > 0)
}

/** Distribución de idiomas del roster (top N + Otros). */
export function languageShare(talents: Talent[], limit = 5): ShareSlice[] {
  const counts = new Map<string, { label: string; value: number }>()
  for (const t of talents) {
    const raw = (t.language || '').trim()
    const key = raw ? raw.toLowerCase() : 'sin-idioma'
    const label = raw ? raw.toUpperCase() : 'Sin idioma'
    const prev = counts.get(key)
    counts.set(key, { label, value: (prev?.value ?? 0) + 1 })
  }

  const ranked = [...counts.entries()]
    .map(([key, v]) => ({ name: v.label, value: v.value, key }))
    .sort((a, b) => b.value - a.value)

  if (ranked.length <= limit) return ranked
  const head = ranked.slice(0, limit - 1)
  const rest = ranked.slice(limit - 1).reduce((s, r) => s + r.value, 0)
  return [...head, { name: 'Otros', value: rest, key: 'other' }]
}

/** Share de hours watched TT por talento (top N + resto). */
export function hoursWatchedShare(
  ttSnapshots: TwitchTrackerSnapshot[],
  talents: Talent[],
  limit = 5,
): ShareSlice[] {
  const bars = hoursWatchedBars(ttSnapshots, talents, 50)
  if (bars.length === 0) return []
  if (bars.length <= limit) {
    return bars.map((b) => ({ name: b.name, value: b.value, key: b.login }))
  }
  const head = bars.slice(0, limit - 1)
  const rest = bars.slice(limit - 1).reduce((s, b) => s + b.value, 0)
  return [
    ...head.map((b) => ({ name: b.name, value: b.value, key: b.login })),
    { name: 'Resto', value: rest, key: 'rest' },
  ]
}

/**
 * Activos vs inactivos en 7d (al menos un snapshot live).
 * Útil para progress ring / donut de actividad.
 */
export function activityShare7d(
  talents: Talent[],
  snapshots: MetricSnapshot[],
  now = Date.now(),
): ShareSlice[] {
  const live7d = snapshots.filter((s) => s.isLive && inLastHours(s.capturedAt, 168, now))
  const active = new Set(live7d.map((s) => s.login.toLowerCase()))
  const roster = talents.map((t) => t.login.toLowerCase())
  const activeCount = roster.filter((l) => active.has(l)).length
  const inactive = Math.max(0, roster.length - activeCount)
  return [
    { name: 'Con señal 7d', value: activeCount, key: 'active' },
    { name: 'Sin señal 7d', value: inactive, key: 'inactive' },
  ].filter((s) => s.value > 0)
}

/** % 0–100 para anillo de progreso (actividad 7d). */
export function activityPctFromShare(slices: ShareSlice[]): number {
  const active = slices.find((s) => s.key === 'active')?.value ?? 0
  const total = slices.reduce((s, x) => s + x.value, 0)
  if (total <= 0) return 0
  return Math.round((active / total) * 100)
}
