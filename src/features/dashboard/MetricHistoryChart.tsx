import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { historySeriesByLogin, type MetricSnapshot } from '@/services/metrics'

const chartTooltipStyle = {
  backgroundColor: 'var(--popover)',
  border: '1px solid var(--popover-border)',
  borderRadius: 5,
  color: 'var(--popover-foreground)',
  fontSize: 11,
}

export function MetricHistoryChart({
  snapshots,
  login,
  title = 'Histórico de viewers',
}: {
  snapshots: MetricSnapshot[]
  login?: string
  title?: string
}) {
  const selectedLogin = login ?? snapshots[snapshots.length - 1]?.login
  const series = selectedLogin ? historySeriesByLogin(snapshots, selectedLogin) : []

  return (
    <section className="bi-panel bi-history-panel">
      <header>
        <div>
          <h2>{title}</h2>
          <p>{selectedLogin ? `@${selectedLogin} · histórico Twitch` : 'Selecciona un talento con histórico'}</p>
        </div>
        <span className="bi-unit">{series.length} PUNTOS</span>
      </header>
      {series.length > 1 ? (
        <div className="bi-history-chart">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="historyAreaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ED34D6" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#ED34D6" stopOpacity={0} />
                </linearGradient>
                <filter id="historyLineGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#ED34D6" floodOpacity="0.55" />
                </filter>
              </defs>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="at" tick={{ fill: '#E5E7EB', fontSize: 9 }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#E5E7EB', fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Area
                type="monotone"
                dataKey="viewers"
                name="Viewers"
                stroke="none"
                fill="url(#historyAreaFill)"
                fillOpacity={1}
              />
              <Line
                type="monotone"
                dataKey="viewers"
                name="Viewers"
                stroke="#f472e8"
                strokeWidth={2}
                dot={false}
                filter="url(#historyLineGlow)"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="bi-empty-table">Aún no hay histórico. Los registros se acumulan con cada actualización de Twitch (~60s).</div>
      )}
    </section>
  )
}
