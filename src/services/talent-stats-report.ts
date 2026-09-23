import { invoke } from '@tauri-apps/api/core'
import type { Talent } from '@/types'
import type { MetricSnapshot } from '@/services/metrics'
import { buildWeeklyComparison, fetchMetricSnapshots } from '@/services/metrics'
import { listClips, type ClipRecord } from '@/services/ops'
import {
  fetchTwitchTrackerSnapshots,
  type TwitchTrackerSnapshot,
  TWITCHTRACKER_DISCLAIMER,
} from '@/services/twitchtracker'
import {
  fetchPortfolioSubscriptionKpi,
  type PortfolioSubscriptionKpi,
} from '@/services/helix-live'
import { isTauri } from '@/services/twitch'
import { buildPortfolioOpsKpis } from '@/features/signal-pulse/signal-pulse-kpis'
import {
  hoursWatchedShare,
  languageShare,
  liveOfflineShare,
  shareColor,
  type ShareSlice,
} from '@/features/signal-pulse/signal-pulse-charts'
import { fetchWeeklyClips } from '@/services/twitch-intelligence'
import { fetchInstagramMonthlySnapshots } from '@/services/instagram-monthly'
import {
  buildVrchatGroupKpi,
  fetchVrchatGroupSnapshots,
  formatSignedDelta,
  type VrchatGroupKpi,
} from '@/services/vrchat-groups'
/** Data URL embebida: HTML export, vista previa file:// y html2canvas/PDF. */
import neuraliveLogotypeDataUrl from '@/assets/brand/neuralive-logotype-report.png?inline'

export type TalentStatsTtRow = {
  login: string
  rank: number | null
  avgViewers: number
  maxViewers: number
  hoursWatched: number
  minutesStreamed: number
  followersGrowth: number | null
  followersTotal: number | null
  syncedAt: string
}

export type TalentStatsReportInput = {
  orgName: string
  generatedAt: string
  talents: Array<{
    talent: Talent
    avgViewers: number
    peakViewers: number
    streamDays: number
    liveSnapshots: number
    clips: ClipRecord[]
    tt: TalentStatsTtRow | null
    subsTotal: number | null
    subsNote: string | null
  }>
  portfolio: {
    liveNow: number
    /** Followers Twitch (Helix / talents). */
    totalFollowers: number
    /** Twitch + IG followers. */
    combinedFollowers: number
    igFollowers: number
    igHandles: number
    totalViewersLive: number
    avgFollowers: number
    /** Subs activas agregadas (Helix live + caché) de toda la cartera. */
    totalSubsActive: number
    subsChannelsCovered: number
    subsChannelsTotal: number
    subsNote: string | null
    /** Apoyo TwitchTracker (~30d). */
    ttAvgViewers: number
    ttHoursWatched: number
    ttFollowersGrowth: number
    ttChannels: number
    /** KPIs Señal Pulse (ops). */
    clips7d: number
    clipsViewCount7d: number
    peakViewers7d: number
    activityPct7d: number
    activeTalents7d: number
    estimatedLiveHours7d: number
    streamDays7d: number
    languages: number
    uniqueTags: number
    cclCount: number
    rosterSize: number
  }
  /** Comunidad VRChat (grupo NeuraLive) — Data NeuraLive. */
  vrchat: {
    groupId: string
    groupUrl: string
    name: string
    iconUrl: string | null
    memberCount: number
    onlineMemberCount: number
    memberDelta: number | null
    onlineDelta: number | null
    syncedAt: string | null
  }
}

function toReportVrchat(kpi: VrchatGroupKpi): TalentStatsReportInput['vrchat'] {
  return {
    groupId: kpi.groupId,
    groupUrl: kpi.groupUrl,
    name: kpi.name,
    iconUrl: kpi.iconUrl,
    memberCount: kpi.memberCount,
    onlineMemberCount: kpi.onlineMemberCount,
    memberDelta: kpi.memberDelta,
    onlineDelta: kpi.onlineDelta,
    syncedAt: kpi.syncedAt,
  }
}

function latestTtByLogin(rows: TwitchTrackerSnapshot[]): Map<string, TwitchTrackerSnapshot> {
  const map = new Map<string, TwitchTrackerSnapshot>()
  const sorted = [...rows].sort(
    (a, b) => new Date(b.syncedAt).getTime() - new Date(a.syncedAt).getTime(),
  )
  for (const row of sorted) {
    const key = row.login.toLowerCase()
    if (!map.has(key)) map.set(key, row)
  }
  return map
}

function toTtRow(row: TwitchTrackerSnapshot): TalentStatsTtRow {
  return {
    login: row.login,
    rank: row.rank,
    avgViewers: row.avgViewers,
    maxViewers: row.maxViewers,
    hoursWatched: row.hoursWatched,
    minutesStreamed: row.minutesStreamed,
    followersGrowth: row.followersGrowth,
    followersTotal: row.followersTotal,
    syncedAt: row.syncedAt,
  }
}

export async function loadTalentStatsReport(
  talents: Talent[],
  logins?: string[],
): Promise<TalentStatsReportInput> {
  const selected = logins?.length
    ? talents.filter((t) => logins.some((l) => l.toLowerCase() === t.login.toLowerCase()))
    : talents

  const [snapshots, clips, ttSnapshots, portfolioSubs, weeklyClips, igSnapshots, vrchatSnapshots] =
    await Promise.all([
      fetchMetricSnapshots(168),
      listClips(200).catch(() => [] as ClipRecord[]),
      fetchTwitchTrackerSnapshots(720).catch(() => [] as TwitchTrackerSnapshot[]),
      fetchPortfolioSubscriptionKpi().catch(
        (): PortfolioSubscriptionKpi => ({
          total: 0,
          points: 0,
          channelsTotal: selected.length,
          channelsLive: 0,
          channelsCached: 0,
          channelsMissing: selected.length,
          hasCoverage: false,
          channels: [],
          note: 'No se pudieron leer suscripciones del roster.',
        }),
      ),
      fetchWeeklyClips().catch(() => []),
      fetchInstagramMonthlySnapshots(3).catch(() => []),
      fetchVrchatGroupSnapshots(10).catch(() => []),
    ])

  const nameByLogin = Object.fromEntries(selected.map((t) => [t.login, t.displayName]))
  const weekly = buildWeeklyComparison(snapshots, nameByLogin)
  const ttLatest = latestTtByLogin(ttSnapshots)
  const subsByLogin = new Map(
    portfolioSubs.channels.map((c) => [c.login.toLowerCase(), c] as const),
  )
  const ops = buildPortfolioOpsKpis({
    talents: selected,
    snapshots,
    ttSnapshots,
    weeklyClips,
    dbClips: clips,
    igSnapshots,
  })

  const rows = selected.map((talent) => {
    const week = weekly.find((w) => w.login.toLowerCase() === talent.login.toLowerCase())
    const talentClips = clips
      .filter((c) => c.talentLogin?.toLowerCase() === talent.login.toLowerCase())
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, 5)
    const tt = ttLatest.get(talent.login.toLowerCase())
    const subs = subsByLogin.get(talent.login.toLowerCase())
    return {
      talent,
      avgViewers: week?.thisWeek.avgViewers ?? 0,
      peakViewers: week?.thisWeek.peakViewers ?? 0,
      streamDays: week?.thisWeek.streamDays ?? 0,
      liveSnapshots: week?.thisWeek.liveSnapshots ?? 0,
      clips: talentClips,
      tt: tt ? toTtRow(tt) : null,
      subsTotal: subs?.available ? subs.total : null,
      subsNote: subs?.note ?? null,
    }
  })

  const liveNow = selected.filter((t) => t.isLive).length
  const totalFollowers = ops.totalFollowers
  const totalViewersLive = selected.filter((t) => t.isLive).reduce((sum, t) => sum + t.viewers, 0)

  const ttRows = [...ttLatest.values()].filter((row) =>
    selected.some((t) => t.login.toLowerCase() === row.login.toLowerCase()),
  )
  const ttAvgViewers = ttRows.length
    ? Math.round(ttRows.reduce((s, r) => s + r.avgViewers, 0) / ttRows.length)
    : 0
  const ttHoursWatched = ttRows.reduce((s, r) => s + r.hoursWatched, 0)
  const ttFollowersGrowth = ttRows.reduce((s, r) => s + (r.followersGrowth ?? 0), 0)

  return {
    orgName: 'NeuraLive',
    generatedAt: new Date().toISOString(),
    talents: rows,
    portfolio: {
      liveNow,
      totalFollowers,
      combinedFollowers: ops.combinedFollowers,
      igFollowers: ops.igFollowers,
      igHandles: ops.igHandles,
      totalViewersLive,
      avgFollowers: selected.length ? Math.round(totalFollowers / selected.length) : 0,
      totalSubsActive: portfolioSubs.total,
      subsChannelsCovered: portfolioSubs.channelsLive + portfolioSubs.channelsCached,
      subsChannelsTotal: portfolioSubs.channelsTotal || selected.length,
      subsNote: portfolioSubs.note ?? null,
      ttAvgViewers,
      ttHoursWatched,
      ttFollowersGrowth,
      ttChannels: ttRows.length,
      clips7d: ops.clips7d,
      clipsViewCount7d: ops.clipsViewCount7d,
      peakViewers7d: ops.peakViewers7d,
      activityPct7d: ops.activityPct7d,
      activeTalents7d: ops.activeTalents7d,
      estimatedLiveHours7d: ops.estimatedLiveHours7d,
      streamDays7d: ops.streamDays7d,
      languages: ops.languages,
      uniqueTags: ops.uniqueTags,
      cclCount: ops.cclCount,
      rosterSize: selected.length,
    },
    vrchat: toReportVrchat(buildVrchatGroupKpi(vrchatSnapshots, null)),
  }
}

function esc(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function reportStamp(input: TalentStatsReportInput) {
  return new Date(input.generatedAt).toISOString().slice(0, 10)
}

export function buildTalentStatsReportCsv(input: TalentStatsReportInput): string {
  const headers = [
    'login',
    'displayName',
    'isLive',
    'viewers',
    'followers',
    'subsActive',
    'avgViewers7d',
    'peakViewers7d',
    'streamDays',
    'language',
    'tags',
    'ccl',
    'ttRank',
    'ttAvgViewers30d',
    'ttMaxViewers30d',
    'ttHoursWatched30d',
    'ttFollowersGrowth30d',
  ]
  const lines = [headers.join(',')]
  for (const r of input.talents) {
    const row = {
      login: r.talent.login,
      displayName: r.talent.displayName,
      isLive: r.talent.isLive,
      viewers: r.talent.viewers,
      followers: r.talent.followers,
      subsActive: r.subsTotal ?? '',
      avgViewers7d: r.avgViewers,
      peakViewers7d: r.peakViewers,
      streamDays: r.streamDays,
      language: r.talent.language ?? '',
      tags: (r.talent.tags ?? []).join('|'),
      ccl: (r.talent.contentClassificationLabels ?? []).join('|'),
      ttRank: r.tt?.rank ?? '',
      ttAvgViewers30d: r.tt?.avgViewers ?? '',
      ttMaxViewers30d: r.tt?.maxViewers ?? '',
      ttHoursWatched30d: r.tt?.hoursWatched ?? '',
      ttFollowersGrowth30d: r.tt?.followersGrowth ?? '',
    }
    lines.push(headers.map((h) => JSON.stringify((row as Record<string, unknown>)[h] ?? '')).join(','))
  }
  return lines.join('\n')
}

function fmt(n: number) {
  return n.toLocaleString('es-MX')
}

/** SVG donut estático para HTML export (Graphite). */
function svgDonut(slices: ShareSlice[], size = 120): string {
  const total = slices.reduce((s, x) => s + x.value, 0)
  if (total <= 0) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.36}" fill="none" stroke="#27272a" stroke-width="14"/>
    </svg>`
  }
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.36
  const stroke = 14
  const c = 2 * Math.PI * r
  let offset = 0
  const rings = slices
    .map((slice, i) => {
      const len = (slice.value / total) * c
      const color = shareColor(i)
      const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
        stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}"
        stroke-dashoffset="${(-offset).toFixed(2)}"
        transform="rotate(-90 ${cx} ${cy})" />`
      offset += len
      return el
    })
    .join('')
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">${rings}</svg>`
}

function shareLegend(slices: ShareSlice[], suffix = ''): string {
  const total = slices.reduce((s, x) => s + x.value, 0)
  return `<ul class="share-legend">${slices
    .map((slice, i) => {
      const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0
      return `<li><i style="background:${shareColor(i)}"></i><span>${esc(slice.name)}</span><b>${fmt(slice.value)}${esc(suffix)} · ${pct}%</b></li>`
    })
    .join('')}</ul>`
}

function activityRingSvg(pct: number): string {
  const r = 42
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, pct))
  const offset = c - (clamped / 100) * c
  // Etiquetas en HTML (no <text> SVG): html2canvas suele omitir texto SVG.
  return `<div class="activity-ring">
    <svg width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="${r}" fill="none" stroke="#27272a" stroke-width="10"/>
      <circle cx="60" cy="60" r="${r}" fill="none" stroke="#e12ec4" stroke-width="10"
        stroke-dasharray="${c}" stroke-dashoffset="${offset}"
        transform="rotate(-90 60 60)"/>
    </svg>
    <div class="activity-ring-label">
      <strong>${clamped}%</strong>
      <span>actividad</span>
    </div>
  </div>`
}

/** Estilos Graphite compartidos por HTML, print y captura PDF. */
const TALENT_STATS_REPORT_CSS = `
  :root {
    --bg:#09090b; --panel:#18181b; --line:#27272a; --text:#fafafa;
    --muted:#a1a1aa; --text3:#71717a; --accent:#e12ec4;
  }
  * { box-sizing:border-box; }
  html, body { margin:0; font-family:"Segoe UI",system-ui,sans-serif; background:var(--bg); color:var(--text); }
  .sheet { max-width:1180px; margin:0 auto; padding:28px 24px 40px; }
  header.report-head {
    display:flex; align-items:center; gap:28px;
    border-bottom:1px solid var(--line); padding-bottom:20px; margin-bottom:22px;
  }
  .report-brand { flex:none; }
  .report-logo {
    display:block; height:96px; width:auto; max-width:240px;
    object-fit:contain;
  }
  .report-meta { min-width:0; flex:1; }
  .report-product {
    margin:0 0 6px; color:var(--accent); font-size:12px; font-weight:600;
    letter-spacing:.1em; text-transform:uppercase;
  }
  header.report-head h1 { margin:0; font-size:28px; letter-spacing:-.02em; font-weight:700; }
  header.report-head .report-sub { margin:8px 0 0; color:var(--muted); font-size:13px; }
  .kpis { display:grid; grid-template-columns:repeat(7,1fr); gap:8px; margin-bottom:10px; }
  .kpis.support { grid-template-columns:repeat(5,1fr); margin-bottom:12px; }
  .kpis.vrchat { grid-template-columns:repeat(3,1fr); margin-bottom:18px; }
  .kpi { background:var(--panel); border:1px solid var(--line); padding:12px 12px 10px; break-inside:avoid; }
  .kpi span { display:block; color:var(--text3); font-size:10px; text-transform:uppercase; letter-spacing:.05em; }
  .kpi strong { display:block; margin-top:6px; font-size:20px; letter-spacing:-.02em; color:var(--text); }
  .kpi em { display:block; margin-top:4px; color:var(--muted); font-size:10px; font-style:normal; }
  .kpi a { color:var(--accent); text-decoration:none; }
  .kpi a:hover { text-decoration:underline; }
  .vrchat-who { display:flex; gap:10px; align-items:center; min-width:0; margin-top:6px; }
  .vrchat-who img {
    width:36px; height:36px; border-radius:4px; object-fit:cover; flex:none;
    border:1px solid var(--line); background:#09090b;
  }
  .vrchat-who .vrchat-who-text { min-width:0; }
  .vrchat-who .vrchat-who-text strong { margin:0; font-size:16px; }
  .vrchat-who .vrchat-who-text em { margin-top:2px; }
  .shares { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:20px; }
  .share { background:var(--panel); border:1px solid var(--line); padding:12px; break-inside:avoid; }
  .share h3 { margin:0 0 2px; font-size:12px; color:var(--text); }
  .share>p { margin:0 0 10px; color:var(--muted); font-size:10px; }
  .share-body { display:flex; flex-direction:column; align-items:center; gap:8px; }
  .share-legend { list-style:none; margin:0; padding:0; width:100%; }
  .share-legend li { display:flex; align-items:center; gap:6px; font-size:10px; margin-top:4px; color:var(--muted); }
  .share-legend i { width:8px; height:8px; flex:none; }
  .share-legend b { margin-left:auto; color:var(--text); font-weight:600; }
  .activity-ring { position:relative; width:120px; height:120px; }
  .activity-ring-label {
    position:absolute; inset:0; display:flex; flex-direction:column;
    align-items:center; justify-content:center; pointer-events:none;
  }
  .activity-ring-label strong { font-size:22px; font-weight:600; color:var(--text); line-height:1; }
  .activity-ring-label span { margin-top:4px; font-size:10px; color:var(--muted); }
  .note { color:var(--muted); font-size:11px; margin:0 0 14px; }
  table.roster {
    width:100%; table-layout:fixed; border-collapse:collapse;
    background:var(--panel); border:1px solid var(--line); font-size:11px;
  }
  table.roster th, table.roster td {
    border-bottom:1px solid var(--line); padding:6px 5px; text-align:left;
    vertical-align:top; color:var(--text); overflow-wrap:anywhere; word-break:break-word;
  }
  table.roster th { color:var(--text3); font-weight:600; font-size:8px; text-transform:uppercase; letter-spacing:.04em; }
  table.roster .col-talent { width:16%; }
  table.roster .col-estado { width:8%; }
  table.roster .col-num { width:7%; }
  table.roster .col-idioma { width:5%; }
  table.roster .col-tags { width:20%; }
  table.roster .col-ccl { width:11%; }
  tr.is-live td.col-talent { box-shadow:inset 2px 0 0 var(--accent); }
  tr, thead, .kpi, .share, .report-head, .note, .kpis.vrchat { break-inside:avoid; page-break-inside:avoid; }
  .who { display:flex; gap:6px; align-items:center; min-width:0; }
  .who img { width:22px; height:22px; border-radius:2px; object-fit:cover; flex:none; }
  .who b { color:var(--text); font-size:11px; }
  .who span { display:block; color:var(--muted); font-size:9px; }
  .tags-cell { display:flex; flex-wrap:wrap; gap:2px; align-items:flex-start; }
  .tag {
    display:inline-block; margin:0; padding:1px 4px; border:1px solid var(--line);
    font-size:8px; color:var(--muted); white-space:nowrap; max-width:100%;
    overflow:hidden; text-overflow:ellipsis;
  }
  .ccl-cell { font-size:8px; line-height:1.3; color:var(--muted); }
  /* PDF/print: caben TAGS+CCL; Estado e Idioma son menos críticos */
  .pdf-compact {
    max-width:none !important;
    padding:16px 12px 24px !important;
    overflow-x:hidden;
  }
  .pdf-compact .col-estado,
  .pdf-compact .col-idioma { display:none; }
  .pdf-compact table.roster { font-size:10px; }
  .pdf-compact table.roster th, .pdf-compact table.roster td { padding:5px 4px; }
  .pdf-compact .col-talent { width:18%; }
  .pdf-compact .col-tags { width:26%; }
  .pdf-compact .col-ccl { width:14%; }
  .pdf-compact .col-num { width:7.5%; }
  @page { size: A4 landscape; margin: 8mm; }
  @media print {
    html, body {
      background:var(--bg) !important;
      color:var(--text) !important;
      -webkit-print-color-adjust:exact;
      print-color-adjust:exact;
    }
    .sheet { max-width:none; padding:0; }
    .kpi, .share, table.roster {
      background:var(--panel) !important;
      border-color:var(--line) !important;
    }
    .report-product { color:var(--accent) !important; }
    .report-logo { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .kpi strong { color:var(--text) !important; }
    th, td { border-color:var(--line) !important; }
    .col-estado, .col-idioma { display:none; }
    tr, thead, .kpi, .share, .kpis.vrchat { break-inside:avoid; page-break-inside:avoid; }
  }
  @media (max-width:900px) {
    .kpis, .kpis.support, .kpis.vrchat, .shares { grid-template-columns:1fr 1fr; }
    header.report-head { flex-direction:column; align-items:flex-start; gap:16px; }
    .report-logo { height:72px; max-width:180px; }
  }
`

const REPORT_CAPTURE_WIDTH = 1180

export function buildTalentStatsReportHtml(input: TalentStatsReportInput): string {
  const date = new Date(input.generatedAt).toLocaleString('es-MX')
  const roster = input.talents.map((r) => r.talent)
  const liveShare = liveOfflineShare(roster)
  const langShare = languageShare(roster)
  const ttShare = hoursWatchedShare(
    input.talents
      .filter((r) => r.tt)
      .map((r) => ({
        id: 1,
        talentId: r.talent.login,
        login: r.talent.login,
        periodDays: 30,
        rank: r.tt!.rank,
        avgViewers: r.tt!.avgViewers,
        maxViewers: r.tt!.maxViewers,
        minutesStreamed: r.tt!.minutesStreamed,
        hoursWatched: r.tt!.hoursWatched,
        followersGrowth: r.tt!.followersGrowth,
        followersTotal: r.tt!.followersTotal,
        syncedAt: r.tt!.syncedAt,
      })),
    roster,
  )
  const p = input.portfolio
  const v = input.vrchat
  const vrchatSyncLabel = v.syncedAt
    ? `Sync ${new Date(v.syncedAt).toLocaleString('es-MX')}`
    : 'Sin sync reciente'
  const memberDeltaLabel =
    v.memberDelta != null ? ` · Δ ${formatSignedDelta(v.memberDelta)}` : ''
  const onlineDeltaLabel =
    v.onlineDelta != null
      ? `Δ ${formatSignedDelta(v.onlineDelta)} vs sync anterior`
      : 'Miembros conectados'

  const rows = input.talents
    .map((row) => {
      const tags = (row.talent.tags ?? [])
        .slice(0, 5)
        .map((t) => `<span class="tag">${esc(t)}</span>`)
        .join('')
      const cclLabels = (row.talent.contentClassificationLabels ?? []).slice(0, 3)
      const ccl = cclLabels.join(', ') || '—'
      return `<tr class="${row.talent.isLive ? 'is-live' : ''}">
        <td class="col-talent">
          <div class="who">
            ${row.talent.avatar ? `<img src="${esc(row.talent.avatar)}" alt="" />` : ''}
            <div>
              <b>${esc(row.talent.displayName)}</b>
              <span>@${esc(row.talent.login)}</span>
            </div>
          </div>
        </td>
        <td class="col-estado">${row.talent.isLive ? `LIVE · ${fmt(row.talent.viewers)}` : 'Offline'}</td>
        <td class="col-num">${fmt(row.talent.followers)}</td>
        <td class="col-num">${row.tt ? fmt(Math.round(row.tt.hoursWatched)) : '—'}</td>
        <td class="col-num">${row.tt?.followersGrowth != null ? fmt(row.tt.followersGrowth) : '—'}</td>
        <td class="col-num">${row.tt ? fmt(row.tt.avgViewers) : '—'}</td>
        <td class="col-num">${fmt(row.avgViewers)}</td>
        <td class="col-num">${fmt(row.peakViewers)}</td>
        <td class="col-idioma">${esc(row.talent.language || '—')}</td>
        <td class="col-tags"><div class="tags-cell">${tags || '—'}</div></td>
        <td class="col-ccl"><div class="ccl-cell">${esc(ccl)}</div></td>
      </tr>`
    })
    .join('')

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Señal Pulse · ${esc(input.orgName)}</title>
<style>
${TALENT_STATS_REPORT_CSS}
</style>
</head>
<body>
  <div class="sheet">
    <header class="report-head">
      <div class="report-brand">
        <img
          class="report-logo"
          src="${neuraliveLogotypeDataUrl}"
          alt="NeuraLive"
          width="240"
          height="198"
        />
      </div>
      <div class="report-meta">
        <p class="report-product">Señal Pulse</p>
        <h1>${esc(input.orgName)}</h1>
        <p class="report-sub">Generado ${esc(date)}</p>
      </div>
    </header>

    <div class="kpis">
      <div class="kpi"><span>Followers Twitch</span><strong>${fmt(p.totalFollowers)}</strong><em>Cartera Twitch · ${p.rosterSize} talentos</em></div>
      <div class="kpi"><span>Alcance combinado</span><strong>${fmt(p.combinedFollowers)}</strong><em>Twitch + IG</em></div>
      <div class="kpi"><span>Avg viewers</span><strong>${fmt(p.ttAvgViewers)}</strong><em>~30d · Data NeuraLive</em></div>
      <div class="kpi"><span>Hours watched</span><strong>${fmt(Math.round(p.ttHoursWatched))}</strong><em>suma cartera · Data NeuraLive</em></div>
      <div class="kpi"><span>Followers Δ</span><strong>${fmt(p.ttFollowersGrowth)}</strong><em>~30d · Data NeuraLive</em></div>
      <div class="kpi"><span>Clips 7d</span><strong>${fmt(p.clips7d)}</strong><em>${fmt(p.clipsViewCount7d)} views</em></div>
      <div class="kpi"><span>Actividad 7d</span><strong>${p.activityPct7d}%</strong><em>${p.activeTalents7d}/${p.rosterSize} con señal</em></div>
    </div>
    <div class="kpis support">
      <div class="kpi"><span>IG followers</span><strong>${fmt(p.igFollowers)}</strong><em>Cartera IG · ${p.igHandles} handles</em></div>
      <div class="kpi"><span>En vivo ahora</span><strong>${p.liveNow}</strong><em>${fmt(p.totalViewersLive)} viewers</em></div>
      <div class="kpi"><span>Peak 7d</span><strong>${fmt(p.peakViewers7d)}</strong><em>${p.streamDays7d} días con live</em></div>
      <div class="kpi"><span>Señal estimada</span><strong>${fmt(p.estimatedLiveHours7d)}h</strong><em>~60s/captura</em></div>
      <div class="kpi"><span>Idiomas · tags · CCL</span><strong>${p.languages} · ${p.uniqueTags} · ${p.cclCount}</strong><em>composición</em></div>
    </div>

    <div class="kpis vrchat">
      <div class="kpi">
        <span>VRChat miembros</span>
        <strong>${fmt(v.memberCount)}</strong>
        <em>${esc(v.name)}${esc(memberDeltaLabel)}</em>
      </div>
      <div class="kpi">
        <span>Online ahora</span>
        <strong>${fmt(v.onlineMemberCount)}</strong>
        <em>${esc(onlineDeltaLabel)}</em>
      </div>
      <div class="kpi">
        <span>Grupo VRChat</span>
        <div class="vrchat-who">
          ${v.iconUrl ? `<img src="${esc(v.iconUrl)}" alt="" width="36" height="36" />` : ''}
          <div class="vrchat-who-text">
            <strong><a href="${esc(v.groupUrl)}" target="_blank" rel="noreferrer">${esc(v.name)}</a></strong>
            <em>${esc(vrchatSyncLabel)} · Data NeuraLive</em>
          </div>
        </div>
      </div>
    </div>

    <div class="shares">
      <div class="share">
        <h3>Live vs offline</h3>
        <p>Canales ahora</p>
        <div class="share-body">${svgDonut(liveShare)}${shareLegend(liveShare)}</div>
      </div>
      <div class="share">
        <h3>Idiomas</h3>
        <p>Composición del roster</p>
        <div class="share-body">${svgDonut(langShare)}${shareLegend(langShare)}</div>
      </div>
      <div class="share">
        <h3>Hours share</h3>
        <p>Hours watched ~30d</p>
        <div class="share-body">${svgDonut(ttShare)}${shareLegend(ttShare, ' h')}</div>
      </div>
      <div class="share">
        <h3>Actividad 7d</h3>
        <p>Talentos con señal live</p>
        <div class="share-body">${activityRingSvg(p.activityPct7d)}
          <p class="note" style="margin:0;text-align:center">${p.activeTalents7d}/${p.rosterSize} activos</p>
        </div>
      </div>
    </div>

    <p class="note">${esc(TWITCHTRACKER_DISCLAIMER)}</p>
    <p class="note">Comunidad VRChat · Data NeuraLive</p>
    ${p.subsNote ? `<p class="note">${esc(p.subsNote)}</p>` : ''}

    <table class="roster">
      <thead>
        <tr>
          <th class="col-talent">Talento</th>
          <th class="col-estado">Estado</th>
          <th class="col-num">Foll. Twitch</th>
          <th class="col-num">H.watch</th>
          <th class="col-num">Δ foll</th>
          <th class="col-num">Avg</th>
          <th class="col-num">Avg 7d</th>
          <th class="col-num">Peak 7d</th>
          <th class="col-idioma">Idioma</th>
          <th class="col-tags">Tags</th>
          <th class="col-ccl">CCL</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</body>
</html>`
}

type SavedExport = { path: string; filename: string }

async function saveViaTauri(
  filename: string,
  contents: string,
  encoding: 'utf8' | 'base64' = 'utf8',
): Promise<SavedExport> {
  return invoke<SavedExport>('save_report_export', { filename, contents, encoding })
}

function downloadBlobFallback(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export type ReportSaveResult = {
  path: string | null
  filename: string
  via: 'tauri' | 'blob'
}

export async function downloadTalentStatsReportHtml(
  input: TalentStatsReportInput,
): Promise<ReportSaveResult> {
  const filename = `neuragest-senal-pulse-${reportStamp(input)}.html`
  const html = buildTalentStatsReportHtml(input)
  if (isTauri) {
    try {
      const saved = await saveViaTauri(filename, html, 'utf8')
      return { path: saved.path, filename: saved.filename, via: 'tauri' }
    } catch {
      /* fallback blob */
    }
  }
  downloadBlobFallback(filename, new Blob([html], { type: 'text/html;charset=utf-8' }))
  return { path: null, filename, via: 'blob' }
}

export async function downloadTalentStatsReportCsv(
  input: TalentStatsReportInput,
): Promise<ReportSaveResult> {
  const filename = `neuragest-senal-pulse-${reportStamp(input)}.csv`
  const csv = buildTalentStatsReportCsv(input)
  if (isTauri) {
    try {
      const saved = await saveViaTauri(filename, csv, 'utf8')
      return { path: saved.path, filename: saved.filename, via: 'tauri' }
    } catch {
      /* fallback */
    }
  }
  downloadBlobFallback(filename, new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  return { path: null, filename, via: 'blob' }
}

const REPORT_PDF_BG = '#09090b'
const REPORT_PDF_MARGIN_MM = 4

/**
 * Monta el HTML Graphite en viewport (no offscreen).
 * html2canvas + jspdf.html fallan con left:-NNpx / z-index:-1: capturan solo el fondo → PDF negro.
 */
export async function mountReportForPdfCapture(html: string): Promise<HTMLElement> {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  const host = document.createElement('div')
  host.setAttribute('data-senal-pdf-capture', '1')
  host.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    `width:${REPORT_CAPTURE_WIDTH}px`,
    'background:#09090b',
    'color:#fafafa',
    'z-index:2147483646',
    'pointer-events:none',
    'opacity:1',
    'visibility:visible',
    'overflow-x:hidden',
    'overflow-y:visible',
    '-webkit-print-color-adjust:exact',
    'print-color-adjust:exact',
  ].join(';')
  const style = document.createElement('style')
  style.textContent = TALENT_STATS_REPORT_CSS
  host.appendChild(style)
  const sheet = parsed.body.querySelector('.sheet')
  if (sheet) {
    sheet.classList.add('pdf-compact')
    host.appendChild(document.importNode(sheet, true))
  } else {
    host.insertAdjacentHTML('beforeend', parsed.body.innerHTML)
    host.querySelector('.sheet')?.classList.add('pdf-compact')
  }
  document.body.appendChild(host)

  const images = Array.from(host.querySelectorAll('img'))
  await Promise.all(
    images.map(
      (img) =>
        Promise.race([
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.addEventListener('load', () => resolve(), { once: true })
                img.addEventListener('error', () => resolve(), { once: true })
              }),
          new Promise<void>((resolve) => setTimeout(resolve, 2500)),
        ]),
    ),
  )
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await Promise.race([
        document.fonts.ready,
        new Promise<void>((resolve) => setTimeout(resolve, 400)),
      ])
    } catch {
      /* ignore */
    }
  }
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
  return host
}

/** Altura de una página PDF (mm útiles) → píxeles de canvas a volcar por página. */
export function pdfPageSliceHeightPx(
  canvasWidth: number,
  canvasHeight: number,
  pageContentWidthMm: number,
  pageContentHeightMm: number,
): number {
  if (canvasWidth <= 0 || pageContentWidthMm <= 0) return canvasHeight
  const imgHeightMm = (canvasHeight * pageContentWidthMm) / canvasWidth
  if (imgHeightMm <= 0) return canvasHeight
  return Math.max(1, Math.ceil((pageContentHeightMm / imgHeightMm) * canvasHeight))
}

/**
 * Bottoms (px canvas) de bloques que no deben partirse: filas, KPIs, shares, etc.
 * html2canvas scale → mapear getBoundingClientRect al alto del canvas.
 */
export function collectPdfBreakYs(root: HTMLElement, canvasHeight: number): number[] {
  const rootRect = root.getBoundingClientRect()
  const rootH = rootRect.height || root.scrollHeight || 1
  const scale = canvasHeight / rootH
  const selectors = [
    '.report-head',
    '.kpis',
    '.kpis.vrchat',
    '.shares',
    '.share',
    '.note',
    'table.roster thead',
    'table.roster tbody tr',
  ]
  const ys: number[] = []
  for (const sel of selectors) {
    root.querySelectorAll(sel).forEach((node) => {
      const el = node as HTMLElement
      const r = el.getBoundingClientRect()
      const bottom = Math.round((r.bottom - rootRect.top) * scale)
      if (bottom > 0 && bottom <= canvasHeight) ys.push(bottom)
    })
  }
  ys.push(canvasHeight)
  return [...new Set(ys)].sort((a, b) => a - b)
}

/**
 * Fin de slice: el break más cercano a maxEnd sin pasarlo (evita cortar a mitad de fila).
 * Si no hay break en (yStart, maxEnd], usa maxEnd (fila más alta que la página).
 */
export function nextPdfSliceEnd(yStart: number, maxEnd: number, breakYs: number[]): number {
  const hard = Math.max(yStart + 1, maxEnd)
  let best = -1
  for (const b of breakYs) {
    if (b > yStart && b <= hard) best = b
  }
  return best > yStart ? best : hard
}

/** Vuelca un canvas alto a páginas A4 landscape (fondo Graphite, sin borde blanco). */
export function appendCanvasPagesToPdf(
  doc: import('jspdf').jsPDF,
  canvas: HTMLCanvasElement,
  marginMm = REPORT_PDF_MARGIN_MM,
  breakYs?: number[],
): number {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const contentW = pageW - marginMm * 2
  const contentH = pageH - marginMm * 2
  const imgW = contentW
  const imgH = (canvas.height * contentW) / canvas.width
  const slicePx = pdfPageSliceHeightPx(canvas.width, canvas.height, contentW, contentH)
  const breaks = breakYs?.length ? breakYs : [canvas.height]

  let yPx = 0
  let pages = 0
  while (yPx < canvas.height) {
    if (pages > 0) doc.addPage()
    // Fondo de página = Graphite (evita marco blanco alrededor del slice).
    doc.setFillColor(9, 9, 11)
    doc.rect(0, 0, pageW, pageH, 'F')

    const maxEnd = Math.min(yPx + slicePx, canvas.height)
    const end = nextPdfSliceEnd(yPx, maxEnd, breaks)
    const hPx = Math.max(1, end - yPx)
    const slice = document.createElement('canvas')
    slice.width = canvas.width
    slice.height = hPx
    const ctx = slice.getContext('2d')
    if (!ctx) throw new Error('No se pudo crear contexto 2D para paginar el PDF')
    ctx.fillStyle = REPORT_PDF_BG
    ctx.fillRect(0, 0, slice.width, slice.height)
    ctx.drawImage(canvas, 0, yPx, canvas.width, hPx, 0, 0, canvas.width, hPx)

    const sliceMm = (hPx / canvas.height) * imgH
    const dataUrl = slice.toDataURL('image/jpeg', 0.92)
    doc.addImage(dataUrl, 'JPEG', marginMm, marginMm, imgW, sliceMm)

    yPx = end
    pages += 1
    if (pages > 40) break // salvaguarda
  }
  return pages
}

/** True si hay contenido claro (texto/logo) — detecta capturas fallidas todo-negras. */
export function canvasHasVisibleContent(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d')
  if (!ctx || canvas.width < 8 || canvas.height < 8) return false
  const y = Math.min(160, Math.max(0, canvas.height - 8))
  const h = Math.min(48, canvas.height - y)
  const data = ctx.getImageData(0, y, canvas.width, h).data
  let bright = 0
  for (let i = 0; i < data.length; i += 32) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    if (lum > 35) bright += 1
  }
  return bright >= 12
}

/** PDF = mismo template Graphite que el HTML; captura on-screen + html2canvas (sin jspdf.html). */
export async function downloadTalentStatsReportPdf(
  input: TalentStatsReportInput,
): Promise<ReportSaveResult> {
  const [{ jsPDF }, html2canvas] = await Promise.all([
    import('jspdf'),
    import('html2canvas').then((m) => m.default),
  ])
  const filename = `neuragest-senal-pulse-${reportStamp(input)}.pdf`
  const html = buildTalentStatsReportHtml(input)
  const host = await mountReportForPdfCapture(html)

  try {
    const canvas = await html2canvas(host, {
      backgroundColor: REPORT_PDF_BG,
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      scrollX: 0,
      scrollY: -window.scrollY,
      windowWidth: REPORT_CAPTURE_WIDTH,
      width: REPORT_CAPTURE_WIDTH,
      foreignObjectRendering: false,
      onclone: (_doc, el) => {
        const s = el.style
        s.left = '0'
        s.top = '0'
        s.opacity = '1'
        s.visibility = 'visible'
        s.zIndex = '1'
        s.background = REPORT_PDF_BG
        s.color = '#fafafa'
        s.setProperty('-webkit-print-color-adjust', 'exact')
        s.setProperty('print-color-adjust', 'exact')
      },
    })

    // Guardrail: si no hay píxeles claros en la franja superior, la captura falló (PDF negro).
    if (!canvasHasVisibleContent(canvas)) {
      throw new Error(
        'La captura PDF quedó vacía (fondo negro sin contenido). Reintenta o usa Descargar HTML + Imprimir.',
      )
    }

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: true,
    })
    const breakYs = collectPdfBreakYs(host, canvas.height)
    appendCanvasPagesToPdf(doc, canvas, REPORT_PDF_MARGIN_MM, breakYs)

    const dataUri = doc.output('datauristring') as string
    const base64 = dataUri.includes(',') ? dataUri.split(',')[1] ?? '' : ''
    if (isTauri && base64) {
      try {
        const saved = await saveViaTauri(filename, base64, 'base64')
        return { path: saved.path, filename: saved.filename, via: 'tauri' }
      } catch {
        /* fallback */
      }
    }
    doc.save(filename)
    return { path: null, filename, via: 'blob' }
  } finally {
    host.remove()
  }
}

export async function openTalentStatsReport(input: TalentStatsReportInput): Promise<string | null> {
  const html = buildTalentStatsReportHtml(input)
  // Timestamp único: evita que el SO/navegador reabra un preview HTML cacheado del día.
  const stamp = `${reportStamp(input)}-${Date.now()}`
  const filename = `neuragest-senal-pulse-${stamp}.html`
  if (isTauri) {
    // WebView: window.open(blob:) suele no abrir nada; escribimos temp + open desde Rust.
    return invoke<string>('open_report_preview', { html, filename })
  }
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank', 'noopener,noreferrer')
  if (!win) {
    URL.revokeObjectURL(url)
    throw new Error('No se pudo abrir la vista previa (ventana bloqueada)')
  }
  return null
}

/** Abre Descargas en el explorador (apertura en Rust; shell.open JS no admite rutas locales). */
export async function openDownloadsFolder(): Promise<string> {
  if (!isTauri) {
    throw new Error('Abrir Descargas solo está disponible en la app de escritorio')
  }
  return invoke<string>('reveal_downloads_dir')
}

/** Utilidad para gráficos del apartado Señal. */
export function portfolioSeries(snapshots: MetricSnapshot[], hours = 24) {
  const since = Date.now() - hours * 3600_000
  const buckets = new Map<string, { viewers: number; n: number }>()
  for (const snap of snapshots) {
    const t = new Date(snap.capturedAt).getTime()
    if (t < since || !snap.isLive) continue
    const key = new Date(snap.capturedAt).toISOString().slice(0, 13) + ':00'
    const prev = buckets.get(key) ?? { viewers: 0, n: 0 }
    buckets.set(key, { viewers: prev.viewers + snap.viewers, n: prev.n + 1 })
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, value]) => ({
      time: time.slice(11, 16),
      viewers: Math.round(value.viewers / Math.max(1, value.n)),
    }))
}
