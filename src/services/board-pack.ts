import JSZip from 'jszip'
import type { Talent } from '@/types'
import { listCampaignBriefs, type CampaignBrief } from '@/services/brief'
import { listCommissionEntries, type CommissionEntry } from '@/services/ops'
import { loadMediaKitData, mediaKitPdfBlob } from '@/services/media-kit'
import { isTauri } from '@/services/twitch'

function monthStart(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

function addMonths(isoMonth: string, delta: number) {
  const d = new Date(`${isoMonth}T12:00:00`)
  d.setMonth(d.getMonth() + delta)
  return monthStart(d)
}

function briefText(brief: CampaignBrief): string {
  return [
    `# ${brief.title}`,
    `Marca: ${brief.brandName ?? '—'}`,
    `Talentos: ${brief.talentLogins?.join(', ') ?? '—'}`,
    `Ventana: ${brief.startDate ?? '—'} → ${brief.endDate ?? '—'}`,
    '',
    '## Objetivos',
    brief.objectives ?? '—',
    '',
    '## Entregables',
    brief.deliverables ?? '—',
    '',
    '## KPIs',
    brief.kpiNotes ?? '—',
    '',
    '## Timeline',
    brief.timelineNotes ?? '—',
    '',
    '## Notas',
    brief.extraNotes ?? '—',
  ].join('\n')
}

function forecastCsv(entries: CommissionEntry[], month: string, nextMonth: string): string {
  const header = 'periodo,concepto,talento,bruto,agencia,talento_neto,estado'
  const rows = entries.map((e) =>
    [e.periodMonth.slice(0, 7), `"${e.label.replace(/"/g, '""')}"`, e.talentLogin ?? '', e.grossAmount, e.agencyAmount, e.talentAmount, e.status].join(','),
  )
  const summary = [
    '',
    `# Forecast mes ${nextMonth.slice(0, 7)}`,
    `total_bruto,${entries.reduce((s, e) => s + e.grossAmount, 0)}`,
    `total_agencia,${entries.reduce((s, e) => s + e.agencyAmount, 0)}`,
    `total_talento,${entries.reduce((s, e) => s + e.talentAmount, 0)}`,
    `lineas_forecast,${entries.filter((e) => e.status === 'forecast').length}`,
    `mes_base,${month.slice(0, 7)}`,
  ]
  return [header, ...rows, ...summary].join('\n')
}

export type BoardPackInput = {
  talents: Talent[]
  talentLogins: string[]
  month?: string
}

export async function buildBoardPackZip(input: BoardPackInput): Promise<Blob> {
  if (!isTauri) throw new Error('El informe para directivos requiere la app de escritorio.')
  const month = input.month ?? monthStart()
  const nextMonth = addMonths(month, 1)
  const zip = new JSZip()
  const readme = zip.folder('board-pack')!

  readme.file('README.txt', [
    'NeuraGest Board Pack',
    `Generado: ${new Date().toLocaleString('es-MX')}`,
    `Mes referencia: ${month.slice(0, 7)}`,
    '',
    'Contenido:',
    '- media-kits/ — PDFs por talento',
    '- briefs/ — briefs de campaña activos',
    '- forecast/ — ledger y proyección del mes',
  ].join('\n'))

  const mediaFolder = readme.folder('media-kits')!
  for (const login of input.talentLogins) {
    const data = await loadMediaKitData(login, input.talents)
    if (!data) continue
    const blob = await mediaKitPdfBlob(data)
    mediaFolder.file(`mediakit-${login}.pdf`, blob)
  }

  const briefs = await listCampaignBriefs()
  const briefFolder = readme.folder('briefs')!
  if (briefs.length === 0) {
    briefFolder.file('sin-briefs.txt', 'No hay briefs de campaña registrados.')
  } else {
    for (const brief of briefs) {
      const slug = (brief.brandName ?? brief.title).replace(/[^a-z0-9_-]/gi, '').slice(0, 30)
      briefFolder.file(`brief-${slug}.txt`, briefText(brief))
    }
  }

  const [currentEntries, nextEntries] = await Promise.all([
    listCommissionEntries(month),
    listCommissionEntries(nextMonth),
  ])
  const forecastFolder = readme.folder('forecast')!
  forecastFolder.file(`ledger-${month.slice(0, 7)}.csv`, forecastCsv(currentEntries, month, nextMonth))
  forecastFolder.file(`forecast-${nextMonth.slice(0, 7)}.csv`, forecastCsv(nextEntries, month, nextMonth))
  forecastFolder.file('resumen.json', JSON.stringify({
    mes: month.slice(0, 7),
    forecastMes: nextMonth.slice(0, 7),
    brutoActual: currentEntries.reduce((s, e) => s + e.grossAmount, 0),
    agenciaActual: currentEntries.reduce((s, e) => s + e.agencyAmount, 0),
    brutoForecast: nextEntries.reduce((s, e) => s + e.grossAmount, 0),
    agenciaForecast: nextEntries.filter((e) => e.status === 'forecast').reduce((s, e) => s + e.agencyAmount, 0),
    lineas: currentEntries.length,
  }, null, 2))

  return zip.generateAsync({ type: 'blob' })
}

export async function downloadBoardPack(input: BoardPackInput): Promise<void> {
  const blob = await buildBoardPackZip(input)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `board-pack-${(input.month ?? monthStart()).slice(0, 7)}-${new Date().toISOString().slice(0, 10)}.zip`
  a.click()
  URL.revokeObjectURL(url)
}
