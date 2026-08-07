import {
  ArrowDown,
  ArrowUp,
  Download,
  FileSpreadsheet,
  FileText,
  Minus,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  downloadTextFile,
  exportWeeklyExcel,
  exportWeeklyPdf,
  weeklyComparisonCsv,
  type WeeklyTalentMetrics,
} from '@/services/metrics'
import { analyticsNumber } from './analytics-utils'

const chartTooltipStyle = {
  backgroundColor: 'var(--popover)',
  border: '1px solid var(--popover-border)',
  borderRadius: 5,
  color: 'var(--popover-foreground)',
  fontSize: 11,
}

function DeltaBadge({ value, suffix = '' }: { value: number; suffix?: string }) {
  if (value === 0) return <span className="an-delta neutral"><Minus size={11} />0{suffix}</span>
  const positive = value > 0
  return (
    <span className={`an-delta ${positive ? 'up' : 'down'}`}>
      {positive ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
      {analyticsNumber.format(Math.abs(value))}{suffix}
    </span>
  )
}

export function WeeklyComparePanel({
  rows,
  loading,
}: {
  rows: WeeklyTalentMetrics[]
  loading: boolean
}) {
  const chartData = rows.slice(0, 8).map((row) => ({
    name: row.displayName,
    actual: row.thisWeek.avgViewers,
    anterior: row.lastWeek.avgViewers,
  }))

  const exportCsv = () => downloadTextFile(
    `neuragest-semanal-${new Date().toISOString().slice(0, 10)}.csv`,
    weeklyComparisonCsv(rows),
    'text/csv;charset=utf-8',
  )

  return (
    <div className="an-tab-content">
      <section className="an-panel">
        <header>
          <div>
            <h2>Comparativa semanal</h2>
            <p>Semana en curso vs semana anterior por talento</p>
          </div>
          <div className="an-export-actions">
            <button onClick={exportCsv} disabled={rows.length === 0 || loading}>
              <Download size={14} /> CSV
            </button>
            <button onClick={() => void exportWeeklyExcel(rows)} disabled={rows.length === 0 || loading}>
              <FileSpreadsheet size={14} /> Excel
            </button>
            <button onClick={() => void exportWeeklyPdf(rows)} disabled={rows.length === 0 || loading}>
              <FileText size={14} /> PDF
            </button>
          </div>
        </header>
        {rows.length > 0 ? (
          <>
            <div className="an-compare-chart an-week-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ left: 4, right: 12, top: 8 }}>
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#E5E7EB', fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={52} />
                  <YAxis tick={{ fill: '#E5E7EB', fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar dataKey="anterior" name="Sem. anterior" fill="#536078" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="actual" name="Sem. actual" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="an-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Talento</th>
                    <th>Avg viewers</th>
                    <th>Peak viewers</th>
                    <th>Días stream</th>
                    <th>Δ avg</th>
                    <th>Δ %</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.login}>
                      <td><b>{row.displayName}</b><small>@{row.login}</small></td>
                      <td>{analyticsNumber.format(row.thisWeek.avgViewers)} <small>vs {analyticsNumber.format(row.lastWeek.avgViewers)}</small></td>
                      <td>{analyticsNumber.format(row.thisWeek.peakViewers)} <small>vs {analyticsNumber.format(row.lastWeek.peakViewers)}</small></td>
                      <td>{row.thisWeek.streamDays} <small>vs {row.lastWeek.streamDays}</small></td>
                      <td><DeltaBadge value={row.deltaAvgViewers} /></td>
                      <td><DeltaBadge value={Math.round(row.deltaPct)} suffix="%" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="an-empty">{loading ? 'Cargando histórico…' : 'Sin capturas suficientes. Espera actualizaciones de Twitch (~60s).'}</div>
        )}
      </section>
    </div>
  )
}
