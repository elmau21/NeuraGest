import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '@/services/twitch'

export type TwitchTrackerSnapshot = {
  id: number
  talentId: string
  login: string
  periodDays: number
  rank: number | null
  avgViewers: number
  maxViewers: number
  minutesStreamed: number
  hoursWatched: number
  followersGrowth: number | null
  followersTotal: number | null
  syncedAt: string
}

export type TwitchTrackerSyncResult = {
  synced: number
  skipped: number
  errors: string[]
  syncedAt: string
  note: string
}

export type TwitchTrackerSyncStatus = {
  lastSyncAt: string | null
  lastSyncedCount: number
  lastErrorCount: number
  lastErrors: string[]
  totalSnapshots: number
}

type RawSnapshot = {
  id: number
  talentId: string
  login: string
  periodDays: number
  rank?: number | null
  avgViewers: number
  maxViewers: number
  minutesStreamed: number
  hoursWatched: number
  followersGrowth?: number | null
  followersTotal?: number | null
  syncedAt: string
}

function mapSnapshot(row: RawSnapshot): TwitchTrackerSnapshot {
  return {
    id: row.id,
    talentId: row.talentId,
    login: row.login,
    periodDays: row.periodDays,
    rank: row.rank ?? null,
    avgViewers: row.avgViewers,
    maxViewers: row.maxViewers,
    minutesStreamed: row.minutesStreamed,
    hoursWatched: row.hoursWatched,
    followersGrowth: row.followersGrowth ?? null,
    followersTotal: row.followersTotal ?? null,
    syncedAt: row.syncedAt,
  }
}

export async function syncTwitchTracker(): Promise<TwitchTrackerSyncResult> {
  if (!isTauri) throw new Error('Sincronizar estadísticas externas requiere la app de escritorio.')
  return invoke<TwitchTrackerSyncResult>('sync_twitchtracker')
}

export async function fetchTwitchTrackerSnapshots(hours = 720): Promise<TwitchTrackerSnapshot[]> {
  if (!isTauri) return []
  const rows = await invoke<RawSnapshot[]>('fetch_twitchtracker_snapshots', { hours })
  return rows.map(mapSnapshot)
}

export async function fetchTwitchTrackerSyncStatus(): Promise<TwitchTrackerSyncStatus | null> {
  if (!isTauri) return null
  return invoke<TwitchTrackerSyncStatus>('twitchtracker_sync_status')
}

export const TWITCHTRACKER_DISCLAIMER =
  'Resúmenes históricos externos (~30 días por canal). Datos agregados de la plataforma.'

/** Endpoint verificado: resumen rolling ~30 días por login exacto de Twitch. */
export const TWITCHTRACKER_SUMMARY_ENDPOINT = '/api/channels/summary/{login}'

export const TWITCHTRACKER_API_DOCS = 'https://twitchtracker.com/api'
