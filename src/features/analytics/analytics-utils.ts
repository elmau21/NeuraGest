import type { Talent } from '@/types'

export type AnalyticsSortKey = 'name' | 'status' | 'category' | 'viewers' | 'followers' | 'share'
export type AnalyticsSortDirection = 'asc' | 'desc'

export const analyticsNumber = new Intl.NumberFormat('es-MX')

export function viewerShare(talent: Talent, totalLiveViewers: number) {
  return talent.isLive && totalLiveViewers > 0 ? (talent.viewers / totalLiveViewers) * 100 : 0
}

export function sortTalents(
  talents: Talent[],
  key: AnalyticsSortKey,
  direction: AnalyticsSortDirection,
  totalLiveViewers: number,
) {
  const multiplier = direction === 'asc' ? 1 : -1
  return [...talents].sort((a, b) => {
    if (key === 'name') return multiplier * a.displayName.localeCompare(b.displayName, 'es')
    if (key === 'category') return multiplier * (a.category || '').localeCompare(b.category || '', 'es')
    if (key === 'status') return multiplier * (Number(a.isLive) - Number(b.isLive))
    if (key === 'share') return multiplier * (viewerShare(a, totalLiveViewers) - viewerShare(b, totalLiveViewers))
    return multiplier * (a[key] - b[key])
  })
}

function csvCell(value: string | number | boolean) {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function talentSnapshot(talents: Talent[], capturedAt: string) {
  const totalLiveViewers = talents.reduce((sum, talent) => sum + (talent.isLive ? talent.viewers : 0), 0)
  return {
    capturedAt,
    source: 'Twitch / NeuraGest',
    totals: {
      talents: talents.length,
      live: talents.filter((talent) => talent.isLive).length,
      viewers: totalLiveViewers,
      followers: talents.reduce((sum, talent) => sum + talent.followers, 0),
    },
    talents: talents.map((talent) => ({
      name: talent.displayName,
      login: talent.login,
      status: talent.isLive ? 'live' : 'offline',
      category: talent.category,
      viewers: talent.viewers,
      followers: talent.followers,
      viewerShare: Number(viewerShare(talent, totalLiveViewers).toFixed(2)),
      streamTitle: talent.title,
      streamStartedAt: talent.startedAt ?? null,
    })),
  }
}

export function snapshotCsv(talents: Talent[], capturedAt: string) {
  const snapshot = talentSnapshot(talents, capturedAt)
  const columns = ['captured_at', 'talent', 'login', 'status', 'category', 'viewers', 'followers', 'viewer_share_pct']
  const rows = snapshot.talents.map((talent) => [
    snapshot.capturedAt,
    talent.name,
    talent.login,
    talent.status,
    talent.category,
    talent.viewers,
    talent.followers,
    talent.viewerShare,
  ])
  return [columns, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')
}

export function downloadSnapshot(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
