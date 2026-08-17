import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarRange,
  Check,
  Database,
  Download,
  Eye,
  FileJson,
  Filter,
  Loader2,
  Radio,
  Search,
  SlidersHorizontal,
  Trophy,
  Users,
} from '@/components/icons'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import { buildStreakIndicators, buildWeeklyComparison } from '@/services/metrics'
import { isTauri } from '@/services/twitch'
import type { Talent } from '@/types'
import { MetricHistoryChart } from '@/features/dashboard/MetricHistoryChart'
import { StreakIndicatorsPanel } from './StreakIndicatorsPanel'
import { WeeklyComparePanel } from './WeeklyComparePanel'
import {
  analyticsNumber,
  downloadSnapshot,
  snapshotCsv,
  sortTalents,
  talentSnapshot,
  viewerShare,
  type AnalyticsSortDirection,
  type AnalyticsSortKey,
} from './analytics-utils'

type AnalyticsTab = 'summary' | 'compare' | 'weekly' | 'rankings' | 'export' | 'tools'
type RankingMetric = 'viewers' | 'followers' | 'live'

const tabs: { id: AnalyticsTab; label: string; icon: typeof Eye }[] = [
  { id: 'summary', label: 'Resumen', icon: BarChart3 },
  { id: 'compare', label: 'Comparar', icon: ArrowLeftRight },
  { id: 'weekly', label: 'Semanal', icon: CalendarRange },
  { id: 'rankings', label: 'Rankings', icon: Trophy },
  { id: 'export', label: 'Exportar', icon: Download },
  { id: 'tools', label: 'Herramientas', icon: SlidersHorizontal },
]

const chartTooltipStyle = {
  backgroundColor: 'var(--popover)',
  border: '1px solid var(--popover-border)',
  borderRadius: 5,
  color: 'var(--popover-foreground)',
  fontSize: 11,
}

function TalentAvatar({ talent }: { talent: Talent }) {
  return talent.avatar
    ? <img src={talent.avatar} alt="" />
    : <span className="avatar-placeholder">{talent.displayName.slice(0, 2).toUpperCase()}</span>
}

function MetricCard({ label, value, detail, icon: Icon }: {
  label: string
  value: string
  detail: string
  icon: typeof Eye
}) {
  return <article className="an-metric"><div><span>{label}</span><Icon size={14} /></div><strong>{value}</strong><small>{detail}</small></article>
}

export function Analytics() {
  const talents = useAppStore((state) => state.talents)
  const lastUpdate = useAppStore((state) => state.lastTwitchUpdate)
  const loading = useAppStore((state) => state.twitchLoading)
  const refresh = useAppStore((state) => state.refreshTalentData)
  const logins = useMemo(() => talents.map((t) => t.login), [talents])
  const {
    mergedSnapshots: snapshots,
    allEvents: events,
    eventSub,
    displayNames,
    sourceCounts,
    loading: metricsLoading,
    collecting,
    collectNote,
    collectError,
    reloadAll,
    reloadExtra,
    collectNow,
  } = useTalentDataSources({ hours: 336, logins })
  const weekly = useMemo(
    () => buildWeeklyComparison(snapshots, displayNames),
    [snapshots, displayNames],
  )
  const streaks = useMemo(
    () => buildStreakIndicators(snapshots, events, displayNames),
    [snapshots, events, displayNames],
  )
  const [tab, setTab] = useState<AnalyticsTab>('summary')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [minViewers, setMinViewers] = useState(0)
  const [onlyLive, setOnlyLive] = useState(false)
  const [selectedLogins, setSelectedLogins] = useState(() => talents.slice(0, 3).map((talent) => talent.login))
  const [rankingMetric, setRankingMetric] = useState<RankingMetric>('viewers')
  const [threshold, setThreshold] = useState(100)
  const [sortKey, setSortKey] = useState<AnalyticsSortKey>('viewers')
  const [sortDirection, setSortDirection] = useState<AnalyticsSortDirection>('desc')

  const liveTalents = talents.filter((talent) => talent.isLive)
  const totalLiveViewers = liveTalents.reduce((sum, talent) => sum + talent.viewers, 0)
  const totalFollowers = talents.reduce((sum, talent) => sum + talent.followers, 0)
  const leader = [...liveTalents].sort((a, b) => b.viewers - a.viewers)[0]
  const categories = [...new Set(talents.map((talent) => talent.category).filter(Boolean))].sort()

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return talents.filter((talent) =>
      (!normalized
        || talent.displayName.toLowerCase().includes(normalized)
        || talent.login.toLowerCase().includes(normalized))
      && (category === 'all' || talent.category === category)
      && talent.viewers >= minViewers
      && (!onlyLive || talent.isLive))
  }, [category, minViewers, onlyLive, query, talents])

  const sortedFiltered = useMemo(
    () => sortTalents(filtered, sortKey, sortDirection, totalLiveViewers),
    [filtered, sortDirection, sortKey, totalLiveViewers],
  )
  const selected = talents.filter((talent) => selectedLogins.includes(talent.login))
  const thresholdMatches = talents
    .filter((talent) => talent.isLive && talent.viewers >= threshold)
    .sort((a, b) => b.viewers - a.viewers)
  const audienceData = liveTalents.map((talent) => ({
    name: talent.displayName,
    value: talent.viewers,
  }))
  const ranking = [...talents].sort((a, b) => {
    if (rankingMetric === 'followers') return b.followers - a.followers
    if (rankingMetric === 'live') return Number(b.isLive) - Number(a.isLive) || b.viewers - a.viewers
    return b.viewers - a.viewers
  })
  const captureDate = lastUpdate ?? new Date().toISOString()
  const exportBase = `neuragest-snapshot-${captureDate.slice(0, 10)}`

  const toggleTalent = (login: string) => {
    setSelectedLogins((current) => current.includes(login)
      ? current.filter((item) => item !== login)
      : [...current, login])
  }
  const toggleSort = (key: AnalyticsSortKey) => {
    if (key === sortKey) setSortDirection((current) => current === 'desc' ? 'asc' : 'desc')
    else {
      setSortKey(key)
      setSortDirection(key === 'name' || key === 'category' ? 'asc' : 'desc')
    }
  }
  const exportCsv = () => downloadSnapshot(`${exportBase}.csv`, snapshotCsv(talents, captureDate), 'text/csv;charset=utf-8')
  const exportJson = () => downloadSnapshot(
    `${exportBase}.json`,
    JSON.stringify(talentSnapshot(talents, captureDate), null, 2),
    'application/json;charset=utf-8',
  )

  const isBusy = loading || metricsLoading || collecting

  return <div className="analytics-bi">
    <div className="an-titlebar">
      <div>
        <span>INTELIGENCIA DE NEGOCIO · MULTI-FUENTE</span>
        <h1>Analítica</h1>
        <p>Explora y exporta métricas fusionadas de Twitch, estadísticas externas, repeticiones y sesiones de los 10 talentos.</p>
        <TalentSourceCounters counts={sourceCounts} className="an-source-counters" />
        {collectNote && !collectError && (
          <p className="an-collect-note">{collectNote}</p>
        )}
      </div>
      <div className="an-titlebar-actions">
        <button
          type="button"
          className="an-sync an-collect"
          disabled={isBusy || !isTauri}
          onClick={() => void collectNow()}
          title="Actualizar datos del roster (Twitch + repeticiones + estadísticas externas + tiempo real)"
        >
          {collecting ? <Loader2 size={14} className="an-spin" /> : <Database size={14} />}
          {collecting ? 'Recolectando…' : 'Recolectar ahora'}
        </button>
        <BackfillPanel compact />
        <TwitchTrackerPanel compact onSynced={() => void reloadExtra()} />
        <button className="an-sync" disabled={loading} onClick={() => void refresh().then(() => reloadAll())}>
          <Radio size={14} />{loading ? 'Sincronizando…' : 'Actualizar Twitch'}
        </button>
      </div>
    </div>

    {eventSub && (
      <p className={`an-eventsub ${eventSub.state}`}>
        Tiempo real: {eventSub.state === 'connected' ? 'conectado' : eventSub.state === 'connecting' ? 'conectando' : eventSub.state === 'fallback_polling' ? 'modo alterno' : 'desconectado'} · {eventSub.subscriptions} suscripciones activas
        {eventSub.lastEventAt && ` · último evento ${new Date(eventSub.lastEventAt).toLocaleString('es-MX')}`}
      </p>
    )}

    {collectError && <p className="an-banner error">{collectError}</p>}

    <nav className="an-tabs" aria-label="Vistas de analítica" role="tablist">
      {tabs.map((item) => {
        const Icon = item.icon
        const active = tab === item.id
        return <button
          key={item.id}
          className={active ? 'active' : ''}
          onClick={() => setTab(item.id)}
          role="tab"
          aria-selected={active}
        >
          {active && <motion.span
            className="an-tab-indicator"
            layoutId="analytics-active-tab"
            transition={{ type: 'spring', stiffness: 430, damping: 34 }}
          />}
          <span className="an-tab-label"><Icon size={13} strokeWidth={1.8} />{item.label}</span>
        </button>
      })}
    </nav>

    <section className="an-filterbar">
      <span className="an-filter-title"><Filter size={13} />Filtros</span>
      <label className="an-search"><Search size={13} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Talento o canal" /></label>
      <label><span>Categoría</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Todas</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span>Viewers mín.</span><input className="an-number-input" type="number" min="0" value={minViewers} onChange={(event) => setMinViewers(Math.max(0, Number(event.target.value)))} /></label>
      <label className="an-check"><input type="checkbox" checked={onlyLive} onChange={(event) => setOnlyLive(event.target.checked)} />Solo live</label>
      <strong>{filtered.length}/{talents.length}</strong>
    </section>

    {tab === 'summary' && <div className="an-tab-content">
      <section className="an-metrics">
        <MetricCard label="En directo" value={`${liveTalents.length}/${talents.length}`} detail={`${talents.length - liveTalents.length} offline`} icon={Radio} />
        <MetricCard label="Audiencia live" value={analyticsNumber.format(totalLiveViewers)} detail="Viewers simultáneos" icon={Eye} />
        <MetricCard label="Followers" value={analyticsNumber.format(totalFollowers)} detail="Suma actual de cartera" icon={Users} />
        <MetricCard label="Líder actual" value={leader?.displayName ?? 'Sin live'} detail={leader ? `${analyticsNumber.format(leader.viewers)} viewers` : 'Sin emisiones activas'} icon={Trophy} />
      </section>

      <div className="an-grid an-summary-grid">
        <section className="an-panel">
          <header><div><h2>Distribución de audiencia</h2><p>Share de viewers entre canales en directo</p></div><span>LIVE ONLY</span></header>
          {totalLiveViewers > 0 ? <div className="an-donut-wrap">
            <ResponsiveContainer width="55%" height={250}><PieChart><Pie data={audienceData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={92} paddingAngle={2}>{audienceData.map((entry, index) => <Cell key={entry.name} fill={['#8b5cf6', '#3b82f6', '#22c55e', '#06b6d4', '#f59e0b', '#ec4899'][index % 6]} />)}</Pie><Tooltip contentStyle={chartTooltipStyle} formatter={(value) => [`${analyticsNumber.format(Number(value))} viewers`, 'Audiencia']} /></PieChart></ResponsiveContainer>
            <div className="an-share-list">{liveTalents.sort((a, b) => b.viewers - a.viewers).map((talent) => <div key={talent.id}><span>{talent.displayName}</span><strong>{viewerShare(talent, totalLiveViewers).toFixed(1)}%</strong></div>)}</div>
          </div> : <div className="an-empty">No hay audiencia live en la captura actual.</div>}
        </section>
        <section className="an-panel an-executive">
          <header><div><h2>Resumen ejecutivo</h2><p>Lectura automática de la captura actual</p></div><BarChart3 size={16} /></header>
          <ul>
            <li><Check size={14} /><span><b>{liveTalents.length}</b> de {talents.length} talentos están en directo.</span></li>
            <li><Eye size={14} /><span>La audiencia concurrente suma <b>{analyticsNumber.format(totalLiveViewers)}</b> viewers.</span></li>
            <li><Trophy size={14} /><span>{leader ? <><b>{leader.displayName}</b> lidera con {analyticsNumber.format(leader.viewers)} viewers ({viewerShare(leader, totalLiveViewers).toFixed(1)}% del share).</> : 'No hay líder de audiencia porque no existen streams activos.'}</span></li>
            <li><Users size={14} /><span>La cartera registra <b>{analyticsNumber.format(totalFollowers)}</b> followers acumulados actuales.</span></li>
            <li><Radio size={14} /><span>Última captura: {lastUpdate ? new Date(lastUpdate).toLocaleString('es-MX') : 'pendiente de primera sincronización'}.</span></li>
          </ul>
        </section>
      </div>

      <section className="an-panel an-status-matrix">
        <header><div><h2>Matriz de estado operativa</h2><p>Los 10 canales monitorizados en Twitch</p></div><span>{liveTalents.length} ONLINE</span></header>
        <div>{talents.map((talent) => <article className={talent.isLive ? 'live' : ''} key={talent.id} title={`${talent.displayName} · ${talent.isLive ? `${talent.viewers} viewers` : 'Offline'}`}><i /><span><b>{talent.displayName}</b><small>{talent.isLive ? `${analyticsNumber.format(talent.viewers)} viewers` : 'Offline'}</small></span></article>)}</div>
      </section>

      <MetricHistoryChart snapshots={snapshots} login={leader?.login ?? talents[0]?.login} title="Tendencia histórica de viewers (fusionada)" />
      <StreakIndicatorsPanel streaks={streaks} eventSub={eventSub} />
    </div>}

    {tab === 'compare' && <div className="an-tab-content">
      <section className="an-panel an-selector">
        <header><div><h2>Comparador de talentos</h2><p>Selecciona 2 o más canales para contrastar métricas actuales</p></div><span>{selected.length} SELECCIONADOS</span></header>
        <div className="an-talent-pills">{talents.map((talent) => <button key={talent.id} className={selectedLogins.includes(talent.login) ? 'selected' : ''} onClick={() => toggleTalent(talent.login)}><i />{talent.displayName}</button>)}</div>
      </section>
      {selected.length >= 2 ? <div className="an-grid an-compare-grid">
        <section className="an-panel">
          <header><div><h2>Viewers comparados</h2><p>Audiencia simultánea por selección</p></div></header>
          <div className="an-compare-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={selected} layout="vertical" margin={{ left: 8, right: 25 }}><CartesianGrid stroke="var(--chart-grid)" horizontal={false} /><XAxis type="number" tick={{ fill: '#E5E7EB', fontSize: 10 }} allowDecimals={false} /><YAxis type="category" dataKey="displayName" width={85} tick={{ fill: '#E5E7EB', fontSize: 10 }} /><Tooltip contentStyle={chartTooltipStyle} /><Bar dataKey="viewers" name="Viewers" fill="#8b5cf6" radius={[0, 3, 3, 0]} /></BarChart></ResponsiveContainer></div>
        </section>
        <section className="an-panel an-compare-table"><header><div><h2>Detalle comparativo</h2><p>Métricas y estado actual</p></div></header><div className="an-table-scroll"><table><thead><tr><th>Talento</th><th>Estado</th><th>Categoría</th><th>Viewers</th><th>Followers</th><th>Share</th></tr></thead><tbody>{selected.map((talent) => <tr key={talent.id}><td>{talent.displayName}</td><td><span className={`an-status ${talent.isLive ? 'live' : ''}`}>{talent.isLive ? 'Live' : 'Offline'}</span></td><td>{talent.category || '—'}</td><td>{analyticsNumber.format(talent.viewers)}</td><td>{analyticsNumber.format(talent.followers)}</td><td>{viewerShare(talent, totalLiveViewers).toFixed(1)}%</td></tr>)}</tbody></table></div></section>
      </div> : <div className="an-empty an-selection-empty">Selecciona al menos 2 talentos para activar la comparación.</div>}
    </div>}

    {tab === 'weekly' && <WeeklyComparePanel rows={weekly} loading={metricsLoading} />}

    {tab === 'rankings' && <div className="an-tab-content">
      <section className="an-panel">
        <header><div><h2>Ranking de cartera</h2><p>Ordenamiento de la captura actual</p></div><div className="an-ranking-switch">{([['viewers', 'Viewers'], ['followers', 'Followers'], ['live', 'Live primero']] as const).map(([id, label]) => <button className={rankingMetric === id ? 'active' : ''} key={id} onClick={() => setRankingMetric(id)}>{label}</button>)}</div></header>
        <div className="an-ranking-list">{ranking.map((talent, index) => <article key={talent.id}><strong>{index + 1}</strong><TalentAvatar talent={talent} /><span><b>{talent.displayName}</b><small>{talent.category || 'Sin categoría'}</small></span><span className={`an-status ${talent.isLive ? 'live' : ''}`}>{talent.isLive ? '● Live' : 'Offline'}</span><em>{analyticsNumber.format(rankingMetric === 'followers' ? talent.followers : talent.viewers)} <small>{rankingMetric === 'followers' ? 'followers' : 'viewers'}</small></em></article>)}</div>
      </section>
    </div>}

    {tab === 'export' && <div className="an-tab-content an-export-grid">
      <section className="an-export-card"><Download size={23} /><div><h2>Informe CSV</h2><p>Abre en Excel, Power BI o Tableau. Incluye estado, categoría, viewers, followers y share.</p></div><button onClick={exportCsv}><Download size={14} />Descargar CSV</button></section>
      <section className="an-export-card"><FileJson size={23} /><div><h2>Informe estructurado</h2><p>Formato completo con metadatos, totales y detalle por talento para integraciones.</p></div><button onClick={exportJson}><FileJson size={14} />Descargar informe</button></section>
      <section className="an-panel an-export-preview"><header><div><h2>Contenido del reporte</h2><p>Datos reales incluidos en ambos formatos</p></div><span>{talents.length} REGISTROS</span></header><dl><div><dt>Captura</dt><dd>{new Date(captureDate).toLocaleString('es-MX')}</dd></div><div><dt>Fuente</dt><dd>Twitch + TT + repeticiones + sesiones</dd></div><div><dt>Talentos</dt><dd>{talents.length}</dd></div><div><dt>Canales live</dt><dd>{liveTalents.length}</dd></div><div><dt>Viewers live</dt><dd>{analyticsNumber.format(totalLiveViewers)}</dd></div></dl></section>
    </div>}

    {tab === 'tools' && <div className="an-tab-content">
      <div className="an-grid an-tools-grid">
        <section className="an-panel an-threshold">
          <header><div><h2>Calculadora de umbral</h2><p>Detecta canales live por encima de un objetivo</p></div><SlidersHorizontal size={16} /></header>
          <label><span>Umbral de viewers</span><input type="number" min="0" value={threshold} onChange={(event) => setThreshold(Math.max(0, Number(event.target.value)))} /></label>
          <div className="an-threshold-result"><strong>{thresholdMatches.length}</strong><span>canales superan o igualan {analyticsNumber.format(threshold)} viewers</span></div>
          <div className="an-threshold-list">{thresholdMatches.map((talent) => <div key={talent.id}><span><i />{talent.displayName}</span><b>{analyticsNumber.format(talent.viewers)}</b></div>)}{thresholdMatches.length === 0 && <p><AlertTriangle size={14} />Ningún canal live alcanza este umbral.</p>}</div>
        </section>
        <section className="an-panel an-share-tool">
          <header><div><h2>Comparación de share</h2><p>Participación sobre la audiencia live total</p></div></header>
          <div>{liveTalents.sort((a, b) => b.viewers - a.viewers).map((talent) => <article key={talent.id}><span>{talent.displayName}</span><div><i style={{ width: `${viewerShare(talent, totalLiveViewers)}%` }} /></div><strong>{viewerShare(talent, totalLiveViewers).toFixed(1)}%</strong></article>)}{liveTalents.length === 0 && <p className="an-empty">Sin streams activos para calcular share.</p>}</div>
        </section>
      </div>

      <section className="an-panel an-pivot">
        <header><div><h2>Tabla analítica</h2><p>Busca, filtra y ordena todas las métricas de la captura actual</p></div><span>{sortedFiltered.length} FILAS</span></header>
        <div className="an-table-scroll"><table><thead><tr>{([
          ['name', 'Talento'], ['status', 'Estado'], ['category', 'Categoría'], ['viewers', 'Viewers'], ['followers', 'Followers'], ['share', 'Share live'],
        ] as [AnalyticsSortKey, string][]).map(([key, label]) => <th key={key}><button onClick={() => toggleSort(key)}>{label}{sortKey === key ? sortDirection === 'desc' ? <ArrowDown size={11} /> : <ArrowUp size={11} /> : null}</button></th>)}</tr></thead><tbody>{sortedFiltered.map((talent) => <tr key={talent.id}><td><div className="an-table-talent"><TalentAvatar talent={talent} /><span><b>{talent.displayName}</b><small>@{talent.login}</small></span></div></td><td><span className={`an-status ${talent.isLive ? 'live' : ''}`}>{talent.isLive ? 'Live' : 'Offline'}</span></td><td>{talent.category || '—'}</td><td>{analyticsNumber.format(talent.viewers)}</td><td>{talent.followers ? analyticsNumber.format(talent.followers) : '—'}</td><td>{viewerShare(talent, totalLiveViewers).toFixed(1)}%</td></tr>)}</tbody></table>{sortedFiltered.length === 0 && <div className="an-empty">No hay filas que coincidan con los filtros.</div>}</div>
      </section>
    </div>}
  </div>
}
