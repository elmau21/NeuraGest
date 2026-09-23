import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  Clock,
  Download,
  Eye,
  FileText,
  Film,
  FolderOpen,
  Image,
  Layers,
  Percent,
  Radio,
  RefreshCw,
  Share2,
  Tag,
  TrendingUp,
  Users,
  WifiOff,
} from '@/components/icons'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAppStore } from '@/stores/app-store'
import { useMetricHistory } from '@/hooks/useMetricHistory'
import { isTauri } from '@/services/twitch'
import {
  downloadTalentStatsReportCsv,
  downloadTalentStatsReportHtml,
  downloadTalentStatsReportPdf,
  loadTalentStatsReport,
  openDownloadsFolder,
  openTalentStatsReport,
  type ReportSaveResult,
} from '@/services/talent-stats-report'
import { formatEventSubTypeLabel } from '@/services/activity-format'
import {
  fetchTwitchTrackerSnapshots,
  TWITCHTRACKER_DISCLAIMER,
  type TwitchTrackerSnapshot,
} from '@/services/twitchtracker'
import {
  fetchInstagramMonthlySnapshots,
  INSTAGRAM_MONTHLY_DISCLAIMER,
  type InstagramMonthlySnapshot,
} from '@/services/instagram-monthly'
import {
  buildVrchatGroupKpi,
  fetchVrchatConfigStatus,
  fetchVrchatGroupSnapshots,
  formatSignedDelta,
  syncVrchatGroup,
  VRCHAT_DISCLAIMER,
  VRCHAT_POLL_INTERVAL_MS,
  type VrchatConfigStatus,
  type VrchatGroupSnapshot,
} from '@/services/vrchat-groups'
import { listClips, type ClipRecord } from '@/services/ops'
import { fetchWeeklyClips, type WeeklyClip } from '@/services/twitch-intelligence'
import { TwitchTrackerPanel } from '@/features/settings/TwitchTrackerPanel'
import { InstagramMonthlyPanel } from '@/features/settings/InstagramMonthlyPanel'
import { VrchatGroupsPanel } from '@/features/settings/VrchatGroupsPanel'
import { toastError, toastSuccess } from '@/stores/toast-store'
import { buildPortfolioOpsKpis } from './signal-pulse-kpis'
import {
  activityPctFromShare,
  activityShare7d,
  clipsViewsBars,
  followersDeltaBars,
  hoursWatchedBars,
  hoursWatchedShare,
  languageShare,
  liveOfflineShare,
  portfolioAudienceSeries,
  shareColor,
  talentBreakdownTable,
  viewersSparkline,
  type ShareSlice,
} from './signal-pulse-charts'

const tooltipStyle = {
  backgroundColor: 'var(--popover)',
  border: '1px solid var(--popover-border)',
  borderRadius: 2,
  color: 'var(--popover-foreground)',
  fontSize: 11,
}

/** Magenta plano Graphite — sin bloom. */
const SIGNAL = '#e12ec4'
const ZINC = '#a1a1aa'
const ZINC_BAR = '#52525b'
const ZINC_LIVE = '#e12ec4'

function feedbackSave(result: ReportSaveResult) {
  if (result.path) {
    toastSuccess(`Guardado en ${result.path}`)
  } else {
    toastSuccess(`Descarga iniciada: ${result.filename}`)
  }
}

function Sparkline({ data, color = SIGNAL }: { data: { t: string; v: number }[]; color?: string }) {
  if (data.length < 2) return null
  return (
    <div className="signal-spark" aria-hidden>
      <ResponsiveContainer width="100%" height={28}>
        <LineChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function ShareDonut({
  data,
  centerLabel,
  centerValue,
  valueSuffix = '',
}: {
  data: ShareSlice[]
  centerLabel: string
  centerValue: string
  valueSuffix?: string
}) {
  if (data.length === 0 || data.every((d) => d.value <= 0)) {
    return <p className="empty-state">Sin datos para este share.</p>
  }
  return (
    <div className="signal-donut">
      <div className="signal-donut-chart">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={52}
              outerRadius={78}
              paddingAngle={2}
              stroke="var(--bg-panel)"
              strokeWidth={1}
            >
              {data.map((entry, i) => (
                <Cell key={entry.key ?? entry.name} fill={shareColor(i)} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value, name) => [
                `${Number(value).toLocaleString('es-MX')}${valueSuffix}`,
                String(name),
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="signal-donut-center" aria-hidden>
          <strong>{centerValue}</strong>
          <span>{centerLabel}</span>
        </div>
      </div>
      <ul className="signal-donut-legend">
        {data.map((slice, i) => {
          const total = data.reduce((s, x) => s + x.value, 0)
          const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0
          return (
            <li key={slice.key ?? slice.name}>
              <i style={{ background: shareColor(i) }} />
              <span>{slice.name}</span>
              <b>
                {slice.value.toLocaleString('es-MX')}
                {valueSuffix} · {pct}%
              </b>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ActivityRing({ pct, active, total }: { pct: number; active: number; total: number }) {
  const r = 54
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, pct))
  const offset = c - (clamped / 100) * c
  return (
    <div className="signal-ring" role="img" aria-label={`Actividad 7d: ${clamped}%`}>
      <svg viewBox="0 0 140 140" width={160} height={160}>
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="var(--line)"
          strokeWidth="10"
        />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke={SIGNAL}
          strokeWidth="10"
          strokeLinecap="butt"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 70 70)"
        />
        <text x="70" y="66" textAnchor="middle" className="signal-ring-pct">
          {clamped}%
        </text>
        <text x="70" y="86" textAnchor="middle" className="signal-ring-sub">
          actividad
        </text>
      </svg>
      <p className="signal-ring-caption">
        {active}/{total} talentos con señal live en 7d
      </p>
    </div>
  )
}

export function SignalPulsePage() {
  const talents = useAppStore((s) => s.talents)
  const refreshTalentData = useAppStore((s) => s.refreshTalentData)
  const helixStatus = useAppStore((s) => s.helixStatus)
  const twitchLoading = useAppStore((s) => s.twitchLoading)
  const lastTwitchUpdate = useAppStore((s) => s.lastTwitchUpdate)
  const { snapshots, events, eventSub, reload, loading } = useMetricHistory(168)
  const [reportBusy, setReportBusy] = useState<'html' | 'pdf' | 'csv' | 'preview' | null>(null)
  const [ttSnapshots, setTtSnapshots] = useState<TwitchTrackerSnapshot[]>([])
  const [igSnapshots, setIgSnapshots] = useState<InstagramMonthlySnapshot[]>([])
  const [vrchatSnapshots, setVrchatSnapshots] = useState<VrchatGroupSnapshot[]>([])
  const [vrchatConfig, setVrchatConfig] = useState<VrchatConfigStatus | null>(null)
  const [weeklyClips, setWeeklyClips] = useState<WeeklyClip[]>([])
  const [dbClips, setDbClips] = useState<ClipRecord[]>([])
  const [supportLoading, setSupportLoading] = useState(false)

  const reloadSupport = useCallback(async () => {
    setSupportLoading(true)
    try {
      const [tt, ig, weekly, clips, vrcRows, vrcCfg] = await Promise.all([
        fetchTwitchTrackerSnapshots(720).catch(() => [] as TwitchTrackerSnapshot[]),
        fetchInstagramMonthlySnapshots(6).catch(() => [] as InstagramMonthlySnapshot[]),
        fetchWeeklyClips().catch(() => [] as WeeklyClip[]),
        listClips(200).catch(() => [] as ClipRecord[]),
        fetchVrchatGroupSnapshots(5).catch(() => [] as VrchatGroupSnapshot[]),
        fetchVrchatConfigStatus().catch(() => null),
      ])
      setTtSnapshots(tt)
      setIgSnapshots(ig)
      setWeeklyClips(weekly)
      setDbClips(clips)
      setVrchatSnapshots(vrcRows)
      setVrchatConfig(vrcCfg)
    } finally {
      setSupportLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshTalentData().then(() => {
      void reloadSupport()
    })
  }, [refreshTalentData, reloadSupport])

  // Poll lento VRChat (15 min): sync API si el bot está configurado; si no, solo relee BD.
  useEffect(() => {
    if (!isTauri) return
    const id = window.setInterval(() => {
      void (async () => {
        try {
          const cfg = await fetchVrchatConfigStatus()
          if (cfg?.configured) {
            const result = await syncVrchatGroup()
            if (result.needsTwoFactor) return
          }
          const rows = await fetchVrchatGroupSnapshots(5)
          setVrchatSnapshots(rows)
          if (cfg) setVrchatConfig(cfg)
        } catch {
          /* silencioso: el botón Sync sigue disponible */
        }
      })()
    }, VRCHAT_POLL_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [])

  const vrchatKpi = useMemo(
    () => buildVrchatGroupKpi(vrchatSnapshots, vrchatConfig),
    [vrchatSnapshots, vrchatConfig],
  )
  const live = useMemo(
    () => [...talents].filter((t) => t.isLive).sort((a, b) => b.viewers - a.viewers),
    [talents],
  )
  const totalViewers = live.reduce((sum, t) => sum + t.viewers, 0)

  const series24h = useMemo(() => portfolioAudienceSeries(snapshots, 24), [snapshots])
  const series7d = useMemo(() => portfolioAudienceSeries(snapshots, 168), [snapshots])
  const sparkViewers = useMemo(() => viewersSparkline(snapshots, 24), [snapshots])
  const hoursBars = useMemo(() => hoursWatchedBars(ttSnapshots, talents), [ttSnapshots, talents])
  const deltaBars = useMemo(() => followersDeltaBars(ttSnapshots, talents), [ttSnapshots, talents])
  const clipBars = useMemo(
    () => clipsViewsBars(weeklyClips, dbClips, talents),
    [weeklyClips, dbClips, talents],
  )
  const liveShare = useMemo(() => liveOfflineShare(talents), [talents])
  const langShare = useMemo(() => languageShare(talents), [talents])
  const ttHoursShare = useMemo(
    () => hoursWatchedShare(ttSnapshots, talents),
    [ttSnapshots, talents],
  )
  const actShare = useMemo(() => activityShare7d(talents, snapshots), [talents, snapshots])
  const actPct = useMemo(() => activityPctFromShare(actShare), [actShare])
  const breakdown = useMemo(
    () => talentBreakdownTable(talents, snapshots, ttSnapshots, weeklyClips, dbClips),
    [talents, snapshots, ttSnapshots, weeklyClips, dbClips],
  )

  const ranking = useMemo(
    () =>
      [...talents]
        .map((t) => ({
          name: t.displayName,
          login: t.login,
          viewers: t.isLive ? t.viewers : 0,
          followers: t.followers,
          live: t.isLive,
        }))
        .sort((a, b) => b.followers - a.followers)
        .slice(0, 10),
    [talents],
  )

  const recentEvents = useMemo(
    () =>
      [...events]
        .filter((ev) => Boolean(ev.occurredAt))
        .sort((a, b) => (b.occurredAt ?? '').localeCompare(a.occurredAt ?? ''))
        .slice(0, 12),
    [events],
  )

  const kpis = useMemo(
    () =>
      buildPortfolioOpsKpis({
        talents,
        snapshots,
        ttSnapshots,
        weeklyClips,
        dbClips,
        igSnapshots,
      }),
    [talents, snapshots, ttSnapshots, weeklyClips, dbClips, igSnapshots],
  )

  const ensureReport = async () => loadTalentStatsReport(talents)

  const runExport = async (kind: 'html' | 'pdf' | 'csv' | 'preview') => {
    setReportBusy(kind)
    try {
      const data = await ensureReport()
      if (kind === 'preview') {
        await openTalentStatsReport(data)
        toastSuccess('Vista previa abierta')
        return
      }
      const result =
        kind === 'html'
          ? await downloadTalentStatsReportHtml(data)
          : kind === 'csv'
            ? await downloadTalentStatsReportCsv(data)
            : await downloadTalentStatsReportPdf(data)
      feedbackSave(result)
    } catch (err) {
      toastError(err instanceof Error ? err.message : String(err))
    } finally {
      setReportBusy(null)
    }
  }

  const openFolder = async () => {
    try {
      const dir = await openDownloadsFolder()
      toastSuccess(`Carpeta: ${dir}`)
    } catch (err) {
      toastError(err instanceof Error ? err.message : String(err))
    }
  }

  if (!isTauri) {
    return (
      <div className="card agency-gate">
        <p>Señal Pulse corre en escritorio: ahí vive el pulso de audiencia en tiempo real.</p>
      </div>
    )
  }

  const helixBusy = twitchLoading || helixStatus === 'connecting'
  const syncLabel = lastTwitchUpdate
    ? `Sync ${new Date(lastTwitchUpdate).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`
    : helixStatus === 'error'
      ? 'Sync interrumpido'
      : 'Sync pendiente'

  const eventSubLabel =
    eventSub?.state === 'connected'
      ? `Red activa · ${eventSub.subscriptions}`
      : eventSub?.state === 'fallback_polling'
        ? 'Modo alterno'
        : eventSub?.state === 'connecting'
          ? 'Abriendo red…'
          : `Red ${eventSub?.state ?? 'en espera'}`

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Señal Pulse</h1>
          <p>Pulso de audiencia sobre la cartera Neura — datos reales, cobertura de roster completa.</p>
        </div>
        <div className="page-actions">
          <span className="signal-sync-meta" title="Última sync de streams y followers">
            {syncLabel}
          </span>
          <span
            className={`signal-eventsub-chip ${eventSub?.state ?? 'disconnected'}`}
            title="Salud del canal de eventos en vivo"
          >
            <WifiOff size={12} /> {eventSubLabel}
          </span>
          {live.length > 0 ? (
            <span className="signal-live-chip" title="Señal en vivo ahora">
              <Radio size={12} /> {live.length} en vivo · {totalViewers.toLocaleString('es-MX')}
            </span>
          ) : (
            <span className="signal-live-chip muted" title="Nadie al aire en la cartera">
              <Radio size={12} /> Nadie al aire
            </span>
          )}
          <button
            className="secondary"
            disabled={loading || supportLoading || helixBusy}
            onClick={() => {
              void refreshTalentData().then(() => {
                reload()
                void reloadSupport()
              })
            }}
          >
            <RefreshCw size={16} />{loading || supportLoading || helixBusy ? 'Actualizando…' : 'Actualizar'}
          </button>
          <button
            className="primary"
            disabled={reportBusy !== null}
            onClick={() => void runExport('html')}
          >
            <Download size={16} />{reportBusy === 'html' ? 'Guardando…' : 'Descargar HTML'}
          </button>
        </div>
      </div>

      <div className="signal-kpi-strip signal-kpi-strip-ops">
        <article className="signal-kpi">
          <span><Users size={14} /> Followers Twitch</span>
          <strong>{kpis.totalFollowers.toLocaleString('es-MX')}</strong>
          <em>Cartera Twitch · {talents.length} talentos</em>
        </article>
        <article className="signal-kpi">
          <span><Layers size={14} /> Alcance combinado</span>
          <strong>
            {supportLoading && kpis.igFollowers === 0 && kpis.combinedFollowers === kpis.totalFollowers
              ? '…'
              : kpis.combinedFollowers.toLocaleString('es-MX')}
          </strong>
          <em>
            Twitch + IG
            {kpis.igFollowers > 0
              ? ` · ${kpis.totalFollowers.toLocaleString('es-MX')} + ${kpis.igFollowers.toLocaleString('es-MX')}`
              : ' · sin snapshot IG'}
          </em>
        </article>
        <article className="signal-kpi">
          <span><Eye size={14} /> Avg viewers</span>
          <strong>{kpis.ttAvgViewers.toLocaleString('es-MX')}</strong>
          <Sparkline data={sparkViewers} />
          <em>~30d · Data NeuraLive · spark 24h</em>
        </article>
        <article className="signal-kpi">
          <span><Clock size={14} /> Hours watched</span>
          <strong>{kpis.ttHoursWatched.toLocaleString('es-MX')}</strong>
          <em>suma cartera · Data NeuraLive</em>
        </article>
        <article className="signal-kpi">
          <span><TrendingUp size={14} /> Followers Δ</span>
          <strong>{kpis.ttFollowersGrowth.toLocaleString('es-MX')}</strong>
          <em>crecimiento ~30d · Data NeuraLive</em>
        </article>
        <article className="signal-kpi">
          <span><Film size={14} /> Clips 7d</span>
          <strong>{supportLoading && kpis.clips7d === 0 ? '…' : kpis.clips7d.toLocaleString('es-MX')}</strong>
          <em>
            Cobertura de roster
            {kpis.clipsViewCount7d > 0
              ? ` · ${kpis.clipsViewCount7d.toLocaleString('es-MX')} views`
              : ''}
          </em>
        </article>
        <article className="signal-kpi">
          <span><Percent size={14} /> Actividad 7d</span>
          <strong>{kpis.activityPct7d}%</strong>
          <Sparkline data={series7d.map((p) => ({ t: p.time, v: p.viewers }))} color={ZINC} />
          <em>
            {kpis.activeTalents7d}/{talents.length} con señal · peak {kpis.peakViewers7d.toLocaleString('es-MX')}
          </em>
        </article>
      </div>

      <div className="signal-kpi-strip signal-kpi-strip-ig" aria-label="Instagram cartera Neura">
        <article className="signal-kpi">
          <span><Image size={14} /> IG followers</span>
          <strong>
            {supportLoading && kpis.igFollowers === 0 ? '…' : kpis.igFollowers.toLocaleString('es-MX')}
          </strong>
          <em>
            Cartera IG · {kpis.igHandles} handles
            {kpis.igSnapshotMonth ? ` · ${kpis.igSnapshotMonth.slice(0, 7)}` : ''}
          </em>
        </article>
        <article className="signal-kpi signal-kpi-ig-list">
          <span>Handles del mes</span>
          <ul className="signal-ig-handles">
            {igSnapshots.length === 0 && !supportLoading ? (
              <li>Sin snapshot — Sync IG mensual</li>
            ) : (
              (kpis.igSnapshotMonth
                ? igSnapshots.filter((r) => r.snapshotMonth === kpis.igSnapshotMonth)
                : igSnapshots
              )
                .filter(
                  (r, i, arr) =>
                    arr.findIndex(
                      (x) => x.instagramHandle.toLowerCase() === r.instagramHandle.toLowerCase(),
                    ) === i,
                )
                .sort((a, b) => b.followers - a.followers)
                .map((r) => (
                  <li key={r.instagramHandle}>
                    @{r.instagramHandle}
                    {r.login ? ` → ${r.login}` : ''}
                    <strong>{r.followers.toLocaleString('es-MX')}</strong>
                  </li>
                ))
            )}
          </ul>
        </article>
      </div>

      <div className="signal-kpi-strip signal-kpi-strip-vrchat" aria-label="VRChat Groups Neura">
        <article className="signal-kpi">
          <span><Users size={14} /> VRChat miembros</span>
          <strong>
            {supportLoading && vrchatKpi.memberCount === 0 && !vrchatKpi.syncedAt
              ? '…'
              : vrchatKpi.memberCount.toLocaleString('es-MX')}
          </strong>
          <em>
            {vrchatKpi.name}
            {vrchatKpi.memberDelta != null
              ? ` · Δ ${formatSignedDelta(vrchatKpi.memberDelta)}`
              : ' · sin historial Δ'}
          </em>
        </article>
        <article className="signal-kpi">
          <span><Radio size={14} /> Online ahora</span>
          <strong>
            {supportLoading && vrchatKpi.onlineMemberCount === 0 && !vrchatKpi.syncedAt
              ? '…'
              : vrchatKpi.onlineMemberCount.toLocaleString('es-MX')}
          </strong>
          <em>
            {vrchatKpi.onlineDelta != null
              ? `Δ ${formatSignedDelta(vrchatKpi.onlineDelta)} vs sync anterior`
              : 'Miembros en VRChat'}
          </em>
        </article>
        <article className="signal-kpi signal-kpi-vrchat-meta">
          <span>Grupo</span>
          {vrchatConfig != null && !vrchatConfig.configured ? (
            <>
              <strong className="signal-kpi-muted">Bot no configurado</strong>
              <em>{vrchatConfig.missingHint ?? 'Añade credenciales VRChat en `.env`'}</em>
            </>
          ) : (
            <>
              <strong>
                <a href={vrchatKpi.groupUrl} target="_blank" rel="noreferrer">
                  {vrchatKpi.name}
                </a>
              </strong>
              <em>
                {vrchatKpi.syncedAt
                  ? `Sync ${new Date(vrchatKpi.syncedAt).toLocaleString('es-MX')}`
                  : 'Sin snapshot — Sync VRChat'}
              </em>
            </>
          )}
        </article>
      </div>

      <div className="signal-support-strip signal-support-strip-ops">
        <article className="signal-support-kpi">
          <span>Peak viewers</span>
          <strong>{kpis.peakViewers7d.toLocaleString('es-MX')}</strong>
          <em>7d · snapshots · 24h {kpis.peakViewers24h.toLocaleString('es-MX')}</em>
        </article>
        <article className="signal-support-kpi">
          <span>Señal estimada</span>
          <strong>{kpis.estimatedLiveHours7d.toLocaleString('es-MX')}h</strong>
          <em>{kpis.streamDays7d} días con live · ~60s/captura</em>
        </article>
        <article className="signal-support-kpi">
          <span><Tag size={12} /> Idiomas · tags · CCL</span>
          <strong>
            {kpis.languages} · {kpis.uniqueTags} · {kpis.cclCount}
          </strong>
          <em>Composición de canal · idioma · tags · CCL</em>
        </article>
        <div className="signal-support-actions">
          <TwitchTrackerPanel compact onSynced={() => void reloadSupport()} />
          <InstagramMonthlyPanel compact onSynced={() => void reloadSupport()} />
          <VrchatGroupsPanel compact onSynced={() => void reloadSupport()} />
          <p className="integration-note">{TWITCHTRACKER_DISCLAIMER}</p>
          <p className="integration-note">{INSTAGRAM_MONTHLY_DISCLAIMER}</p>
          <p className="integration-note">{VRCHAT_DISCLAIMER}</p>
        </div>
      </div>

      {eventSub?.state === 'fallback_polling' && (
        <p className="signal-eventsub-banner warn" role="status">
          Sync de red en modo alterno — muestreo periódico activo.
          {eventSub.lastError ? ` ${eventSub.lastError}` : ' Reintentando con backoff.'}
        </p>
      )}
      {eventSub?.state === 'connecting' && (
        <p className="signal-eventsub-banner" role="status">
          Abriendo canal de eventos… si tarda más de ~20s pasará a modo alterno automáticamente.
        </p>
      )}
      {eventSub?.lastError && eventSub.state !== 'fallback_polling' && eventSub.state !== 'connected' && (
        <p className="signal-eventsub-banner warn" role="status">{eventSub.lastError}</p>
      )}

      <div className="signal-grid">
        <section className="card signal-panel">
          <header>
            <h3><Activity size={15} /> Audiencia 24h</h3>
            <span>Promedio de viewers en snapshots en vivo</span>
          </header>
          <div className="signal-chart">
            {series24h.length === 0 ? (
              <p className="empty-state">Sin historial aún. Deja la app sincronizando.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={series24h}>
                  <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fill: ZINC, fontSize: 10 }} />
                  <YAxis tick={{ fill: ZINC, fontSize: 10 }} width={40} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => [
                      `${Number(value).toLocaleString('es-MX')} avg`,
                      'Viewers',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="viewers"
                    stroke={SIGNAL}
                    fill={SIGNAL}
                    fillOpacity={0.12}
                    strokeWidth={1.75}
                    name="viewers"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="card signal-panel">
          <header>
            <h3><Activity size={15} /> Audiencia 7d</h3>
            <span>Avg diario + peak · metric_snapshots</span>
          </header>
          <div className="signal-chart">
            {series7d.length === 0 ? (
              <p className="empty-state">Sin datos de 7 días todavía.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={series7d}>
                  <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fill: ZINC, fontSize: 10 }} />
                  <YAxis tick={{ fill: ZINC, fontSize: 10 }} width={40} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value, name) => [
                      Number(value).toLocaleString('es-MX'),
                      name === 'peak' ? 'Peak' : 'Avg',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="peak"
                    stroke={ZINC}
                    fill={ZINC}
                    fillOpacity={0.08}
                    strokeWidth={1}
                    name="peak"
                  />
                  <Area
                    type="monotone"
                    dataKey="viewers"
                    stroke={SIGNAL}
                    fill={SIGNAL}
                    fillOpacity={0.14}
                    strokeWidth={1.75}
                    name="viewers"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      <div className="signal-grid">
        <section className="card signal-panel">
          <header>
            <h3><Clock size={15} /> Hours watched · talento</h3>
            <span>~30d · top cartera · Data NeuraLive</span>
          </header>
          <div className="signal-chart">
            {hoursBars.length === 0 ? (
              <p className="empty-state">Sin historial de audiencia. Sincroniza arriba.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={hoursBars} layout="vertical" margin={{ left: 4, right: 8 }}>
                  <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fill: ZINC, fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fill: ZINC, fontSize: 10 }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => [`${Number(value).toLocaleString('es-MX')} h`, 'Hours watched']}
                  />
                  <Bar dataKey="value" radius={0} name="hours">
                    {hoursBars.map((entry) => (
                      <Cell key={entry.login} fill={entry.live ? ZINC_LIVE : ZINC_BAR} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="card signal-panel">
          <header>
            <h3><TrendingUp size={15} /> Δ Followers ranking</h3>
            <span>Crecimiento ~30d · Data NeuraLive</span>
          </header>
          <div className="signal-chart">
            {deltaBars.length === 0 ? (
              <p className="empty-state">Sin Δ followers en el historial de audiencia.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={deltaBars} layout="vertical" margin={{ left: 4, right: 8 }}>
                  <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fill: ZINC, fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fill: ZINC, fontSize: 10 }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => [
                      `${Number(value) >= 0 ? '+' : ''}${Number(value).toLocaleString('es-MX')}`,
                      'Δ followers',
                    ]}
                  />
                  <Bar dataKey="value" radius={0} name="delta">
                    {deltaBars.map((entry) => (
                      <Cell
                        key={entry.login}
                        fill={entry.value >= 0 ? (entry.live ? ZINC_LIVE : '#3f3f46') : '#7f1d1d'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      <div className="signal-grid signal-grid-shares">
        <section className="card signal-panel">
          <header>
            <h3><Radio size={15} /> Live vs offline</h3>
            <span>Canales de la cartera ahora</span>
          </header>
          <div className="signal-chart signal-chart-share">
            <ShareDonut
              data={liveShare}
              centerLabel="canales"
              centerValue={String(talents.length)}
            />
          </div>
        </section>

        <section className="card signal-panel">
          <header>
            <h3><Tag size={15} /> Idiomas</h3>
            <span>Composición del roster</span>
          </header>
          <div className="signal-chart signal-chart-share">
            <ShareDonut data={langShare} centerLabel="idiomas" centerValue={String(kpis.languages)} />
          </div>
        </section>

        <section className="card signal-panel">
          <header>
            <h3><Clock size={15} /> Hours share</h3>
            <span>Hours watched ~30d · top + resto</span>
          </header>
          <div className="signal-chart signal-chart-share">
            <ShareDonut
              data={ttHoursShare}
              centerLabel="h watched"
              centerValue={
                kpis.ttHoursWatched > 999
                  ? `${Math.round(kpis.ttHoursWatched / 1000)}k`
                  : String(Math.round(kpis.ttHoursWatched))
              }
              valueSuffix=" h"
            />
          </div>
        </section>

        <section className="card signal-panel">
          <header>
            <h3><Percent size={15} /> Actividad 7d</h3>
            <span>Anillo · talentos con señal live</span>
          </header>
          <div className="signal-chart signal-chart-share signal-chart-ring">
            <ActivityRing pct={actPct} active={kpis.activeTalents7d} total={talents.length} />
          </div>
        </section>
      </div>

      <div className="signal-grid">
        <section className="card signal-panel">
          <header>
            <h3><Film size={15} /> Clips views 7d</h3>
            <span>Clips 7d · por talento</span>
          </header>
          <div className="signal-chart">
            {clipBars.length === 0 ? (
              <p className="empty-state">Sin clips en ventana 7d.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={clipBars} margin={{ left: 0, right: 8, bottom: 28 }}>
                  <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: ZINC, fontSize: 9 }}
                    interval={0}
                    angle={-28}
                    textAnchor="end"
                    height={48}
                  />
                  <YAxis tick={{ fill: ZINC, fontSize: 10 }} width={44} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => [Number(value).toLocaleString('es-MX'), 'Views']}
                  />
                  <Bar dataKey="value" radius={0} fill={SIGNAL} fillOpacity={0.85} name="views" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="card signal-panel">
          <header>
            <h3>Top followers</h3>
            <span>Cartera ordenada · barra magenta = live</span>
          </header>
          <div className="signal-chart">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ranking} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fill: ZINC, fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={88} tick={{ fill: ZINC, fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="followers" radius={0}>
                  {ranking.map((entry) => (
                    <Cell key={entry.login} fill={entry.live ? SIGNAL : ZINC_BAR} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="signal-grid">
        <section className="card signal-panel signal-table-panel" style={{ gridColumn: '1 / -1' }}>
          <header>
            <h3>Breakdown por talento</h3>
            <span>Live · audiencia · clips · señal 7d</span>
          </header>
          <div className="signal-table-wrap">
            {breakdown.length === 0 ? (
              <p className="empty-state">Sin roster.</p>
            ) : (
              <table className="signal-table">
                <thead>
                  <tr>
                    <th>Talento</th>
                    <th title="Viewers en vivo ahora">Live</th>
                    <th title="Followers Twitch">Foll.</th>
                    <th title="Hours watched ~30d · Data NeuraLive">H.watch</th>
                    <th title="Δ followers · Data NeuraLive">Δ Foll.</th>
                    <th title="Avg viewers · Data NeuraLive">Avg</th>
                    <th title="Clips 7d">Clips</th>
                    <th title="Views clips 7d">Views</th>
                    <th title="Horas live estimadas 7d">Señal h</th>
                    <th title="Peak viewers 7d">Peak</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((row) => (
                    <tr key={row.login} className={row.live ? 'is-live' : undefined}>
                      <td>
                        <b>{row.name}</b>
                        <code>@{row.login}</code>
                      </td>
                      <td>{row.live ? row.viewers.toLocaleString('es-MX') : '—'}</td>
                      <td>{row.followers.toLocaleString('es-MX')}</td>
                      <td>{row.ttHours ? row.ttHours.toLocaleString('es-MX') : '—'}</td>
                      <td className={row.ttDelta > 0 ? 'pos' : row.ttDelta < 0 ? 'neg' : undefined}>
                        {row.ttDelta
                          ? `${row.ttDelta > 0 ? '+' : ''}${row.ttDelta.toLocaleString('es-MX')}`
                          : '—'}
                      </td>
                      <td>{row.ttAvg ? row.ttAvg.toLocaleString('es-MX') : '—'}</td>
                      <td>{row.clips7d || '—'}</td>
                      <td>{row.clipViews7d ? row.clipViews7d.toLocaleString('es-MX') : '—'}</td>
                      <td>{row.liveHoursEst7d || '—'}</td>
                      <td>{row.peak7d ? row.peak7d.toLocaleString('es-MX') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      <div className="signal-grid signal-grid-bottom">
        <section className="card signal-panel">
          <header>
            <h3>Señal en vivo</h3>
            <span>Título · juego · tags · idioma</span>
          </header>
          <ul className="signal-live-list">
            {live.length === 0 && <li className="empty-state">Nadie al aire.</li>}
            {live.map((t) => (
              <li key={t.login}>
                {t.avatar ? <img src={t.avatar} alt="" /> : <span className="avatar-placeholder">{t.displayName.slice(0, 2)}</span>}
                <div>
                  <b>{t.displayName}</b>
                  <span>{t.viewers.toLocaleString('es-MX')} viewers · {t.category || '—'}</span>
                  <em>{t.title || 'Sin título'}</em>
                  <div className="signal-tags">
                    {t.language ? <span className="signal-chip">{t.language}</span> : null}
                    {(t.tags ?? []).slice(0, 4).map((tag) => (
                      <span key={tag} className="signal-chip">{tag}</span>
                    ))}
                    {(t.contentClassificationLabels ?? []).slice(0, 2).map((label) => (
                      <span key={label} className="signal-chip ccl">{label}</span>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card signal-panel">
          <header>
            <h3>Feed de señal</h3>
            <span>En vivo · offline · updates · follows · subs · raids · shared chat</span>
          </header>
          <ul className="signal-event-feed">
            {recentEvents.length === 0 && <li className="empty-state">Sin actividad reciente en la red.</li>}
            {recentEvents.map((ev) => (
              <li key={`${ev.id}-${ev.occurredAt}`}>
                <code className="signal-event-badge" title={ev.eventType}>
                  {formatEventSubTypeLabel(ev.eventType)}
                </code>
                <div className="signal-event-body">
                  <b>@{ev.login}</b>
                  <span>
                    {ev.occurredAt
                      ? new Date(ev.occurredAt).toLocaleString('es-MX')
                      : '—'}
                  </span>
                  {(ev.title || ev.categoryName) && (
                    <em>{[ev.categoryName, ev.title].filter(Boolean).join(' · ')}</em>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p className="integration-note">
            <Link to="/senal/coordinacion" className="coord-inline-link">
              <Share2 size={12} aria-hidden /> Coordinación
            </Link>
          </p>
        </section>
      </div>

      <section className="card signal-panel signal-report-cta">
        <div>
          <h3><Download size={15} /> Reporte cartera</h3>
          <p>
            Exporta HTML / PDF / CSV a Descargas — inteligencia de audiencia y roster completo.
          </p>
        </div>
        <div className="signal-report-actions">
          <button className="primary" disabled={reportBusy !== null} onClick={() => void runExport('html')}>
            <FileText size={16} />{reportBusy === 'html' ? 'Guardando…' : 'HTML'}
          </button>
          <button className="secondary" disabled={reportBusy !== null} onClick={() => void runExport('pdf')}>
            <Download size={16} />{reportBusy === 'pdf' ? 'Guardando…' : 'PDF'}
          </button>
          <button className="secondary" disabled={reportBusy !== null} onClick={() => void runExport('csv')}>
            <Download size={16} />{reportBusy === 'csv' ? 'Guardando…' : 'CSV'}
          </button>
          <button className="secondary" disabled={reportBusy !== null} onClick={() => void runExport('preview')}>
            <FileText size={16} />{reportBusy === 'preview' ? 'Abriendo…' : 'Vista previa'}
          </button>
          <button className="secondary" onClick={() => void openFolder()}>
            <FolderOpen size={16} /> Abrir Descargas
          </button>
        </div>
      </section>
    </>
  )
}
