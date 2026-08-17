import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  Database,
  Eye,
  Gamepad2,
  Info,
  Layers,
  LineChart as LineChartIcon,
  Loader2,
  Radio,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
} from '@/components/icons'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
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
import { useTalentDataSources } from '@/hooks/useTalentDataSources'
import { TalentSourceCounters } from '@/components/TalentSourceCounters'
import { BackfillPanel } from '@/features/settings/BackfillPanel'
import { TwitchTrackerPanel } from '@/features/settings/TwitchTrackerPanel'
import { isTauri } from '@/services/twitch'
import {
  buildCategoryDistribution,
  buildChannelActivitySeries,
  buildDailyRatioSeries,
  buildGrowthComparison,
  buildPeriodTotals,
  buildTalentComparison,
  buildViewershipSeries,
  computePlatformKpis,
  formatDelta,
  formatStat,
  ROSTER_SIZE,
} from './platform-stats-utils'

type StatsTab = 'overview' | 'viewers' | 'channels' | 'games' | 'compare'
type PeriodGranularity = 'day' | 'week'

const tabs: { id: StatsTab; label: string; icon: typeof Eye }[] = [
  { id: 'overview', label: 'Overview', icon: Layers },
  { id: 'viewers', label: 'Viewers', icon: Eye },
  { id: 'channels', label: 'Canales', icon: Radio },
  { id: 'games', label: 'Games', icon: Gamepad2 },
  { id: 'compare', label: 'Compare', icon: ArrowLeftRight },
]

const chartTooltipStyle = {
  backgroundColor: 'var(--popover)',
  border: '1px solid var(--popover-border)',
  borderRadius: 5,
  color: 'var(--popover-foreground)',
  fontSize: 11,
}

const PIE_COLORS = ['#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#a855f7']

function DeltaBadge({ value, pct }: { value: number; pct: number }) {
  const positive = value >= 0
  const Icon = positive ? TrendingUp : TrendingDown
  return (
    <span className={`ps-delta ${positive ? 'up' : 'down'}`}>
      <Icon size={12} />
      {formatDelta(value, pct)}
    </span>
  )
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="ps-empty">
      <Info size={18} />
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  )
}

function KpiStrip({
  liveViewers,
  liveChannels,
  avg7dViewers,
  avg7dChannels,
  batches,
}: {
  liveViewers: number
  liveChannels: number
  avg7dViewers: number
  avg7dChannels: number
  batches: number
}) {
  const items = [
    {
      label: 'Viewers live ahora',
      value: formatStat(liveViewers),
      meta: 'Suma CCV del roster en directo',
      icon: Eye,
      tone: 'purple',
    },
    {
      label: 'Prom. 7d viewers (roster)',
      value: formatStat(avg7dViewers),
      meta: 'Media de CCV total por captura',
      icon: Activity,
      tone: 'cyan',
    },
    {
      label: 'Canales live ahora',
      value: formatStat(liveChannels),
      meta: `De ${ROSTER_SIZE} talentos NeuraLive`,
      icon: Radio,
      tone: 'live',
    },
    {
      label: 'Prom. 7d canales activos',
      value: avg7dChannels.toFixed(1),
      meta: 'Media de canales en vivo por captura',
      icon: Users,
      tone: 'blue',
    },
  ]

  return (
    <section className="ps-kpi-strip">
      {items.map((item) => (
        <article key={item.label} className={`ps-kpi ${item.tone}`}>
          <div className="ps-kpi-label">
            <span>{item.label}</span>
            <item.icon size={14} />
          </div>
          <strong>{item.value}</strong>
          <small>{item.meta}</small>
        </article>
      ))}
      <article className="ps-kpi amber">
        <div className="ps-kpi-label">
          <span>Capturas 7d</span>
          <BarChart3 size={14} />
        </div>
        <strong>{formatStat(batches)}</strong>
        <small>Twitch + TT + sesiones fusionados</small>
      </article>
    </section>
  )
}

export function PlatformStatsPage() {
  const talents = useAppStore((s) => s.talents)
  const loading = useAppStore((s) => s.twitchLoading)
  const refresh = useAppStore((s) => s.refreshTalentData)
  const lastUpdate = useAppStore((s) => s.lastTwitchUpdate)
  const logins = useMemo(() => talents.map((t) => t.login), [talents])
  const {
    mergedSnapshots: snapshots,
    displayNames,
    sourceCounts,
    eventSub,
    loading: metricsLoading,
    collecting,
    collectNote,
    collectError,
    error,
    reloadAll,
    reloadExtra,
    collectNow,
  } = useTalentDataSources({ hours: 720, logins })
  const [tab, setTab] = useState<StatsTab>('overview')
  const [periodGranularity, setPeriodGranularity] = useState<PeriodGranularity>('day')

  const liveTalents = useMemo(() => talents.filter((t) => t.isLive), [talents])
  const liveViewersNow = liveTalents.reduce((sum, t) => sum + t.viewers, 0)
  const liveChannelsNow = liveTalents.length

  const kpis = useMemo(
    () => computePlatformKpis(snapshots, liveViewersNow, liveChannelsNow),
    [snapshots, liveViewersNow, liveChannelsNow],
  )
  const viewershipSeries = useMemo(() => buildViewershipSeries(snapshots), [snapshots])
  const ratioSeries = useMemo(() => buildDailyRatioSeries(snapshots), [snapshots])
  const channelSeries = useMemo(() => buildChannelActivitySeries(snapshots), [snapshots])
  const growth = useMemo(() => buildGrowthComparison(snapshots), [snapshots])
  const categories = useMemo(() => buildCategoryDistribution(snapshots), [snapshots])
  const periodTotals = useMemo(
    () => buildPeriodTotals(snapshots, periodGranularity),
    [snapshots, periodGranularity],
  )
  const talentCompare = useMemo(
    () => buildTalentComparison(snapshots, displayNames, 7),
    [snapshots, displayNames],
  )

  const topCategories = categories.slice(0, 8)
  const isLoading = loading || metricsLoading || collecting
  const lastSync = lastUpdate
    ? new Date(lastUpdate).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
    : 'Sin sincronizar'

  return (
    <div className="ps-page">
      <div className="ps-titlebar">
        <div>
          <span>NEURALIVE STATS · CARTERA PROPIA</span>
          <h1>Estadísticas NeuraLive</h1>
          <p>
            Overview con datos fusionados de Twitch, estadísticas externas, repeticiones y sesiones del roster de{' '}
            {ROSTER_SIZE} talentos. No incluye toda la plataforma Twitch.
          </p>
          <TalentSourceCounters counts={sourceCounts} className="ps-source-counters" />
          {collectNote && !collectError && (
            <p className="ps-collect-note">{collectNote}</p>
          )}
        </div>
        <div className="ps-titlebar-actions">
          <button
            type="button"
            className="ps-sync ps-collect"
            disabled={isLoading || !isTauri}
            onClick={() => void collectNow()}
            title="Actualizar datos del roster (Twitch + repeticiones + estadísticas externas + tiempo real)"
          >
            {collecting ? <Loader2 size={14} className="ps-spin" /> : <Database size={14} />}
            {collecting ? 'Recolectando…' : 'Recolectar ahora'}
          </button>
          <BackfillPanel compact />
          <TwitchTrackerPanel compact onSynced={() => void reloadExtra()} />
          <button
            type="button"
            className="ps-sync"
            onClick={() => void refresh().then(() => reloadAll())}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'ps-spin' : ''} />
            {loading ? 'Actualizando…' : `Actualizar ${lastSync}`}
          </button>
        </div>
      </div>

      <div className="ps-disclaimer">
        <Info size={14} />
        <span>
          Métricas calculadas sobre la cartera NeuraLive ({ROSTER_SIZE} canales). CCV = concurrent viewers sumados;
          horas vistas ≈ CCV × intervalo entre capturas.
        </span>
      </div>

      {eventSub && (
        <p className={`ps-eventsub ${eventSub.state}`}>
          Tiempo real: {eventSub.state === 'connected' ? 'conectado' : eventSub.state === 'connecting' ? 'conectando' : eventSub.state === 'fallback_polling' ? 'modo alterno' : 'desconectado'} · {eventSub.subscriptions} suscripciones activas
          {eventSub.lastEventAt && ` · último evento ${new Date(eventSub.lastEventAt).toLocaleString('es-MX')}`}
        </p>
      )}

      {(error || collectError) && (
        <div className="ps-error">
          {collectError ?? `Error cargando histórico: ${error}. Ejecuta NeuraGest en la app de escritorio para leer datos guardados localmente.`}
        </div>
      )}

      <KpiStrip
        liveViewers={kpis.liveViewersNow}
        liveChannels={kpis.liveChannelsNow}
        avg7dViewers={kpis.avg7dRosterViewers}
        avg7dChannels={kpis.avg7dActiveChannels}
        batches={kpis.snapshotBatches7d}
      />

      <nav className="an-tabs ps-tabs" aria-label="Secciones de estadísticas">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? 'active' : ''}
            onClick={() => setTab(item.id)}
          >
            <item.icon size={13} />
            {item.label}
          </button>
        ))}
      </nav>

      <motion.div key={tab} className="ps-tab-content" initial={{ opacity: 0.4, y: 2 }} animate={{ opacity: 1, y: 0 }}>
        {tab === 'overview' && (
          <div className="ps-grid">
            <section className="bi-panel ps-chart-panel ps-span-2">
              <header>
                <div>
                  <h2>Viewership del roster</h2>
                  <p>CCV total sumado en cada captura (~60s)</p>
                </div>
                <span className="bi-unit">{viewershipSeries.length} PUNTOS</span>
              </header>
              {viewershipSeries.length > 1 ? (
                <div className="ps-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={viewershipSeries} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                      <defs>
                        <linearGradient id="psViewersGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                      <XAxis dataKey="at" tick={{ fill: '#E5E7EB', fontSize: 9 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fill: '#E5E7EB', fontSize: 10 }} allowDecimals={false} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Area
                        type="monotone"
                        dataKey="viewers"
                        name="Viewers roster"
                        stroke="#8b5cf6"
                        fill="url(#psViewersGrad)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState
                  title="Pocos datos de viewership"
                  detail="Los registros se acumulan con cada actualización de Twitch. Deja la app abierta o importa historial en Ajustes."
                />
              )}
            </section>

            <section className="bi-panel ps-growth-panel">
              <header>
                <div>
                  <h2>Growth</h2>
                  <p>Comparación semana vs semana y mes vs mes</p>
                </div>
                <LineChartIcon size={16} />
              </header>
              <div className="ps-growth-cards">
                <article>
                  <span>Semana actual</span>
                  <strong>{formatStat(growth.thisWeekAvg)}</strong>
                  <small>CCV promedio roster</small>
                  {growth.hasWeekData ? (
                    <DeltaBadge value={growth.weekDelta} pct={growth.weekDeltaPct} />
                  ) : (
                    <em className="ps-muted">Datos insuficientes</em>
                  )}
                </article>
                <article>
                  <span>Semana anterior</span>
                  <strong>{formatStat(growth.lastWeekAvg)}</strong>
                  <small>Referencia</small>
                </article>
                <article>
                  <span>Últimos 30 días</span>
                  <strong>{formatStat(growth.thisMonthAvg)}</strong>
                  <small>CCV promedio</small>
                  {growth.hasMonthData ? (
                    <DeltaBadge value={growth.monthDelta} pct={growth.monthDeltaPct} />
                  ) : (
                    <em className="ps-muted">Datos insuficientes</em>
                  )}
                </article>
                <article>
                  <span>30 días previos</span>
                  <strong>{formatStat(growth.lastMonthAvg)}</strong>
                  <small>Referencia</small>
                </article>
              </div>
            </section>

            <section className="bi-panel ps-chart-panel">
              <header>
                <div>
                  <h2>Viewers vs streamers</h2>
                  <p>Ratio CCV total / canales live por día</p>
                </div>
              </header>
              {ratioSeries.length > 1 ? (
                <div className="ps-chart ps-chart-sm">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ratioSeries} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                      <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                      <XAxis dataKey="at" tick={{ fill: '#E5E7EB', fontSize: 9 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fill: '#E5E7EB', fontSize: 10 }} allowDecimals={false} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Line type="monotone" dataKey="ratio" name="Viewers/canal" stroke="#06b6d4" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState title="Sin ratio diario" detail="Se necesitan al menos 2 días con capturas." />
              )}
            </section>

            <section className="bi-panel ps-table-panel ps-span-2">
              <header>
                <div>
                  <h2>Totals by period</h2>
                  <p>Promedios por día o semana · horas vistas estimadas</p>
                </div>
                <div className="ps-period-toggle">
                  <button
                    type="button"
                    className={periodGranularity === 'day' ? 'active' : ''}
                    onClick={() => setPeriodGranularity('day')}
                  >
                    Día
                  </button>
                  <button
                    type="button"
                    className={periodGranularity === 'week' ? 'active' : ''}
                    onClick={() => setPeriodGranularity('week')}
                  >
                    Semana
                  </button>
                </div>
              </header>
              {periodTotals.length > 0 ? (
                <div className="ps-table-wrap">
                  <table className="ps-table">
                    <thead>
                      <tr>
                        <th>Periodo</th>
                        <th>Avg CCV</th>
                        <th>Peak CCV</th>
                        <th>Avg live</th>
                        <th>Peak live</th>
                        <th>Horas vistas est.</th>
                        <th>Capturas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periodTotals.slice(0, 14).map((row) => (
                        <tr key={row.key}>
                          <td>{row.label}</td>
                          <td>{formatStat(row.avgCcv)}</td>
                          <td>{formatStat(row.peakCcv)}</td>
                          <td>{row.avgLiveCount.toFixed(1)}</td>
                          <td>{row.peakLiveCount}</td>
                          <td>{formatStat(row.hoursWatched)}</td>
                          <td>{row.snapshotBatches}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title="Sin periodos" detail="Aún no hay capturas agrupables por periodo." />
              )}
            </section>
          </div>
        )}

        {tab === 'viewers' && (
          <div className="ps-grid ps-grid-single">
            <section className="bi-panel ps-chart-panel">
              <header>
                <div>
                  <h2>Serie temporal de viewers</h2>
                  <p>CCV total del roster · últimos 30 días de capturas</p>
                </div>
              </header>
              {viewershipSeries.length > 1 ? (
                <div className="ps-chart ps-chart-lg">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={viewershipSeries} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                      <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                      <XAxis dataKey="at" tick={{ fill: '#E5E7EB', fontSize: 9 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fill: '#E5E7EB', fontSize: 10 }} allowDecimals={false} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Line type="monotone" dataKey="viewers" name="Viewers roster" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState title="Sin serie de viewers" detail="Espera acumulación de datos o importa historial en Ajustes." />
              )}
            </section>

            <section className="bi-panel ps-chart-panel">
              <header>
                <div>
                  <h2>Viewers vs streamers (detalle)</h2>
                  <p>Ratio diario + CCV y canales en tooltip</p>
                </div>
              </header>
              {ratioSeries.length > 1 ? (
                <div className="ps-chart ps-chart-lg">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ratioSeries} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                      <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                      <XAxis dataKey="at" tick={{ fill: '#E5E7EB', fontSize: 9 }} interval="preserveStartEnd" />
                      <YAxis yAxisId="left" tick={{ fill: '#E5E7EB', fontSize: 10 }} allowDecimals={false} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fill: '#E5E7EB', fontSize: 10 }} allowDecimals={false} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Line yAxisId="left" type="monotone" dataKey="viewers" name="Avg CCV" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="liveCount" name="Avg canales" stroke="#22c55e" strokeWidth={2} dot={false} />
                      <Line yAxisId="left" type="monotone" dataKey="ratio" name="Ratio" stroke="#06b6d4" strokeWidth={2} dot={false} strokeDasharray="4 3" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState title="Sin datos de ratio" detail="Necesitas capturas en varios días distintos." />
              )}
            </section>
          </div>
        )}

        {tab === 'channels' && (
          <div className="ps-grid ps-grid-single">
            <section className="bi-panel ps-chart-panel">
              <header>
                <div>
                  <h2>Canales activos en el tiempo</h2>
                  <p>Cuántos talentos del roster están en vivo por captura</p>
                </div>
              </header>
              {channelSeries.length > 1 ? (
                <div className="ps-chart ps-chart-lg">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={channelSeries} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                      <defs>
                        <linearGradient id="psChannelsGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                      <XAxis dataKey="at" tick={{ fill: '#E5E7EB', fontSize: 9 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fill: '#E5E7EB', fontSize: 10 }} allowDecimals={false} domain={[0, ROSTER_SIZE]} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Area type="monotone" dataKey="viewers" name="Canales live" stroke="#22c55e" fill="url(#psChannelsGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState title="Sin actividad de canales" detail="Las capturas mostrarán cuántos talentos están en vivo." />
              )}
            </section>

            <section className="bi-panel ps-table-panel">
              <header>
                <div>
                  <h2>Resumen por periodo</h2>
                  <p>Promedio y pico de canales activos</p>
                </div>
              </header>
              {periodTotals.length > 0 ? (
                <div className="ps-table-wrap">
                  <table className="ps-table">
                    <thead>
                      <tr>
                        <th>Día</th>
                        <th>Avg canales live</th>
                        <th>Peak canales</th>
                        <th>Capturas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periodTotals.slice(0, 14).map((row) => (
                        <tr key={row.key}>
                          <td>{row.label}</td>
                          <td>{row.avgLiveCount.toFixed(1)}</td>
                          <td>{row.peakLiveCount}</td>
                          <td>{row.snapshotBatches}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title="Sin resumen" detail="Sin capturas suficientes." />
              )}
            </section>
          </div>
        )}

        {tab === 'games' && (
          <div className="ps-grid">
            <section className="bi-panel ps-chart-panel">
              <header>
                <div>
                  <h2>Distribución por categoría</h2>
                  <p>Share de capturas en vivo por juego/categoría Twitch</p>
                </div>
              </header>
              {topCategories.length > 0 ? (
                <div className="ps-donut-wrap">
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={topCategories}
                        dataKey="snapshots"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={2}
                      >
                        {topCategories.map((entry, index) => (
                          <Cell key={entry.category} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={chartTooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="ps-share-list">
                    {topCategories.map((row, index) => (
                      <li key={row.category}>
                        <span className="ps-dot" style={{ background: PIE_COLORS[index % PIE_COLORS.length] }} />
                        <span>{row.category}</span>
                        <em>{row.sharePct}%</em>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <EmptyState
                  title="Sin categorías"
                  detail="Las categorías se registran cuando hay talentos en vivo con juego asignado."
                />
              )}
            </section>

            <section className="bi-panel ps-chart-panel">
              <header>
                <div>
                  <h2>Viewers promedio por categoría</h2>
                  <p>CCV medio en capturas en vivo de cada juego</p>
                </div>
              </header>
              {topCategories.length > 0 ? (
                <div className="ps-chart ps-chart-md">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topCategories} layout="vertical" margin={{ top: 8, right: 12, left: 8, bottom: 4 }}>
                      <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: '#E5E7EB', fontSize: 10 }} />
                      <YAxis type="category" dataKey="category" width={120} tick={{ fill: '#E5E7EB', fontSize: 9 }} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Bar dataKey="avgViewers" name="Avg viewers" fill="#3b82f6" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState title="Sin barras de categoría" detail="Requiere streams con categoría registrada." />
              )}
            </section>
          </div>
        )}

        {tab === 'compare' && (
          <section className="bi-panel ps-table-panel">
            <header>
              <div>
                <h2>Compare · talentos entre sí</h2>
                <p>Últimos 7 días · avg CCV, peak, días con stream y tasa live</p>
              </div>
            </header>
            {talentCompare.length > 0 ? (
              <div className="ps-table-wrap">
                <table className="ps-table ps-table-compare">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Talento</th>
                      <th>Avg viewers</th>
                      <th>Peak</th>
                      <th>Días stream</th>
                      <th>Capturas en vivo</th>
                      <th>Tasa live</th>
                    </tr>
                  </thead>
                  <tbody>
                    {talentCompare.map((row, index) => (
                      <tr key={row.login}>
                        <td>{index + 1}</td>
                        <td>
                          <strong>{row.displayName}</strong>
                          <small>@{row.login}</small>
                        </td>
                        <td>{formatStat(row.avgViewers)}</td>
                        <td>{formatStat(row.peakViewers)}</td>
                        <td>{row.streamDays}</td>
                        <td>{row.liveSnapshots}</td>
                        <td>{row.liveRatePct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Sin comparativa" detail="No hay capturas por talento en los últimos 7 días." />
            )}

            {talentCompare.length > 1 && (
              <div className="ps-chart ps-chart-md ps-compare-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={talentCompare.slice(0, 10)} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                    <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="displayName" tick={{ fill: '#E5E7EB', fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={50} />
                    <YAxis tick={{ fill: '#E5E7EB', fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Bar dataKey="avgViewers" name="Avg viewers 7d" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        )}
      </motion.div>
    </div>
  )
}
