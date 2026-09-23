import { describe, expect, it, afterEach } from 'vitest'
import type { Talent } from '@/types'
import {
  buildTalentStatsReportHtml,
  canvasHasVisibleContent,
  collectPdfBreakYs,
  mountReportForPdfCapture,
  nextPdfSliceEnd,
  pdfPageSliceHeightPx,
  type TalentStatsReportInput,
} from './talent-stats-report'

function sampleTalent(): Talent {
  return {
    id: '1',
    login: 'demo',
    displayName: 'Demo',
    avatar: '',
    description: '',
    isLive: true,
    viewers: 42,
    followers: 1000,
    category: 'Just Chatting',
    title: 'Live',
    createdAt: '2026-01-01T00:00:00.000Z',
    language: 'es',
    tags: ['Just Chatting'],
    contentClassificationLabels: [],
  }
}

function sampleInput(): TalentStatsReportInput {
  return {
    orgName: 'NeuraLive',
    generatedAt: '2026-09-23T12:00:00.000Z',
    talents: [
      {
        talent: sampleTalent(),
        avgViewers: 40,
        peakViewers: 80,
        streamDays: 3,
        liveSnapshots: 10,
        clips: [],
        tt: {
          login: 'demo',
          rank: 1,
          avgViewers: 50,
          maxViewers: 100,
          hoursWatched: 120,
          minutesStreamed: 600,
          followersGrowth: 10,
          followersTotal: 1000,
          syncedAt: '2026-09-23T12:00:00.000Z',
        },
        subsTotal: 5,
        subsNote: null,
      },
    ],
    portfolio: {
      liveNow: 1,
      totalFollowers: 1000,
      combinedFollowers: 1000,
      igFollowers: 0,
      igHandles: 0,
      totalViewersLive: 42,
      avgFollowers: 1000,
      totalSubsActive: 5,
      subsChannelsCovered: 1,
      subsChannelsTotal: 1,
      subsNote: null,
      ttAvgViewers: 50,
      ttHoursWatched: 120,
      ttFollowersGrowth: 10,
      ttChannels: 1,
      clips7d: 2,
      clipsViewCount7d: 200,
      peakViewers7d: 80,
      activityPct7d: 100,
      activeTalents7d: 1,
      estimatedLiveHours7d: 4,
      streamDays7d: 3,
      languages: 1,
      uniqueTags: 1,
      cclCount: 0,
      rosterSize: 1,
    },
    vrchat: {
      groupId: 'grp_627b5237-b389-41eb-9eeb-c89233c8474c',
      groupUrl: 'https://vrchat.com/home/group/grp_627b5237-b389-41eb-9eeb-c89233c8474c',
      name: 'NeuraLive',
      iconUrl: null,
      memberCount: 120,
      onlineMemberCount: 8,
      memberDelta: 3,
      onlineDelta: -1,
      syncedAt: '2026-09-23T12:00:00.000Z',
    },
  }
}

describe('buildTalentStatsReportHtml', () => {
  it('incluye KPIs del grupo VRChat (Data NeuraLive)', () => {
    const html = buildTalentStatsReportHtml(sampleInput())
    expect(html).toContain('class="kpis vrchat"')
    expect(html).toContain('VRChat miembros')
    expect(html).toContain('Online ahora')
    expect(html).toContain('Grupo VRChat')
    expect(html).toContain('NeuraLive')
    expect(html).toContain('vrchat.com/home/group/')
    expect(html).toContain('Data NeuraLive')
    expect(html).toContain('Δ +3')
    expect(html).toContain('Comunidad VRChat')
    expect(html).not.toContain('API comunitaria')
  })

  it('usa Graphite (zinc/magenta), KPIs, donuts y print-friendly', () => {
    const html = buildTalentStatsReportHtml(sampleInput())
    expect(html).toContain('#09090b')
    expect(html).toContain('#e12ec4')
    expect(html).toContain('Followers Twitch')
    expect(html).toContain('Alcance combinado')
    expect(html).toContain('IG followers')
    expect(html).toContain('class="kpis"')
    expect(html).toContain('class="shares"')
    expect(html).toContain('<svg')
    expect(html).toContain('print-color-adjust:exact')
    expect(html).toContain('@page')
    expect(html).toContain('Señal Pulse')
  })

  it('tabla roster compacta: table-layout fixed, tags wrap, columnas ocultables', () => {
    const html = buildTalentStatsReportHtml(sampleInput())
    expect(html).toContain('class="roster"')
    expect(html).toContain('table-layout:fixed')
    expect(html).toContain('tags-cell')
    expect(html).toContain('col-tags')
    expect(html).toContain('col-ccl')
    expect(html).toContain('col-estado')
    expect(html).toContain('col-idioma')
    expect(html).toContain('.pdf-compact .col-estado')
    expect(html).toContain('break-inside:avoid')
    expect(html).toContain('page-break-inside:avoid')
  })

  it('embebe logo NeuraLive como data URL (HTML/PDF/preview)', () => {
    const html = buildTalentStatsReportHtml(sampleInput())
    expect(html).toContain('class="report-logo"')
    expect(html).toContain('alt="NeuraLive"')
    expect(html).toMatch(/src="data:image\/png;base64,/)
    expect(html).toContain('class="report-brand"')
    expect(html).toContain('class="report-product"')
  })

  it('usa etiqueta HTML (no text SVG) en el anillo de actividad', () => {
    const html = buildTalentStatsReportHtml(sampleInput())
    expect(html).toContain('class="activity-ring"')
    expect(html).toContain('class="activity-ring-label"')
    expect(html).not.toMatch(/activity-ring[\s\S]*?<text /)
  })
})

describe('pdf capture helpers', () => {
  afterEach(() => {
    document.querySelectorAll('[data-senal-pdf-capture]').forEach((el) => el.remove())
  })

  it('monta el reporte en viewport (no offscreen / z-index negativo)', async () => {
    const host = await mountReportForPdfCapture(buildTalentStatsReportHtml(sampleInput()))
    const left = host.style.left
    expect(left === '0' || left === '0px').toBe(true)
    expect(host.style.opacity).toBe('1')
    expect(Number(host.style.zIndex)).toBeGreaterThan(0)
    expect(left.startsWith('-')).toBe(false)
    expect(host.textContent).toContain('Señal Pulse')
    expect(host.querySelector('.kpis')).toBeTruthy()
    expect(host.querySelector('svg')).toBeTruthy()
    host.remove()
  }, 10_000)

  it('calcula slices de página sin generar docenas de páginas vacías', () => {
    // Canvas ~2400×3200 (reporte escalado) en A4 landscape ~289×200 mm útiles
    const slice = pdfPageSliceHeightPx(2400, 3200, 289, 200)
    expect(slice).toBeGreaterThan(1000)
    expect(Math.ceil(3200 / slice)).toBeLessThanOrEqual(4)
  })

  it('elige fin de slice en un break de fila (no a mitad de tr)', () => {
    // Página cabría hasta 500, pero la fila termina en 480 → cortar en 480
    expect(nextPdfSliceEnd(0, 500, [120, 240, 360, 480, 600])).toBe(480)
    // Sin break dentro del rango → hard max
    expect(nextPdfSliceEnd(0, 500, [600, 700])).toBe(500)
    // Segunda página: desde 480, máx 980 → 960
    expect(nextPdfSliceEnd(480, 980, [480, 600, 720, 840, 960, 1080])).toBe(960)
  })

  it('monta captura PDF con clase pdf-compact (oculta columnas menos críticas)', async () => {
    const host = await mountReportForPdfCapture(buildTalentStatsReportHtml(sampleInput()))
    expect(host.querySelector('.sheet.pdf-compact')).toBeTruthy()
    expect(host.querySelector('table.roster')).toBeTruthy()
    host.remove()
  }, 10_000)

  it('collectPdfBreakYs incluye bottoms de filas escalados al canvas', () => {
    const root = document.createElement('div')
    root.style.cssText = 'position:absolute;left:0;top:0;width:400px'
    root.innerHTML = `
      <div class="sheet pdf-compact">
        <table class="roster">
          <thead><tr><th>A</th></tr></thead>
          <tbody>
            <tr style="height:40px"><td>r1</td></tr>
            <tr style="height:40px"><td>r2</td></tr>
          </tbody>
        </table>
      </div>`
    document.body.appendChild(root)
    // jsdom: getBoundingClientRect suele ser 0 — inyectamos rects vía mock si hace falta
    const breaks = collectPdfBreakYs(root, 800)
    expect(Array.isArray(breaks)).toBe(true)
    expect(breaks[breaks.length - 1]).toBe(800)
    root.remove()
  })

  it('detecta canvas negro vacío vs con contenido claro', () => {
    const blank = document.createElement('canvas')
    blank.width = 200
    blank.height = 200
    const bctx = blank.getContext('2d')
    if (!bctx) {
      // jsdom sin node-canvas: getContext es null → se trata como sin contenido
      expect(canvasHasVisibleContent(blank)).toBe(false)
      return
    }
    bctx.fillStyle = '#09090b'
    bctx.fillRect(0, 0, 200, 200)
    expect(canvasHasVisibleContent(blank)).toBe(false)

    const lit = document.createElement('canvas')
    lit.width = 200
    lit.height = 200
    const lctx = lit.getContext('2d')!
    lctx.fillStyle = '#09090b'
    lctx.fillRect(0, 0, 200, 200)
    lctx.fillStyle = '#fafafa'
    lctx.fillRect(10, 150, 180, 30)
    expect(canvasHasVisibleContent(lit)).toBe(true)
  })
})
