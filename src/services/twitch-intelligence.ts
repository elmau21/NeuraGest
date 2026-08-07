import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '@/services/twitch'

export type WeeklyClip = {
  id: string
  url: string
  login: string
  displayName: string
  title: string
  viewCount: number
  createdAt: string
  thumbnailUrl: string
  duration: number
  gameId: string
}

type RawWeeklyClip = {
  id: string
  url: string
  login: string
  displayName: string
  title: string
  viewCount: number
  createdAt: string
  thumbnailUrl: string
  duration: number
  gameId: string
}

export type StreamOfflinePayload = {
  login: string
  streamId?: string | null
  categoryName?: string | null
  title?: string | null
  occurredAt: string
}

export async function fetchWeeklyClips(): Promise<WeeklyClip[]> {
  if (!isTauri) return []
  const rows = await invoke<RawWeeklyClip[]>('fetch_weekly_clips')
  return rows.map((row) => ({
    id: row.id,
    url: row.url,
    login: row.login,
    displayName: row.displayName,
    title: row.title,
    viewCount: row.viewCount,
    createdAt: row.createdAt,
    thumbnailUrl: row.thumbnailUrl,
    duration: row.duration,
    gameId: row.gameId,
  }))
}
