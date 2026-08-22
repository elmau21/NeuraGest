import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowUpDown,
  Clock3,
  Eye,
  Radio,
  RefreshCw,
  Search,
  Users,
  WifiOff,
} from '@/components/icons'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAppStore } from '@/stores/app-store'
import { useMetricHistory } from '@/hooks/useMetricHistory'
import type { Talent } from '@/types'
import { MetricHistoryChart } from './MetricHistoryChart'
import { VisionGauge } from '@/components/VisionGauge'
import { ActiveUsersPanel } from '@/features/presence/ActiveUsersPanel'
import { DashboardSkeleton } from '@/components/Skeleton'
import { toastError, toastSuccess } from '@/stores/toast-store'
import { MyDaySection } from './MyDaySection'

type StatusFilter = 'all' | 'live' | 'offline'
type SortKey = 'viewers' | 'name' | 'followers'

const number = new Intl.NumberFormat('es-MX')
const time = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

function avatar(talent: Talent, className = '') {
  return talent.avatar
    ? <img className={className} src={talent.avatar} alt="" />
    : <div className={`avatar-placeholder ${className}`}>{talent.displayName.slice(0, 2).toUpperCase()}</div>
}

function liveDuration(startedAt?: string) {
  if (!startedAt) return 'Inicio no disponible'
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60_000))
  const hours = Math.floor(minutes / 60)
  return hours > 0 ? `${hours} h ${minutes % 60} min en directo` : `${minutes} min en directo`
}

export function Dashboard() {
  const talents = useAppStore((state) => state.talents)
  const loading = useAppStore((state) => state.twitchLoading)
  const error = useAppStore((state) => state.twitchError)
  const helixStatus = useAppStore((state) => state.helixStatus)
  const lastUpdate = useAppStore((state) => state.lastTwitchUpdate)
  const hasCompletedSync = useAppStore((state) => state.hasCompletedTwitchSync)
  const refresh = useAppStore((state) => state.refreshTalentData)
  const { snapshots, eventSub } = useMetricHistory(168)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<SortKey>('viewers')
  const [historyLogin, setHistoryLogin] = useState<string | undefined>()

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return talents
      .filter((talent) => !normalized
        || talent.displayName.toLowerCase().includes(normalized)
        || talent.login.toLowerCase().includes(normalized))
      .filter((talent) => status === 'all' || (status === 'live' ? talent.isLive : !talent.isLive))
      .sort((a, b) => {
        if (sort === 'name') return a.displayName.localeCompare(b.displayName, 'es')
        if (sort === 'followers') return b.followers - a.followers
        return b.viewers - a.viewers
      })
  }, [query, sort, status, talents])

  const liveTalents = filtered.filter((talent) => talent.isLive)
  const totalViewers = liveTalents.reduce((sum, talent) => sum + talent.viewers, 0)
  const averageViewers = liveTalents.length ? Math.round(totalViewers / liveTalents.length) : 0
  const gaugeMaxViewers = Math.max(100, ...talents.map((t) => t.viewers), averageViewers)
  const chartData = filtered.map((talent) => ({
    name: talent.displayName,
    viewers: talent.viewers,
    live: talent.isLive,
  }))
  const lastUpdateLabel = lastUpdate ? time.format(new Date(lastUpdate)) : loading ? 'Consultando…' : 'Sin sincronizar'
  const historyTarget = historyLogin ?? filtered.find((talent) => talent.isLive)?.login ?? filtered[0]?.login
  const eventSubLabel = eventSub?.state === 'connected'
    ? 'Tiempo real activo'
    : eventSub?.state === 'fallback_polling'
      ? 'Actualización cada 60s'
      : 'Consulta periódica'
  const showSkeleton = !hasCompletedSync && (loading || talents.every((t) => t.id.startsWith('pending-')))

  if (showSkeleton) return <DashboardSkeleton />

  const kpis = [
    { label: 'Talentos', value: number.format(filtered.length), meta: `${talents.length} en cartera`, icon: Users, tone: 'blue' },
    { label: 'En directo', value: number.format(liveTalents.length), meta: liveTalents.length ? 'Emitiendo ahora' : 'Sin emisiones', icon: Activity, tone: 'live' },
    { label: 'Viewers totales', value: number.format(totalViewers), meta: 'Audiencia simultánea', icon: Eye, tone: 'purple' },
    { label: 'Promedio live', value: number.format(averageViewers), meta: 'Por canal activo', icon: Radio, tone: 'cyan' },
    { label: 'Offline', value: number.format(filtered.length - liveTalents.length), meta: 'Canales inactivos', icon: WifiOff, tone: 'neutral' },
    { label: 'Actualización', value: lastUpdateLabel, meta: helixStatus === 'connected' ? 'Conexión Twitch' : 'Estado de conexión', icon: Clock3, tone: 'amber' },
  ]

  return (
    <motion.div className="bi-dashboard" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <div className="bi-titlebar">
        <div>
          <span className="bi-overline">CENTRO DE OPERACIONES · TWITCH</span>
          <h1>Dashboard de talento</h1>
          <p>Estado operativo y audiencia en tiempo real de NeuraLive.</p>
        </div>
        <div className={`bi-connection ${helixStatus}`}>
          <i />
          <span>{helixStatus === 'connected' ? 'Datos en vivo' : helixStatus === 'connecting' ? 'Sincronizando' : helixStatus === 'error' ? 'Conexión interrumpida' : 'Preparando conexión'} · {eventSubLabel}</span>
        </div>
      </div>

      <ActiveUsersPanel />

      <MyDaySection />

      <section className="bi-filterbar" aria-label="Filtros globales">
        <label className="bi-search">
          <Search size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar talento o canal" />
        </label>
        <div className="bi-segmented" aria-label="Filtrar por estado">
          {([['all', 'Todos'], ['live', 'Online'], ['offline', 'Offline']] as const).map(([value, label]) => (
            <button key={value} className={status === value ? 'active' : ''} onClick={() => setStatus(value)}>{label}</button>
          ))}
        </div>
        <label className="bi-select">
          <span>Ordenar por</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            <option value="viewers">Viewers</option>
            <option value="followers">Followers</option>
            <option value="name">Nombre</option>
          </select>
        </label>
        <span className="bi-filter-result">{filtered.length} de {talents.length} talentos</span>
        <button className="bi-refresh" disabled={loading} onClick={() => void refresh().then(() => {
          const err = useAppStore.getState().twitchError
          if (err) toastError('No se pudo actualizar')
          else toastSuccess('Sincronizado')
        })}>
          <RefreshCw size={14} className={loading ? 'spinning' : ''} />
          {loading ? 'Actualizando' : 'Actualizar'}
        </button>
      </section>

      {error && <div className="bi-alert">Conexión Twitch: {error}</div>}

      <section className="bi-kpi-strip">
        {kpis.map(({ label, value, meta, icon: Icon, tone }) => (
          <div className={`bi-kpi ${tone}`} key={label}>
            <div className="bi-kpi-icon"><Icon size={18} strokeWidth={1.8} /></div>
            <div className="bi-kpi-content">
              <span className="bi-kpi-label">{label}</span>
              <strong>{value}</strong>
              <small>{meta}</small>
            </div>
          </div>
        ))}
      </section>

      <div className="bi-visual-grid">
        <section className="bi-panel bi-chart-panel">
          <header>
            <div><h2>Viewers por canal</h2><p>Comparativa actual · canales filtrados</p></div>
            <span className="bi-unit">VIEWERS</span>
          </header>
          <div className="bi-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 8 }}>
                <defs>
                  <linearGradient id="biBarLive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4ade80" stopOpacity={1} />
                    <stop offset="100%" stopColor="#4ade80" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="biBarOffline" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#64748b" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#64748b" stopOpacity={0.05} />
                  </linearGradient>
                  <filter id="biBarGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#22c55e" floodOpacity="0.45" />
                  </filter>
                </defs>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="#9CA3AF"
                  axisLine={{ stroke: '#9CA3AF' }}
                  tickLine={{ stroke: '#9CA3AF' }}
                  tick={{ fill: '#E5E7EB', fontSize: 10 }}
                  interval={0}
                  angle={-18}
                  textAnchor="end"
                  height={48}
                />
                <YAxis
                  stroke="#9CA3AF"
                  axisLine={{ stroke: '#9CA3AF' }}
                  tickLine={{ stroke: '#9CA3AF' }}
                  tick={{ fill: '#E5E7EB', fontSize: 10 }}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: 'var(--chart-cursor)' }}
                  contentStyle={{
                    backgroundColor: 'var(--popover)',
                    border: '1px solid var(--popover-border)',
                    borderRadius: 6,
                    color: 'var(--popover-foreground)',
                    fontSize: 12,
                  }}
                  labelStyle={{ color: 'var(--popover-foreground)', fontWeight: 600 }}
                  itemStyle={{ color: 'var(--popover-foreground)' }}
                />
                <Bar dataKey="viewers" name="Viewers" radius={[6, 6, 0, 0]} maxBarSize={46}>
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.live ? 'url(#biBarLive)' : 'url(#biBarOffline)'}
                      filter={entry.live ? 'url(#biBarGlow)' : undefined}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <footer><span><i className="legend-live" /> En directo</span><span><i className="legend-offline" /> Offline</span></footer>
        </section>

        <VisionGauge
          value={averageViewers}
          max={gaugeMaxViewers}
          label="Promedio live"
          displayValue={averageViewers > 0 ? number.format(averageViewers) : '—'}
          suffix="viewers"
        />

        <section className="bi-panel bi-live-panel glow-live">
          <header>
            <div><h2>En directo</h2><p>Detalle de emisiones activas</p></div>
            <Radio size={17} />
          </header>
          {liveTalents.length > 0 ? (
            <div className="bi-live-content">
              {liveTalents.map((talent) => (
                <article className="bi-live-detail" key={talent.id}>
                  <div className="bi-live-identity">
                    {avatar(talent, 'bi-live-avatar')}
                    <div><span className="bi-live-badge">EN VIVO</span><h3>{talent.displayName}</h3><p>@{talent.login}</p></div>
                  </div>
                  <div className="bi-live-metric"><Eye size={15} /><strong>{number.format(talent.viewers)}</strong><span>viewers</span></div>
                  <dl>
                    <div><dt>Categoría</dt><dd>{talent.category || 'Sin categoría'}</dd></div>
                    <div><dt>Duración</dt><dd>{liveDuration(talent.startedAt)}</dd></div>
                    <div><dt>Título</dt><dd>{talent.title || 'Sin título disponible'}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          ) : (
            <div className="bi-empty-live">
              <WifiOff size={24} />
              <strong>{hasCompletedSync && !loading ? 'Sin canales en directo' : 'Consultando emisiones'}</strong>
              <span>Los streams activos aparecerán aquí.</span>
            </div>
          )}
        </section>
      </div>

      <div className="bi-history-toolbar">
        <span>Histórico</span>
        <select value={historyTarget ?? ''} onChange={(event) => setHistoryLogin(event.target.value || undefined)}>
          {filtered.map((talent) => <option key={talent.id} value={talent.login}>{talent.displayName}</option>)}
        </select>
      </div>
      <MetricHistoryChart snapshots={snapshots} login={historyTarget} />

      <section className="bi-panel bi-table-panel">
        <header>
          <div><h2>Matriz de talentos</h2><p>Estado, categoría y métricas públicas de Twitch</p></div>
          <span className="bi-unit">{filtered.length} REGISTROS</span>
        </header>
        <div className="bi-table-scroll">
          <table className="bi-table">
            <thead><tr>
              <th>Talento</th><th>Estado</th><th>Categoría</th>
              <th><button onClick={() => setSort('viewers')}>Viewers <ArrowUpDown size={11} /></button></th>
              <th><button onClick={() => setSort('followers')}>Followers <ArrowUpDown size={11} /></button></th>
              <th>Canal</th>
            </tr></thead>
            <tbody>
              {filtered.map((talent) => (
                <tr key={talent.id}>
                  <td><div className="bi-talent">{avatar(talent)}<span><b>{talent.displayName}</b><small>@{talent.login}</small></span></div></td>
                  <td><span className={`bi-status ${talent.isLive ? 'live' : ''}`}><i />{talent.isLive ? 'En directo' : talent.id.startsWith('pending-') ? 'Consultando' : 'Offline'}</span></td>
                  <td className="bi-category">{talent.category || '—'}</td>
                  <td className="bi-number">{number.format(talent.viewers)}</td>
                  <td className="bi-number">{talent.followers > 0 ? number.format(talent.followers) : '—'}</td>
                  <td><span className="bi-login">{talent.login}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="bi-empty-table">No hay talentos que coincidan con los filtros.</div>}
        </div>
      </section>

      <div className="bi-bottom-grid">
        <section className="bi-panel bi-status-grid">
          <header><div><h2>Mapa de estado</h2><p>Disponibilidad de la cartera monitorizada</p></div></header>
          <div>{talents.map((talent) => <span className={talent.isLive ? 'live' : ''} key={talent.id} title={`${talent.displayName}: ${talent.isLive ? 'En directo' : 'Offline'}`}><i />{talent.displayName}</span>)}</div>
        </section>
        <section className="bi-panel bi-operations">
          <header><div><h2>Estado operativo</h2><p>Origen y frescura de los datos</p></div></header>
          <div className="bi-operation-row"><span>Fuente</span><strong>Twitch · datos públicos</strong></div>
          <div className="bi-operation-row"><span>Última actualización</span><strong>{lastUpdateLabel}</strong></div>
          <div className="bi-operation-row"><span>Frecuencia</span><strong>60 segundos</strong></div>
        </section>
      </div>
    </motion.div>
  )
}
