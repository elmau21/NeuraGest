import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Activity,
  ArrowLeft,
  ChevronRight,
  Database,
  Eye,
  Film,
  Gamepad2,
  Info,
  Layers,
  Loader2,
  Radio,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAppStore } from '@/stores/app-store'
import { fetchMetricSnapshots, fetchStreamEvents, type MetricSnapshot, type StreamEvent } from '@/services/metrics'
import { fetchTwitchTrackerSnapshots, type TwitchTrackerSnapshot } from '@/services/twitchtracker'
import { collectTalentMetrics, fetchStreamSessions, fetchTalentVods } from '@/services/talent-collector'
import type { StreamSessionRecord, TalentVodRecord } from '@/services/external-stats'
import { listClips, type ClipRecord } from '@/services/ops'
import { isTauri } from '@/services/twitch'
import { TWITCHTRACKER_DISCLAIMER } from '@/services/twitchtracker'
import { formatStat } from '@/features/platform-stats/platform-stats-utils'
import {
  buildLifetimeStats,
  buildTalentCategoryBreakdown,
  buildTalentPerformanceSummary,
  buildTalentViewershipSeries,
  filterTalentData,
  formatCompact,
  formatDeltaBadge,
  formatHours,
  metricSourceBadge,
  periodLabel,
  type ExternalStatsSource,
  type MetricDelta,
  type TalentPeriod,
} from './talent-profile-utils'

type ProfileTab = 'overview' | 'viewers' | 'games' | 'clips'

const PERIOD_OPTIONS: { id: TalentPeriod; label: string }[] = [
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: '3m', label: '3m' },
  { id: 'all', label: 'Todo' },
]

const PROFILE_TABS: { id: ProfileTab; label: string; icon: typeof Layers }[] = [
  { id: 'overview', label: 'Resumen', icon: Layers },
  { id: 'viewers', label: 'Viewers', icon: Eye },
  { id: 'games', label: 'Categorías', icon: Gamepad2 },
  { id: 'clips', label: 'Clips', icon: Film },
]

const PIE_COLORS = ['#9146ff', '#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899']

const chartTooltipStyle = {
  backgroundColor: 'var(--popover, #0d1117)',
  border: '1px solid var(--popover-border, #313947)',
  borderRadius: 5,
  color: 'var(--popover-foreground, #e5e7eb)',
  fontSize: 11,
}

function DeltaBadge({ delta, invert }: { delta: MetricDelta; invert?: boolean }) {
  const positive = invert ? delta.value <= 0 : delta.value >= 0
  const Icon = positive ? TrendingUp : TrendingDown
  if (delta.pct == null && delta.value === 0) return null
  return (
    <span className={`tp-delta ${positive ? 'up' : 'down'}`}>
      <Icon size={12} />
      {formatDeltaBadge(delta.value, delta.pct)}
    </span>
  )
}

function PerformanceCard({
  label,
  value,
  delta,
  meta,
  source,
  tone,
  invertDelta,
}: {
  label: string
  value: string
  delta: MetricDelta
  meta?: string
  source?: ExternalStatsSource
  tone?: string
  invertDelta?: boolean
}) {
  const sourceLabel = metricSourceBadge(source)
  return (
    <article className={`tp-perf-card ${tone ?? ''}`}>
      <div className="tp-perf-label">
        <span>{label}</span>
        {sourceLabel && <span className="tp-source-badge">{sourceLabel}</span>}
      </div>
      <strong>{value}</strong>
      <DeltaBadge delta={delta} invert={invertDelta} />
      {meta && <small>{meta}</small>}
    </article>
  )
}

export function TalentProfilePage() {
  const { login: routeLogin } = useParams<{ login: string }>()
  const navigate = useNavigate()
  const talents = useAppStore((s) => s.talents)
  const refresh = useAppStore((s) => s.refreshTalentData)
  const loadingLive = useAppStore((s) => s.twitchLoading)

  const [period, setPeriod] = useState<TalentPeriod>('30d')
  const [tab, setTab] = useState<ProfileTab>('overview')
  const [snapshots, setSnapshots] = useState<MetricSnapshot[]>([])
  const [events, setEvents] = useState<StreamEvent[]>([])
  const [ttSnapshots, setTtSnapshots] = useState<TwitchTrackerSnapshot[]>([])
  const [vods, setVods] = useState<TalentVodRecord[]>([])
  const [sessions, setSessions] = useState<StreamSessionRecord[]>([])
  const [clips, setClips] = useState<ClipRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [collecting, setCollecting] = useState(false)
  const [collectNote, setCollectNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const login = routeLogin?.toLowerCase() ?? ''
  const talent = useMemo(
    () => talents.find((t) => t.login.toLowerCase() === login),
    [talents, login],
  )

  const reloadHistory = useCallback(async () => {
    if (!login || !isTauri) return
    setLoading(true)
    setError(null)
    try {
      const [metricRows, eventRows, ttRows, vodRows, sessionRows, clipRows] = await Promise.all([
        fetchMetricSnapshots(8760, login),
        fetchStreamEvents(8760, login),
        fetchTwitchTrackerSnapshots(8760),
        fetchTalentVods(login, 90),
        fetchStreamSessions(8760, login),
        listClips(200),
      ])
      setSnapshots(metricRows.sort(
        (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime(),
      ))
      setEvents(eventRows)
      setTtSnapshots(filterTalentData(ttRows, login))
      setVods(vodRows)
      setSessions(sessionRows)
      setClips(clipRows.filter(
        (clip) => clip.talentLogin?.toLowerCase() === login || clip.talentId === talent?.id,
      ))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [login, talent?.id])

  const handleCollectNow = useCallback(async () => {
    if (!login || !isTauri) return
    setCollecting(true)
    setError(null)
    setCollectNote(null)
    try {
      const result = await collectTalentMetrics(login)
      setCollectNote(result.note)
      if (result.ttErrors.length > 0) {
        setError(result.ttErrors.join(' · '))
      }
      await reloadHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCollecting(false)
    }
  }, [login, reloadHistory])

  useEffect(() => {
    void reloadHistory()
  }, [reloadHistory])

  const performance = useMemo(
    () => buildTalentPerformanceSummary(snapshots, events, ttSnapshots, period, vods, sessions),
    [snapshots, events, ttSnapshots, period, vods, sessions],
  )
  const lifetime = useMemo(
    () => buildLifetimeStats(snapshots, events, ttSnapshots, clips, talent?.followers ?? null, vods, sessions),
    [snapshots, events, ttSnapshots, clips, talent?.followers, vods, sessions],
  )
  const viewershipSeries = useMemo(
    () => buildTalentViewershipSeries(snapshots, ttSnapshots, period),
    [snapshots, ttSnapshots, period],
  )
  const categories = useMemo(
    () => buildTalentCategoryBreakdown(snapshots, sessions, period),
    [snapshots, sessions, period],
  )

  const periodClips = useMemo(() => {
    const now = Date.now()
    const hours = period === '7d' ? 168 : period === '30d' ? 720 : period === '3m' ? 2160 : 8760 * 5
    const from = now - hours * 3_600_000
    return clips.filter((clip) => {
      if (!clip.publishedAt) return period === 'all'
      return new Date(clip.publishedAt).getTime() >= from
    })
  }, [clips, period])

  if (!login) {
    return (
      <div className="tp-page">
        <div className="tp-empty">
          <Info size={18} />
          <strong>Sin login</strong>
          <p>Selecciona un talento desde la lista.</p>
          <Link to="/talentos" className="tp-back-link">← Volver a talentos</Link>
        </div>
      </div>
    )
  }

  if (!talent) {
    return (
      <div className="tp-page">
        <div className="tp-empty">
          <Info size={18} />
          <strong>Talento no encontrado</strong>
          <p>@{login} no está en el roster NeuraLive.</p>
          <Link to="/talentos" className="tp-back-link">← Volver a talentos</Link>
        </div>
      </div>
    )
  }

  const isLoading = loading || loadingLive || collecting
  const perf = performance.current
  const src = perf.sources

  return (
    <div className="tp-page">
      <div className="tp-header">
        <button type="button" className="tp-back" onClick={() => navigate('/talentos')} aria-label="Volver">
          <ArrowLeft size={16} />
        </button>
        <div className="tp-avatar-wrap">
          {talent.avatar
            ? <img src={talent.avatar} alt="" className="tp-avatar" />
            : <div className="tp-avatar tp-avatar-fallback">{talent.displayName.slice(0, 2).toUpperCase()}</div>}
          {talent.isLive && <span className="tp-live-badge">LIVE</span>}
        </div>
        <div className="tp-header-meta">
          <span className="tp-eyebrow">PERFIL HISTÓRICO · NEURALIVE</span>
          <h1>{talent.displayName}</h1>
          <p>
            @{talent.login}
            {lifetime.ttRank != null && (
              <span className="tp-rank"><Trophy size={12} /> Rank TT #{formatStat(lifetime.ttRank)}</span>
            )}
            {talent.isLive && (
              <span className="tp-live-inline"><Radio size={12} /> {talent.viewers.toLocaleString('es-MX')} viewers · {talent.category}</span>
            )}
          </p>
        </div>
        <div className="tp-header-actions">
          <button
            type="button"
            className="tp-sync tp-collect"
            disabled={isLoading}
            onClick={() => { void handleCollectNow() }}
            title="Actualizar datos de Twitch, estadísticas externas y recálculo"
          >
            <Database size={14} className={collecting ? 'tp-spin' : ''} />
            {collecting ? 'Recolectando…' : 'Recolectar ahora'}
          </button>
          <button type="button" className="tp-sync" disabled={isLoading} onClick={() => { void refresh(); void reloadHistory() }}>
            <RefreshCw size={14} className={isLoading && !collecting ? 'tp-spin' : ''} />
            {isLoading && !collecting ? 'Actualizando…' : 'Actualizar en vivo'}
          </button>
          <Link to={`/portal/${login}`} className="tp-link-btn">Portal <ChevronRight size={14} /></Link>
          <Link to="/ciencia-datos" className="tp-link-btn">ML <ChevronRight size={14} /></Link>
        </div>
      </div>

      {!isTauri && (
        <div className="tp-banner warning">
          Histórico completo requiere NeuraGest en la app de escritorio (historial guardado + estadísticas externas).
        </div>
      )}

      {error && <div className="tp-banner error">Error cargando histórico: {error}</div>}
      {collectNote && !error && (
        <div className="tp-banner info">
          <Database size={14} />
          {collectNote}
        </div>
      )}

      <div className="tp-period-bar">
        <div>
          <strong>Performance Summary</strong>
          <span>{periodLabel(period)} vs periodo anterior</span>
        </div>
        <div className="tp-period-toggle">
          {PERIOD_OPTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={period === item.id ? 'active' : ''}
              onClick={() => setPeriod(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <section className="tp-perf-grid">
        <PerformanceCard
          label="Horas en stream"
          value={formatHours(perf.hoursStreamed)}
          delta={performance.deltas.hoursStreamed}
          source={src.hoursStreamed}
          meta="Tiempo real → sesiones → repeticiones → TT"
          tone="purple"
        />
        <PerformanceCard
          label="Viewers promedio"
          value={formatStat(perf.avgViewers)}
          delta={performance.deltas.avgViewers}
          source={src.avgViewers}
          meta="CCV local; TT rolling 30d si vacío"
          tone="cyan"
        />
        <PerformanceCard
          label="Pico de viewers"
          value={formatStat(perf.peakViewers)}
          delta={performance.deltas.peakViewers}
          source={src.peakViewers}
          meta="Capturas en vivo; TT como respaldo"
          tone="live"
        />
        <PerformanceCard
          label="Horas vistas (est.)"
          value={formatStat(perf.hoursWatched)}
          delta={performance.deltas.hoursWatched}
          source={src.hoursWatched}
          meta="∫ CCV × Δt o hours_watched TT"
          tone="blue"
        />
        <PerformanceCard
          label="Followers ganados"
          value={formatCompact(perf.followersGained)}
          delta={performance.deltas.followersGained}
          source={src.followersGained}
          meta="Resumen rolling 30d de estadísticas externas"
          tone="amber"
        />
        <PerformanceCard
          label="Followers / hora"
          value={perf.followersPerHour != null ? perf.followersPerHour.toLocaleString('es-MX') : '—'}
          delta={performance.deltas.followersPerHour}
          source={src.followersPerHour}
          meta="Crecimiento / horas stream"
          tone="purple"
        />
        <PerformanceCard
          label="Categorías jugadas"
          value={formatStat(perf.gamesStreamed)}
          delta={performance.deltas.gamesStreamed}
          source={src.gamesStreamed}
          meta="Capturas + sesiones de stream"
          tone="cyan"
        />
        <PerformanceCard
          label="Días activos"
          value={formatStat(perf.activeDays)}
          delta={performance.deltas.activeDays}
          source={src.activeDays}
          meta="Capturas, repeticiones o sesiones"
          tone="blue"
        />
      </section>

      <section className="tp-lifetime">
        <h2>Lifetime Overview</h2>
        <div className="tp-lifetime-grid">
          <article><span>Horas totales stream</span><strong>{formatHours(lifetime.totalHoursStreamed)}</strong></article>
          <article><span>Pico histórico CCV</span><strong>{formatStat(lifetime.highestViewers)}</strong></article>
          <article><span>Followers Twitch</span><strong>{formatCompact(lifetime.followersHelix)}</strong></article>
          <article><span>Followers (externo)</span><strong>{formatCompact(lifetime.followersTt)}</strong></article>
          <article><span>Categorías lifetime</span><strong>{formatStat(lifetime.gamesCount)}</strong></article>
          <article><span>Clips indexados</span><strong>{formatStat(lifetime.totalClips)}</strong><small>{formatStat(lifetime.clipViews)} views</small></article>
        </div>
      </section>

      <nav className="an-tabs tp-tabs" aria-label="Secciones del perfil">
        {PROFILE_TABS.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? 'active' : ''}
              onClick={() => setTab(item.id)}
            >
              <Icon size={13} />
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="tp-tab-content">
        {loading && snapshots.length === 0 && (
          <div className="tp-loading"><Loader2 size={18} className="tp-spin" /> Cargando histórico…</div>
        )}

        {tab === 'overview' && (
          <div className="tp-grid">
            <section className="tp-chart-panel tp-span-2">
              <header><h3>Viewers en el tiempo</h3><span>{viewershipSeries.length} puntos · {periodLabel(period)}</span></header>
              {viewershipSeries.length < 2 ? (
                <div className="tp-empty compact">
                  <Activity size={16} />
                  <p>Sin capturas en vivo. Pulsa «Recolectar ahora» para actualizar datos de Twitch y estadísticas externas.</p>
                </div>
              ) : (
                <div className="tp-chart">
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={viewershipSeries}>
                      <defs>
                        <linearGradient id="tpViewersGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#9146ff" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#9146ff" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--chart-grid, #1e2530)" vertical={false} />
                      <XAxis dataKey="at" tick={{ fontSize: 9, fill: '#8b95a7' }} minTickGap={28} />
                      <YAxis tick={{ fontSize: 9, fill: '#8b95a7' }} width={42} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Area type="monotone" dataKey="viewers" stroke="#9146ff" fill="url(#tpViewersGrad)" name="Viewers" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <section className="tp-chart-panel">
              <header><h3>Top categorías</h3><span>{categories.length} juegos</span></header>
              {categories.length === 0 ? (
                <div className="tp-empty compact"><Gamepad2 size={16} /><p>Sin categorías registradas.</p></div>
              ) : (
                <div className="tp-donut-wrap">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={categories.slice(0, 6)} dataKey="snapshots" nameKey="category" innerRadius={48} outerRadius={72} paddingAngle={2}>
                        {categories.slice(0, 6).map((_, index) => (
                          <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={chartTooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="tp-share-list">
                    {categories.slice(0, 6).map((row, index) => (
                      <li key={row.category}>
                        <span className="tp-dot" style={{ background: PIE_COLORS[index % PIE_COLORS.length] }} />
                        <span>{row.category}</span>
                        <em>{row.sharePct}%</em>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>
        )}

        {tab === 'viewers' && (
          <section className="tp-chart-panel">
            <header><h3>Viewers over time</h3><span>Histórico Twitch + respaldo externo</span></header>
            {viewershipSeries.length < 2 ? (
              <div className="tp-empty"><Eye size={18} /><strong>Sin serie de viewers</strong><p>Recolectar ahora usa promedios externos como respaldo si no hay capturas locales.</p></div>
            ) : (
              <div className="tp-chart tp-chart-lg">
                <ResponsiveContainer width="100%" height={340}>
                  <AreaChart data={viewershipSeries}>
                    <CartesianGrid stroke="var(--chart-grid, #1e2530)" vertical={false} />
                    <XAxis dataKey="at" tick={{ fontSize: 9, fill: '#8b95a7' }} minTickGap={24} />
                    <YAxis tick={{ fontSize: 9, fill: '#8b95a7' }} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Area type="monotone" dataKey="viewers" stroke="#9146ff" fill="#9146ff33" name="CCV" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        )}

        {tab === 'games' && (
          <section className="tp-chart-panel">
            <header><h3>Desglose por categoría</h3><span>{periodLabel(period)}</span></header>
            {categories.length === 0 ? (
              <div className="tp-empty"><Gamepad2 size={18} /><strong>Sin categorías</strong><p>Las categorías se registran en capturas en vivo.</p></div>
            ) : (
              <div className="tp-chart tp-chart-md">
                <ResponsiveContainer width="100%" height={Math.max(240, categories.length * 36)}>
                  <BarChart data={categories.slice(0, 12)} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 4 }}>
                    <CartesianGrid stroke="var(--chart-grid, #1e2530)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9, fill: '#8b95a7' }} />
                    <YAxis type="category" dataKey="category" width={120} tick={{ fontSize: 9, fill: '#c4b5fd' }} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Bar dataKey="avgViewers" name="Avg viewers" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        )}

        {tab === 'clips' && (
          <section className="tp-chart-panel">
            <header><h3>Clips del periodo</h3><span>{periodClips.length} clips · {formatStat(periodClips.reduce((s, c) => s + c.viewCount, 0))} views</span></header>
            {periodClips.length === 0 ? (
              <div className="tp-empty"><Film size={18} /><strong>Sin clips</strong><p>Los clips se guardan automáticamente al actualizar datos de Twitch.</p></div>
            ) : (
              <div className="tp-table-wrap">
                <table className="tp-table">
                  <thead><tr><th>Título</th><th>Views</th><th>Publicado</th><th></th></tr></thead>
                  <tbody>
                    {periodClips.slice(0, 20).map((clip) => (
                      <tr key={clip.id}>
                        <td>{clip.title ?? clip.twitchClipId}</td>
                        <td>{clip.viewCount.toLocaleString('es-MX')}</td>
                        <td>{clip.publishedAt ? new Date(clip.publishedAt).toLocaleDateString('es-MX') : '—'}</td>
                        <td>{clip.url && <a href={clip.url} target="_blank" rel="noreferrer">Abrir</a>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>

      <section className="tp-sources-panel">
        <h2>Fuentes de datos</h2>
        <ul className="tp-sources-list">
          <li><strong>Twitch</strong> — estado en vivo, repeticiones, clips y followers actuales.</li>
          <li><strong>Tiempo real</strong> — inicio y fin de stream para calcular horas y sesiones.</li>
          <li><strong>Estadísticas externas</strong> — {TWITCHTRACKER_DISCLAIMER}</li>
          <li><strong>Prioridad del perfil</strong> — datos locales y tiempo real &gt; repeticiones (horas) &gt; resumen externo rolling 30d.</li>
        </ul>
        <p className="tp-sources-meta">
          {ttSnapshots.length > 0
            ? `Última sincronización externa: ${new Date(ttSnapshots[ttSnapshots.length - 1]?.syncedAt ?? '').toLocaleString('es-MX')}`
            : 'Sin estadísticas externas — usa Recolectar ahora'}
          {' · '}
          {vods.length} repeticiones indexadas · {sessions.length} sesiones · {snapshots.filter((s) => s.isLive).length} capturas en vivo
        </p>
      </section>

      <p className="tp-footnote">
        <Info size={12} />
        Fuentes: Twitch y historial NeuraGest.
      </p>
    </div>
  )
}

export default TalentProfilePage
