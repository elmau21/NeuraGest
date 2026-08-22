import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '@/services/twitch'

export type RateCardCategory = 'stream' | 'clip' | 'integration' | 'package' | 'other'

export type RateCardItem = {
  id: string
  talentId: string
  talentLogin?: string
  talentDisplayName?: string
  label: string
  category: RateCardCategory
  unitPrice: number
  currency: string
  notes?: string
  isActive: boolean
  position: number
}

export const RATE_CARD_CATEGORY_LABELS: Record<RateCardCategory, string> = {
  stream: 'Stream',
  clip: 'Clip / VOD',
  integration: 'Integración',
  package: 'Paquete',
  other: 'Otro',
}

function requireTauri() {
  if (!isTauri) throw new Error('Este módulo requiere la app de escritorio con sesión de Twitch.')
}

export async function listRateCards(talentId?: string): Promise<RateCardItem[]> {
  requireTauri()
  return invoke<RateCardItem[]>('list_rate_cards', { talentId: talentId ?? null })
}

export async function saveRateCard(input: {
  id?: string
  talentId: string
  label: string
  category: RateCardCategory
  unitPrice: number
  currency?: string
  notes?: string
  isActive?: boolean
  position?: number
}): Promise<RateCardItem> {
  requireTauri()
  return invoke<RateCardItem>('save_rate_card', {
    id: input.id ?? null,
    talentId: input.talentId,
    label: input.label,
    category: input.category,
    unitPrice: input.unitPrice,
    currency: input.currency ?? 'MXN',
    notes: input.notes ?? null,
    isActive: input.isActive ?? true,
    position: input.position ?? 0,
  })
}

export async function deleteRateCard(id: string): Promise<void> {
  requireTauri()
  return invoke('delete_rate_card', { id })
}

export type PitchExportInput = {
  talentDisplayName: string
  talentLogin: string
  followers?: number
  category?: string
  items: RateCardItem[]
  orgName?: string
}

function pitchHtml(input: PitchExportInput): string {
  const { talentDisplayName, talentLogin, followers, category, items, orgName = 'NeuraLive' } = input
  const active = items.filter((i) => i.isActive)
  const rows = active.map((item) => `
    <tr>
      <td>${RATE_CARD_CATEGORY_LABELS[item.category]}</td>
      <td>${item.label}</td>
      <td style="text-align:right;font-weight:600">${item.unitPrice.toLocaleString('es-MX', { style: 'currency', currency: item.currency })}</td>
      <td>${item.notes ?? ''}</td>
    </tr>`).join('')
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"/><title>Pitch — ${talentDisplayName}</title>
<style>
  body{font-family:system-ui,sans-serif;background:#0f0f12;color:#e4e4e7;margin:0;padding:40px}
  .wrap{max-width:720px;margin:0 auto;background:#17171c;border:1px solid #2b2b34;border-radius:12px;padding:32px}
  h1{margin:0 0 4px;font-size:28px} .sub{color:#9ca3af;font-size:14px;margin-bottom:24px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{padding:10px 12px;border-bottom:1px solid #2b2b34;text-align:left}
  th{color:#f472e8;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
  .meta{display:flex;gap:24px;margin-bottom:20px;font-size:13px;color:#d4d4d8}
  footer{margin-top:28px;font-size:11px;color:#6b7280}
</style></head><body><div class="wrap">
  <h1>${talentDisplayName}</h1>
  <p class="sub">@${talentLogin} · Rate card comercial · ${orgName}</p>
  <div class="meta">
    ${followers ? `<span>Followers: ${followers.toLocaleString('es-MX')}</span>` : ''}
    ${category ? `<span>Categoría: ${category}</span>` : ''}
    <span>Generado: ${new Date().toLocaleDateString('es-MX')}</span>
  </div>
  <table><thead><tr><th>Tipo</th><th>Servicio</th><th>Tarifa</th><th>Notas</th></tr></thead><tbody>
    ${rows || '<tr><td colspan="4">Sin tarifas activas</td></tr>'}
  </tbody></table>
  <footer>NeuraGest · documento comercial interno</footer>
</div></body></html>`
}

export function downloadPitchHtml(input: PitchExportInput): void {
  const html = pitchHtml(input)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pitch-${input.talentLogin}-${new Date().toISOString().slice(0, 10)}.html`
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadPitchPdf(input: PitchExportInput): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const active = input.items.filter((i) => i.isActive)
  let y = 18
  doc.setFillColor(17, 17, 20)
  doc.rect(0, 0, 210, 297, 'F')
  doc.setTextColor(244, 244, 245)
  doc.setFontSize(20)
  doc.text('Pitch comercial', 14, y)
  y += 8
  doc.setFontSize(11)
  doc.setTextColor(156, 163, 175)
  doc.text(`${input.orgName ?? 'NeuraLive'} · ${new Date().toLocaleDateString('es-MX')}`, 14, y)
  y += 12
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(15)
  doc.text(input.talentDisplayName, 14, y)
  y += 6
  doc.setFontSize(10)
  doc.setTextColor(167, 139, 250)
  doc.text(`@${input.talentLogin}`, 14, y)
  y += 10
  doc.setTextColor(200, 200, 210)
  doc.setFontSize(11)
  doc.text('Rate card', 14, y)
  y += 8
  doc.setFontSize(9)
  for (const item of active) {
    const price = item.unitPrice.toLocaleString('es-MX', { style: 'currency', currency: item.currency })
    doc.text(`• [${RATE_CARD_CATEGORY_LABELS[item.category]}] ${item.label} — ${price}`, 18, y)
    y += 5
    if (item.notes) {
      doc.setTextColor(130, 130, 140)
      doc.text(`  ${item.notes.slice(0, 80)}`, 22, y)
      y += 5
      doc.setTextColor(200, 200, 210)
    }
    y += 2
    if (y > 270) { doc.addPage(); y = 18 }
  }
  if (active.length === 0) {
    doc.text('Sin tarifas activas.', 18, y)
  }
  doc.save(`pitch-${input.talentLogin}-${new Date().toISOString().slice(0, 10)}.pdf`)
}
