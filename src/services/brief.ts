import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '@/services/twitch'
import type { SponsorshipDeal, DbTalent } from '@/services/agency'

export type CampaignBrief = {
  id: string
  dealId?: string
  title: string
  brandName?: string
  talentIds: string[]
  talentLogins?: string[]
  objectives?: string
  deliverables?: string
  startDate?: string
  endDate?: string
  kpiNotes?: string
  timelineNotes?: string
  extraNotes?: string
  createdAt: string
  updatedAt: string
}

function requireTauri() {
  if (!isTauri) throw new Error('Este módulo requiere la app de escritorio con sesión de Twitch.')
}

export async function listCampaignBriefs(): Promise<CampaignBrief[]> {
  requireTauri()
  return invoke<CampaignBrief[]>('list_campaign_briefs')
}

export async function saveCampaignBrief(input: {
  id?: string
  dealId?: string
  title: string
  brandName?: string
  talentIds?: string[]
  objectives?: string
  deliverables?: string
  startDate?: string
  endDate?: string
  kpiNotes?: string
  timelineNotes?: string
  extraNotes?: string
}): Promise<CampaignBrief> {
  requireTauri()
  return invoke<CampaignBrief>('save_campaign_brief', {
    id: input.id ?? null,
    dealId: input.dealId ?? null,
    title: input.title,
    brandName: input.brandName ?? null,
    talentIds: input.talentIds ?? [],
    objectives: input.objectives ?? null,
    deliverables: input.deliverables ?? null,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    kpiNotes: input.kpiNotes ?? null,
    timelineNotes: input.timelineNotes ?? null,
    extraNotes: input.extraNotes ?? null,
  })
}

export async function deleteCampaignBrief(id: string): Promise<void> {
  requireTauri()
  return invoke('delete_campaign_brief', { id })
}

export function briefFromDeal(deal: SponsorshipDeal, talents: DbTalent[]): Omit<CampaignBrief, 'id' | 'createdAt' | 'updatedAt'> {
  const talent = deal.talentId ? talents.find((t) => t.id === deal.talentId) : undefined
  return {
    dealId: deal.id,
    title: `Brief — ${deal.brandName}`,
    brandName: deal.brandName,
    talentIds: deal.talentId ? [deal.talentId] : [],
    talentLogins: talent ? [talent.login] : deal.talentLogin ? [deal.talentLogin] : [],
    objectives: `Campaña de patrocinio con ${deal.brandName}.`,
    deliverables: deal.deliverables ?? '',
    startDate: deal.startDate,
    endDate: deal.endDate,
    kpiNotes: deal.notes ?? '',
    timelineNotes: deal.startDate && deal.endDate
      ? `Ventana: ${deal.startDate} → ${deal.endDate}`
      : undefined,
    extraNotes: `Valor deal: ${deal.dealValue?.toLocaleString('es-MX') ?? '—'} ${deal.currency} · Progreso ${deal.progressPercent}%`,
  }
}

export type BriefDocInput = {
  title: string
  brandName?: string
  talentNames: string[]
  objectives?: string
  deliverables?: string
  startDate?: string
  endDate?: string
  kpiNotes?: string
  timelineNotes?: string
  extraNotes?: string
}

function briefHtml(input: BriefDocInput): string {
  const section = (label: string, value?: string) =>
    value?.trim()
      ? `<section><h2>${label}</h2><p>${value.replace(/\n/g, '<br/>')}</p></section>`
      : ''
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"/><title>${input.title}</title>
<style>
  body{font-family:Georgia,serif;background:#fafafa;color:#18181b;margin:0;padding:48px}
  article{max-width:680px;margin:0 auto;background:#fff;border:1px solid #e4e4e7;border-radius:8px;padding:40px}
  h1{font-size:26px;margin:0 0 8px} .meta{color:#71717a;font-size:14px;margin-bottom:28px}
  h2{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#7c3aed;margin:24px 0 8px}
  p{line-height:1.65;font-size:15px;margin:0}
  ul{margin:8px 0;padding-left:20px}
</style></head><body><article>
  <h1>${input.title}</h1>
  <p class="meta">${input.brandName ?? 'Marca'} · Talentos: ${input.talentNames.join(', ') || '—'} · ${new Date().toLocaleDateString('es-MX')}</p>
  ${section('Objetivos', input.objectives)}
  ${section('Entregables', input.deliverables)}
  ${section('Fechas', input.startDate || input.endDate ? `${input.startDate ?? '—'} → ${input.endDate ?? '—'}` : undefined)}
  ${section('KPIs', input.kpiNotes)}
  ${section('Timeline', input.timelineNotes)}
  ${section('Notas adicionales', input.extraNotes)}
</article></body></html>`
}

export function downloadBriefHtml(input: BriefDocInput): void {
  const html = briefHtml(input)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const slug = (input.brandName ?? input.title).replace(/[^a-z0-9_-]/gi, '').slice(0, 30)
  a.href = url
  a.download = `brief-${slug}-${new Date().toISOString().slice(0, 10)}.html`
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadBriefPdf(input: BriefDocInput): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  let y = 20
  const line = (text: string, size = 10, color: [number, number, number] = [30, 30, 35]) => {
    doc.setFontSize(size)
    doc.setTextColor(...color)
    const lines = doc.splitTextToSize(text, 180)
    for (const l of lines) {
      if (y > 275) { doc.addPage(); y = 20 }
      doc.text(l, 14, y)
      y += size * 0.45 + 2
    }
  }
  line(input.title, 18, [17, 17, 20])
  y += 4
  line(`${input.brandName ?? ''} · ${input.talentNames.join(', ')} · ${new Date().toLocaleDateString('es-MX')}`, 9, [100, 100, 110])
  y += 6
  const blocks: [string, string | undefined][] = [
    ['Objetivos', input.objectives],
    ['Entregables', input.deliverables],
    ['Fechas', input.startDate || input.endDate ? `${input.startDate ?? '—'} → ${input.endDate ?? '—'}` : undefined],
    ['KPIs', input.kpiNotes],
    ['Timeline', input.timelineNotes],
    ['Notas', input.extraNotes],
  ]
  for (const [label, value] of blocks) {
    if (!value?.trim()) continue
    line(label, 11, [124, 58, 237])
    line(value, 10)
    y += 4
  }
  const slug = (input.brandName ?? input.title).replace(/[^a-z0-9_-]/gi, '').slice(0, 30)
  doc.save(`brief-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`)
}
