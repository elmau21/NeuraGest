import type { CommissionEntry } from '@/services/ops'
import { COMMISSION_STATUS_LABELS } from '@/services/ops'

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 })

type DocKind = 'factura' | 'recibo'

async function buildCommissionPdf(entry: CommissionEntry, kind: DocKind) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const isInvoice = kind === 'factura'
  const title = isInvoice ? 'Factura de comisión' : 'Recibo de pago'
  const amount = isInvoice ? entry.agencyAmount : entry.talentAmount
  const recipient = isInvoice ? 'NeuraLive (Agencia)' : entry.talentLogin ? `@${entry.talentLogin}` : 'Talento'

  doc.setFillColor(17, 17, 20)
  doc.rect(0, 0, 210, 297, 'F')
  doc.setTextColor(244, 244, 245)
  doc.setFontSize(20)
  doc.text(title, 14, 22)
  doc.setFontSize(10)
  doc.setTextColor(156, 163, 175)
  doc.text(`NeuraGest · ${new Date().toLocaleDateString('es-MX')}`, 14, 30)
  doc.text(`Periodo: ${entry.periodMonth.slice(0, 7)}`, 14, 36)

  let y = 50
  const row = (label: string, value: string) => {
    doc.setTextColor(120, 120, 130)
    doc.text(label, 14, y)
    doc.setTextColor(230, 230, 235)
    doc.text(value, 70, y)
    y += 8
  }

  row('Concepto', entry.label)
  row('Beneficiario', recipient)
  row('Bruto deal', currency.format(entry.grossAmount))
  row('% Agencia', `${entry.agencyRatePct}%`)
  row('Comisión agencia', currency.format(entry.agencyAmount))
  row('Neto talento', currency.format(entry.talentAmount))
  row('Estado', COMMISSION_STATUS_LABELS[entry.status])
  if (entry.notes?.trim()) row('Notas', entry.notes.trim())

  y += 6
  doc.setDrawColor(60, 60, 70)
  doc.line(14, y, 196, y)
  y += 12
  doc.setFontSize(14)
  doc.setTextColor(167, 139, 250)
  doc.text(`${isInvoice ? 'Total facturado' : 'Total recibido'}: ${currency.format(amount)}`, 14, y)

  doc.setFontSize(8)
  doc.setTextColor(90, 90, 100)
  doc.text(`ID ${entry.id.slice(0, 8)}… · Generado localmente · Sin timbrado fiscal`, 14, 285)

  return doc
}

export async function downloadCommissionFactura(entry: CommissionEntry): Promise<void> {
  const doc = await buildCommissionPdf(entry, 'factura')
  const slug = entry.label.replace(/[^a-z0-9_-]/gi, '').slice(0, 24)
  doc.save(`factura-${slug}-${entry.periodMonth.slice(0, 7)}.pdf`)
}

export async function downloadCommissionRecibo(entry: CommissionEntry): Promise<void> {
  const doc = await buildCommissionPdf(entry, 'recibo')
  const slug = entry.label.replace(/[^a-z0-9_-]/gi, '').slice(0, 24)
  const talent = entry.talentLogin ?? 'talento'
  doc.save(`recibo-${talent}-${slug}-${entry.periodMonth.slice(0, 7)}.pdf`)
}

export async function commissionPdfBlob(entry: CommissionEntry, kind: DocKind): Promise<Blob> {
  const doc = await buildCommissionPdf(entry, kind)
  return doc.output('blob')
}
