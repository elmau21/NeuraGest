import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '@/services/twitch'

export type WeeklyVod = {
  id: string
  url: string
  login: string
  displayName: string
  title: string
  viewCount: number
  publishedAt: string
  thumbnailUrl: string
  durationSeconds: number
  durationLabel: string
}

export type VodSuggestion = {
  vodId: string
  login: string
  displayName: string
  title: string
  reason: string
  priority: 'high' | 'medium' | 'low'
  url: string
}

type RawWeeklyVod = {
  id: string
  url: string
  login: string
  displayName: string
  title: string
  viewCount: number
  publishedAt: string
  thumbnailUrl: string
  durationSeconds: number
  durationLabel: string
}

function parseDurationSeconds(label: string): number {
  let total = 0
  const h = label.match(/(\d+)h/)
  const m = label.match(/(\d+)m/)
  const s = label.match(/(\d+)s/)
  if (h) total += Number(h[1]) * 3600
  if (m) total += Number(m[1]) * 60
  if (s) total += Number(s[1])
  return total
}

export async function fetchWeeklyVods(): Promise<WeeklyVod[]> {
  if (!isTauri) return []
  const rows = await invoke<RawWeeklyVod[]>('fetch_weekly_vods')
  return rows.map((row) => ({
    id: row.id,
    url: row.url,
    login: row.login,
    displayName: row.displayName,
    title: row.title,
    viewCount: row.viewCount,
    publishedAt: row.publishedAt,
    thumbnailUrl: row.thumbnailUrl,
    durationSeconds: row.durationSeconds || parseDurationSeconds(row.durationLabel),
    durationLabel: row.durationLabel,
  }))
}

export function buildVodSuggestions(vods: WeeklyVod[]): VodSuggestion[] {
  if (vods.length === 0) return []
  const avgViews = vods.reduce((s, v) => s + v.viewCount, 0) / vods.length
  const suggestions: VodSuggestion[] = []

  for (const vod of vods) {
    const hours = vod.durationSeconds / 3600
    if (hours >= 2 && vod.viewCount >= avgViews * 0.5) {
      suggestions.push({
        vodId: vod.id,
        login: vod.login,
        displayName: vod.displayName,
        title: vod.title,
        reason: `VOD largo (${vod.durationLabel}) — candidato a highlights y clips cortos`,
        priority: 'high',
        url: vod.url,
      })
    } else if (vod.viewCount >= avgViews * 1.5) {
      suggestions.push({
        vodId: vod.id,
        login: vod.login,
        displayName: vod.displayName,
        title: vod.title,
        reason: `Alto rendimiento (${vod.viewCount.toLocaleString('es-MX')} views vs media ${Math.round(avgViews).toLocaleString('es-MX')})`,
        priority: 'high',
        url: vod.url,
      })
    } else if (hours >= 1 && vod.viewCount < avgViews * 0.3) {
      suggestions.push({
        vodId: vod.id,
        login: vod.login,
        displayName: vod.displayName,
        title: vod.title,
        reason: 'Bajo views — revisar título/thumbnail antes de promover',
        priority: 'medium',
        url: vod.url,
      })
    } else if (/subathon|maratón|collab|torneo/i.test(vod.title)) {
      suggestions.push({
        vodId: vod.id,
        login: vod.login,
        displayName: vod.displayName,
        title: vod.title,
        reason: 'Evento especial — archivar en pipeline y brief de contenido',
        priority: 'medium',
        url: vod.url,
      })
    }
  }

  const seen = new Set<string>()
  return suggestions
    .filter((s) => {
      const key = s.vodId
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 }
      return order[a.priority] - order[b.priority]
    })
}
