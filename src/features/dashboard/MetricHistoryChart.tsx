import {
  CartesianGrid,
  Line,
  LineChart,
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
            <LineChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="at" tick={{ fill: '#E5E7EB', fontSize: 9 }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#E5E7EB', fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Line type="monotone" dataKey="viewers" name="Viewers" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="bi-empty-table">Aún no hay histórico. Los registros se acumulan con cada actualización de Twitch (~60s).</div>
      )}
    </section>
  )
}
