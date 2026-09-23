import { supabase } from '@/services/supabase'

/** Handles IG de cartera Neura → login Twitch cuando existe en roster. */
export const INSTAGRAM_PORTFOLIO_HANDLES: ReadonlyArray<{
  handle: string
  twitchLogin: string | null
}> = [
  { handle: 'ascapop', twitchLogin: null },
  { handle: 'leoplushy', twitchLogin: null },
  { handle: 'shirookovt', twitchLogin: 'shirookouwu' },
]

export type InstagramMonthlySnapshot = {
  id: number
  talentId: string | null
  login: string | null
  instagramHandle: string
  followers: number
  following: number | null
  mediaCount: number | null
  views: number | null
  viewsAvailable: boolean
  source: string
  snapshotMonth: string
  syncedAt: string
}

export type InstagramPortfolioTotals = {
  month: string | null
  handles: number
  followers: number
  views: number | null
  viewsAvailable: boolean
  syncedAt: string | null
  rows: InstagramMonthlySnapshot[]
}

type DbRow = {
  id: number
  talent_id: string | null
  login: string | null
  instagram_handle: string
  followers: number
  following: number | null
  media_count: number | null
  views: number | null
  views_available: boolean
  source: string
  snapshot_month: string
  synced_at: string
}

function mapRow(row: DbRow): InstagramMonthlySnapshot {
  return {
    id: row.id,
    talentId: row.talent_id,
    login: row.login,
    instagramHandle: row.instagram_handle,
    followers: row.followers,
    following: row.following,
    mediaCount: row.media_count,
    views: row.views,
    viewsAvailable: row.views_available,
    source: row.source,
    snapshotMonth: row.snapshot_month,
    syncedAt: row.synced_at,
  }
}

/** Primer día del mes en UTC (YYYY-MM-01). */
export function currentSnapshotMonth(now = new Date()): string {
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

export function aggregateInstagramPortfolio(
  rows: InstagramMonthlySnapshot[],
  month?: string | null,
): InstagramPortfolioTotals {
  const target =
    month ??
    [...rows]
      .map((r) => r.snapshotMonth)
      .sort()
      .at(-1) ??
    null
  const filtered = target ? rows.filter((r) => r.snapshotMonth === target) : []
  const latestByHandle = new Map<string, InstagramMonthlySnapshot>()
  for (const row of [...filtered].sort(
    (a, b) => new Date(b.syncedAt).getTime() - new Date(a.syncedAt).getTime(),
  )) {
    const key = row.instagramHandle.toLowerCase()
    if (!latestByHandle.has(key)) latestByHandle.set(key, row)
  }
  const unique = [...latestByHandle.values()]
  const viewsAvailable = unique.some((r) => r.viewsAvailable && r.views != null)
  const views = viewsAvailable
    ? unique.reduce((sum, r) => sum + (r.views ?? 0), 0)
    : null
  const syncedAt =
    unique
      .map((r) => r.syncedAt)
      .sort((a, b) => b.localeCompare(a))[0] ?? null

  return {
    month: target,
    handles: unique.length,
    followers: unique.reduce((sum, r) => sum + (r.followers || 0), 0),
    views,
    viewsAvailable,
    syncedAt,
    rows: unique.sort((a, b) => b.followers - a.followers),
  }
}

export async function fetchInstagramMonthlySnapshots(
  monthsBack = 6,
): Promise<InstagramMonthlySnapshot[]> {
  if (!supabase) return []
  const since = new Date()
  since.setUTCMonth(since.getUTCMonth() - monthsBack)
  const sinceMonth = currentSnapshotMonth(since)

  const { data, error } = await supabase
    .from('instagram_monthly_snapshots')
    .select(
      'id,talent_id,login,instagram_handle,followers,following,media_count,views,views_available,source,snapshot_month,synced_at',
    )
    .gte('snapshot_month', sinceMonth)
    .order('snapshot_month', { ascending: false })
    .order('synced_at', { ascending: false })
    .limit(200)

  if (error) throw new Error(error.message)
  return (data as DbRow[] | null)?.map(mapRow) ?? []
}

export async function fetchInstagramSnapshotForLogin(
  login: string,
): Promise<InstagramMonthlySnapshot | null> {
  if (!supabase || !login) return null
  const { data, error } = await supabase
    .from('instagram_monthly_snapshots')
    .select(
      'id,talent_id,login,instagram_handle,followers,following,media_count,views,views_available,source,snapshot_month,synced_at',
    )
    .ilike('login', login)
    .order('snapshot_month', { ascending: false })
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapRow(data as DbRow) : null
}

/**
 * Sync mensual: recarga el snapshot del mes desde BD (escritura vía agente Bright Data MCP).
 * No hace polling ni scrape casero — respeta ToS usando solo Bright Data MCP.
 */
export async function syncInstagramMonthlyStatus(): Promise<InstagramPortfolioTotals> {
  const rows = await fetchInstagramMonthlySnapshots(3)
  const month = currentSnapshotMonth()
  const forMonth = aggregateInstagramPortfolio(rows, month)
  if (forMonth.handles > 0) return forMonth
  return aggregateInstagramPortfolio(rows)
}

export const INSTAGRAM_MONTHLY_DISCLAIMER =
  'Instagram cartera · snapshot mensual de followers (sin streaming continuo).'
