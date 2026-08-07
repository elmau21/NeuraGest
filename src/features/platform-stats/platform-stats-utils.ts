import { startOfWeek, subDays, subWeeks } from 'date-fns'
import type { MetricSnapshot } from '@/services/metrics'
import { snapshotsInRange } from '@/services/metrics'

const number = new Intl.NumberFormat('es-MX')
const shortDate = new Intl.DateTimeFormat('es-MX', { month: 'short', day: 'numeric' })
const shortDateTime = new Intl.DateTimeFormat('es-MX', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export const ROSTER_SIZE = 10
export const SNAPSHOT_INTERVAL_MIN = 1

export type SnapshotBatch = {
  capturedAt: string
  ts: number
  totalViewers: number
  liveCount: number
  rows: MetricSnapshot[]
}

export type PlatformKpis = {
  liveViewersNow: number
  liveChannelsNow: number
  avg7dRosterViewers: number
  avg7dActiveChannels: number
  snapshotBatches7d: number
  hasEnoughData: boolean
}

export type ViewershipPoint = {
  at: string
  ts: number
  viewers: number
  liveCount: number
  ratio: number | null
}

export type GrowthComparison = {
  thisWeekAvg: number
  lastWeekAvg: number
  weekDelta: number
  weekDeltaPct: number
  thisMonthAvg: number
  lastMonthAvg: number
  monthDelta: number
  monthDeltaPct: number
  hasWeekData: boolean
  hasMonthData: boolean
}

export type CategoryStat = {
  category: string
  snapshots: number
  avgViewers: number
  sharePct: number
}

export type PeriodTotal = {
  key: string
  label: string
  avgCcv: number
  peakCcv: number
  avgLiveCount: number
  peakLiveCount: number
  hoursWatched: number
  snapshotBatches: number
}

export type TalentCompareRow = {
  login: string
  displayName: string
  avgViewers: number
  peakViewers: number
  liveSnapshots: number
  streamDays: number
  liveRatePct: number
}

function batchKey(capturedAt: string) {
  return capturedAt.slice(0, 16)
}

export function groupSnapshotBatches(snapshots: MetricSnapshot[]): SnapshotBatch[] {
  const map = new Map<string, MetricSnapshot[]>()
  for (const row of snapshots) {
    const key = batchKey(row.capturedAt)
    const bucket = map.get(key) ?? []
    bucket.push(row)
    map.set(key, bucket)
  }

  return [...map.entries()]
    .map(([capturedAt, rows]) => {
      const liveRows = rows.filter((row) => row.isLive)
      const totalViewers = liveRows.reduce((sum, row) => sum + row.viewers, 0)
      const ts = new Date(capturedAt).getTime()
      return {
        capturedAt,
        ts,
        totalViewers,
        liveCount: liveRows.length,
        rows,
      }
    })
    .sort((a, b) => a.ts - b.ts)
}

function downsample<T>(rows: T[], maxPoints: number) {
  if (rows.length <= maxPoints) return rows
  const step = Math.ceil(rows.length / maxPoints)
  return rows.filter((_, index) => index % step === 0 || index === rows.length - 1)
}

export function buildViewershipSeries(
  snapshots: MetricSnapshot[],
  maxPoints = 180,
): ViewershipPoint[] {
  const batches = groupSnapshotBatches(snapshots)
  const sampled = downsample(batches, maxPoints)
  return sampled.map((batch) => ({
    at: shortDateTime.format(new Date(batch.ts)),
    ts: batch.ts,
    viewers: batch.totalViewers,
    liveCount: batch.liveCount,
    ratio: batch.liveCount > 0 ? Math.round(batch.totalViewers / batch.liveCount) : null,
  }))
}

export function buildDailyRatioSeries(snapshots: MetricSnapshot[]): ViewershipPoint[] {
  const batches = groupSnapshotBatches(snapshots)
  const byDay = new Map<string, { viewers: number[]; live: number[]; ts: number }>()

  for (const batch of batches) {
    const dayKey = new Date(batch.ts).toISOString().slice(0, 10)
    const bucket = byDay.get(dayKey) ?? { viewers: [], live: [], ts: batch.ts }
    bucket.viewers.push(batch.totalViewers)
    bucket.live.push(batch.liveCount)
    bucket.ts = batch.ts
    byDay.set(dayKey, bucket)
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, bucket]) => {
      const avgViewers = bucket.viewers.length
        ? Math.round(bucket.viewers.reduce((a, b) => a + b, 0) / bucket.viewers.length)
        : 0
      const avgLive = bucket.live.length
        ? Math.round(bucket.live.reduce((a, b) => a + b, 0) / bucket.live.length)
        : 0
      return {
        at: shortDate.format(new Date(day)),
        ts: new Date(day).getTime(),
        viewers: avgViewers,
        liveCount: avgLive,
        ratio: avgLive > 0 ? Math.round(avgViewers / avgLive) : null,
      }
    })
}

function avgBatchMetric(batches: SnapshotBatch[], pick: (batch: SnapshotBatch) => number) {
  if (!batches.length) return 0
  const sum = batches.reduce((acc, batch) => acc + pick(batch), 0)
  return Math.round(sum / batches.length)
}

export function computePlatformKpis(
  snapshots: MetricSnapshot[],
  liveViewersNow: number,
  liveChannelsNow: number,
): PlatformKpis {
  const since = subDays(new Date(), 7)
  const recent = snapshots.filter((row) => new Date(row.capturedAt) >= since)
  const batches = groupSnapshotBatches(recent)

  return {
    liveViewersNow,
    liveChannelsNow,
    avg7dRosterViewers: avgBatchMetric(batches, (b) => b.totalViewers),
    avg7dActiveChannels: avgBatchMetric(batches, (b) => b.liveCount),
    snapshotBatches7d: batches.length,
    hasEnoughData: batches.length >= 12,
  }
}

function periodAvg(batches: SnapshotBatch[]) {
  return avgBatchMetric(batches, (b) => b.totalViewers)
}

export function buildGrowthComparison(snapshots: MetricSnapshot[]): GrowthComparison {
  const now = new Date()
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 })
  const lastWeekStart = subWeeks(thisWeekStart, 1)
  const thisMonthStart = subDays(now, 30)
  const lastMonthStart = subDays(now, 60)
  const lastMonthEnd = subDays(now, 30)

  const allBatches = groupSnapshotBatches(snapshots)
  const thisWeek = allBatches.filter((b) => b.ts >= thisWeekStart.getTime())
  const lastWeek = allBatches.filter((b) => b.ts >= lastWeekStart.getTime() && b.ts < thisWeekStart.getTime())
  const thisMonth = allBatches.filter((b) => b.ts >= thisMonthStart.getTime())
  const lastMonth = allBatches.filter(
    (b) => b.ts >= lastMonthStart.getTime() && b.ts < lastMonthEnd.getTime(),
  )

  const thisWeekAvg = periodAvg(thisWeek)
  const lastWeekAvg = periodAvg(lastWeek)
  const weekDelta = thisWeekAvg - lastWeekAvg
  const weekDeltaPct = lastWeekAvg > 0 ? ((thisWeekAvg - lastWeekAvg) / lastWeekAvg) * 100 : thisWeekAvg > 0 ? 100 : 0

  const thisMonthAvg = periodAvg(thisMonth)
  const lastMonthAvg = periodAvg(lastMonth)
  const monthDelta = thisMonthAvg - lastMonthAvg
  const monthDeltaPct = lastMonthAvg > 0
    ? ((thisMonthAvg - lastMonthAvg) / lastMonthAvg) * 100
    : thisMonthAvg > 0 ? 100 : 0

  return {
    thisWeekAvg,
    lastWeekAvg,
    weekDelta,
    weekDeltaPct,
    thisMonthAvg,
    lastMonthAvg,
    monthDelta,
    monthDeltaPct,
    hasWeekData: thisWeek.length >= 3 && lastWeek.length >= 3,
    hasMonthData: thisMonth.length >= 10 && lastMonth.length >= 10,
  }
}

export function buildCategoryDistribution(snapshots: MetricSnapshot[]): CategoryStat[] {
  const liveRows = snapshots.filter((row) => row.isLive && row.category && row.category !== 'Offline')
  const totals = new Map<string, { count: number; viewers: number }>()

  for (const row of liveRows) {
    const category = row.category!.trim()
    const bucket = totals.get(category) ?? { count: 0, viewers: 0 }
    bucket.count += 1
    bucket.viewers += row.viewers
    totals.set(category, bucket)
  }

  const grand = liveRows.length || 1
  return [...totals.entries()]
    .map(([category, stats]) => ({
      category,
      snapshots: stats.count,
      avgViewers: stats.count ? Math.round(stats.viewers / stats.count) : 0,
      sharePct: Math.round((stats.count / grand) * 1000) / 10,
    }))
    .sort((a, b) => b.snapshots - a.snapshots)
}

function estimateHoursWatched(batches: SnapshotBatch[]) {
  if (batches.length < 2) {
    return batches.length === 1 ? (batches[0].totalViewers * SNAPSHOT_INTERVAL_MIN) / 60 : 0
  }
  let hours = 0
  for (let i = 1; i < batches.length; i += 1) {
    const prev = batches[i - 1]
    const curr = batches[i]
    const deltaHours = Math.max(0, (curr.ts - prev.ts) / 3_600_000)
    const avgCcv = (prev.totalViewers + curr.totalViewers) / 2
    hours += avgCcv * deltaHours
  }
  return Math.round(hours)
}

export function buildPeriodTotals(
  snapshots: MetricSnapshot[],
  granularity: 'day' | 'week' = 'day',
): PeriodTotal[] {
  const batches = groupSnapshotBatches(snapshots)
  const groups = new Map<string, SnapshotBatch[]>()

  for (const batch of batches) {
    const date = new Date(batch.ts)
    const key = granularity === 'day'
      ? date.toISOString().slice(0, 10)
      : startOfWeek(date, { weekStartsOn: 1 }).toISOString().slice(0, 10)
    const bucket = groups.get(key) ?? []
    bucket.push(batch)
    groups.set(key, bucket)
  }

  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, group]) => {
      const viewers = group.map((b) => b.totalViewers)
      const liveCounts = group.map((b) => b.liveCount)
      const avgCcv = viewers.length
        ? Math.round(viewers.reduce((a, b) => a + b, 0) / viewers.length)
        : 0
      const label = granularity === 'day'
        ? shortDate.format(new Date(key))
        : `Sem. ${shortDate.format(new Date(key))}`
      return {
        key,
        label,
        avgCcv,
        peakCcv: Math.max(...viewers, 0),
        avgLiveCount: liveCounts.length
          ? Math.round(liveCounts.reduce((a, b) => a + b, 0) / liveCounts.length)
          : 0,
        peakLiveCount: Math.max(...liveCounts, 0),
        hoursWatched: estimateHoursWatched(group.sort((a, b) => a.ts - b.ts)),
        snapshotBatches: group.length,
      }
    })
}

export function buildTalentComparison(
  snapshots: MetricSnapshot[],
  displayNames: Record<string, string>,
  days = 7,
): TalentCompareRow[] {
  const since = subDays(new Date(), days)
  const recent = snapshots.filter((row) => new Date(row.capturedAt) >= since)
  const logins = [...new Set(recent.map((row) => row.login))]

  return logins.map((login) => {
    const rows = recent.filter((row) => row.login === login)
    const liveRows = rows.filter((row) => row.isLive)
    const avgViewers = liveRows.length
      ? Math.round(liveRows.reduce((sum, row) => sum + row.viewers, 0) / liveRows.length)
      : 0
    const peakViewers = liveRows.reduce((max, row) => Math.max(max, row.viewers), 0)
    const streamDays = new Set(
      liveRows.map((row) => new Date(row.capturedAt).toISOString().slice(0, 10)),
    ).size
    const liveRatePct = rows.length ? Math.round((liveRows.length / rows.length) * 1000) / 10 : 0
    return {
      login,
      displayName: displayNames[login] ?? login,
      avgViewers,
      peakViewers,
      liveSnapshots: liveRows.length,
      streamDays,
      liveRatePct,
    }
  }).sort((a, b) => b.avgViewers - a.avgViewers)
}

export function buildChannelActivitySeries(
  snapshots: MetricSnapshot[],
  maxPoints = 180,
): ViewershipPoint[] {
  return buildViewershipSeries(snapshots, maxPoints).map((point) => ({
    ...point,
    viewers: point.liveCount,
  }))
}

export function formatStat(value: number) {
  return number.format(value)
}

export function formatDelta(value: number, pct: number) {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${number.format(value)} (${sign}${pct.toFixed(1)}%)`
}

export function filterSnapshotsForPeriod(snapshots: MetricSnapshot[], hours: number) {
  const from = new Date(Date.now() - hours * 3_600_000)
  return snapshotsInRange(snapshots, from, new Date())
}
