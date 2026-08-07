import type { Talent } from '@/types'
import type { ClipRecord } from '@/services/ops'
import {
  buildWeeklyComparison,
  fetchMetricSnapshots,
  type MetricSnapshot,
} from '@/services/metrics'

export type MediaKitInput = {
  talent: Talent
  snapshots: MetricSnapshot[]
  clips: ClipRecord[]
  orgName?: string
}

export async function loadMediaKitData(talentLogin: string, talents: Talent[]): Promise<MediaKitInput | null> {
  const talent = talents.find((t) => t.login.toLowerCase() === talentLogin.toLowerCase())
  if (!talent) return null
  const [snapshots, clipsModule] = await Promise.all([
    fetchMetricSnapshots(168, talent.login),
    import('@/services/ops').then((m) => m.listClips(100)),
  ])
  const clips = clipsModule.filter(
    (clip) => clip.talentLogin?.toLowerCase() === talent.login.toLowerCase(),
  )
  return { talent, snapshots, clips, orgName: 'NeuraLive' }
}

export type MediaKitStats = {
  followers: number
  avgViewers: number
  peakViewers: number
  streamDays: number
  isLive: boolean
  viewers: number
  category: string
  topClips: ClipRecord[]
}

export function computeMediaKitStats(input: MediaKitInput): MediaKitStats {
  const { talent, snapshots, clips } = input
  const weekly = buildWeeklyComparison(snapshots, { [talent.login]: talent.displayName })
  const stats = weekly[0]
  const topClips = [...clips].sort((a, b) => b.viewCount - a.viewCount).slice(0, 5)
  return {
    followers: talent.followers,
    avgViewers: stats?.thisWeek.avgViewers ?? 0,
    peakViewers: stats?.thisWeek.peakViewers ?? 0,
    streamDays: stats?.thisWeek.streamDays ?? 0,
    isLive: talent.isLive,
    viewers: talent.viewers,
    category: talent.category,
    topClips,
  }
}

async function renderMediaKitPdf(input: MediaKitInput) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const { talent, snapshots, clips, orgName = 'NeuraLive' } = input
  const weekly = buildWeeklyComparison(snapshots, { [talent.login]: talent.displayName })
  const stats = weekly[0]
  const peak = stats?.thisWeek.peakViewers ?? 0
  const avg = stats?.thisWeek.avgViewers ?? 0
  const streamDays = stats?.thisWeek.streamDays ?? 0
  const topClips = [...clips].sort((a, b) => b.viewCount - a.viewCount).slice(0, 5)

  let y = 18
  doc.setFillColor(17, 17, 20)
  doc.rect(0, 0, 210, 297, 'F')
  doc.setTextColor(244, 244, 245)
  doc.setFontSize(22)
  doc.text('Media Kit', 14, y)
  y += 8
  doc.setFontSize(11)
  doc.setTextColor(156, 163, 175)
  doc.text(`${orgName} · generado ${new Date().toLocaleDateString('es-MX')}`, 14, y)
  y += 14

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.text(talent.displayName, 14, y)
  y += 6
  doc.setFontSize(10)
  doc.setTextColor(167, 139, 250)
  doc.text(`@${talent.login} · Twitch`, 14, y)
  y += 12

  doc.setTextColor(200, 200, 210)
  doc.setFontSize(12)
  doc.text('Métricas (última semana)', 14, y)
  y += 8
  doc.setFontSize(10)
  const metrics = [
    `Followers: ${talent.followers > 0 ? talent.followers.toLocaleString('es-MX') : '—'}`,
    `Avg viewers: ${avg.toLocaleString('es-MX')}`,
    `Peak viewers: ${peak.toLocaleString('es-MX')}`,
    `Días con stream: ${streamDays}`,
    `Estado: ${talent.isLive ? `EN VIVO · ${talent.viewers.toLocaleString('es-MX')} viewers` : 'Offline'}`,
    talent.category && talent.category !== 'Offline' ? `Categoría actual: ${talent.category}` : '',
  ].filter(Boolean)
  for (const line of metrics) {
    doc.text(line, 18, y)
    y += 6
  }
  y += 6

  doc.setFontSize(12)
  doc.text('Top clips', 14, y)
  y += 8
  doc.setFontSize(9)
  if (topClips.length === 0) {
    doc.setTextColor(120, 120, 130)
    doc.text('Sin clips registrados — sincroniza clips desde Twitch.', 18, y)
    y += 8
  } else {
    for (const clip of topClips) {
      const title = clip.title ?? clip.twitchClipId
      doc.setTextColor(220, 220, 230)
      doc.text(`• ${title.slice(0, 60)}`, 18, y)
      y += 5
      doc.setTextColor(130, 130, 140)
      doc.text(`${clip.viewCount.toLocaleString('es-MX')} views${clip.url ? ` · ${clip.url}` : ''}`, 22, y)
      y += 7
      if (y > 270) {
        doc.addPage()
        doc.setFillColor(17, 17, 20)
        doc.rect(0, 0, 210, 297, 'F')
        y = 18
      }
    }
  }

  y += 4
  doc.setTextColor(100, 100, 110)
  doc.setFontSize(8)
  doc.text('Datos: Twitch + historial NeuraGest + clips. Sin servicios de pago.', 14, 285)

  return doc
}

export async function mediaKitPdfBlob(input: MediaKitInput): Promise<Blob> {
  const doc = await renderMediaKitPdf(input)
  return doc.output('blob')
}

export async function generateMediaKitPdf(input: MediaKitInput): Promise<void> {
  const doc = await renderMediaKitPdf(input)
  const slug = input.talent.login.replace(/[^a-z0-9_-]/gi, '')
  doc.save(`mediakit-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`)
}
