import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '@/services/twitch'
import type { StreamSessionRecord, TalentVodRecord } from '@/services/external-stats'

export type CollectMetricsResult = {
  login: string | null
  snapshotsWritten: number
  vodsSynced: number
  ttSynced: number
  ttErrors: string[]
  streamEventsSynced: number
  collectedAt: string
  note: string
}

type RawCollectResult = {
  login?: string | null
  snapshotsWritten: number
  vodsSynced: number
  ttSynced: number
  ttErrors: string[]
  streamEventsSynced: number
  collectedAt: string
  note: string
}

type RawVod = {
  id: string
  login: string
  title?: string | null
  durationSeconds: number
  viewCount: number
  publishedAt: string
  url?: string | null
}

type RawSession = {
  id: string
  talentId: string
  login: string
  startedAt: string
  endedAt?: string | null
  peakViewers?: number | null
  categoryName?: string | null
  title?: string | null
}

function formatCollectNote(result: Omit<CollectMetricsResult, 'note'>): string {
  const target = result.login ? `@${result.login}` : 'roster completo'
  const parts = [
    `${result.snapshotsWritten} capturas guardadas`,
    result.vodsSynced > 0 ? `${result.vodsSynced} repeticiones` : null,
    result.ttSynced > 0 ? `${result.ttSynced} filas de estadísticas externas` : null,
    result.streamEventsSynced > 0 ? `${result.streamEventsSynced} eventos de transmisión` : null,
  ].filter(Boolean)
  return `Datos actualizados (${target}): ${parts.join(' · ')}.`
}

export async function collectTalentMetrics(login?: string): Promise<CollectMetricsResult> {
  if (!isTauri) {
    throw new Error('Recolectar métricas requiere la app de escritorio NeuraGest.')
  }
  const result = await invoke<RawCollectResult>('collect_talent_metrics', { login: login ?? null })
  const mapped = {
    login: result.login ?? null,
    snapshotsWritten: result.snapshotsWritten,
    vodsSynced: result.vodsSynced,
    ttSynced: result.ttSynced,
    ttErrors: result.ttErrors,
    streamEventsSynced: result.streamEventsSynced,
    collectedAt: result.collectedAt,
  }
  return {
    ...mapped,
    note: formatCollectNote(mapped),
  }
}

export async function fetchTalentVods(login: string, days = 30): Promise<TalentVodRecord[]> {
  if (!isTauri) return []
  const rows = await invoke<RawVod[]>('fetch_talent_vods', { login, days })
  return rows.map((row) => ({
    id: row.id,
    login: row.login,
    title: row.title ?? null,
    durationSeconds: row.durationSeconds,
    viewCount: row.viewCount,
    publishedAt: row.publishedAt,
    url: row.url ?? null,
  }))
}

export async function fetchRosterVods(logins: string[], days = 30): Promise<TalentVodRecord[]> {
  if (!isTauri || logins.length === 0) return []
  const batches = await Promise.all(logins.map((login) => fetchTalentVods(login, days)))
  const seen = new Set<string>()
  return batches.flat().filter((vod) => {
    if (seen.has(vod.id)) return false
    seen.add(vod.id)
    return true
  })
}

export async function fetchStreamSessions(hours = 8760, login?: string): Promise<StreamSessionRecord[]> {
  if (!isTauri) return []
  const rows = await invoke<RawSession[]>('fetch_stream_sessions', { hours, login: login ?? null })
  return rows.map((row) => ({
    id: row.id,
    talentId: row.talentId,
    login: row.login,
    startedAt: row.startedAt,
    endedAt: row.endedAt ?? null,
    peakViewers: row.peakViewers ?? null,
    categoryName: row.categoryName ?? null,
    title: row.title ?? null,
  }))
}
