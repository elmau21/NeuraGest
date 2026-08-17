import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { LineChart as LineChartIcon, SlidersHorizontal } from '@/components/icons'
import type { MetricSnapshot } from '@/services/metrics'
import { computeMovingAverage, simulateMovingAverageProjection } from './twitch-intelligence-utils'

const tooltipStyle = {
  backgroundColor: 'var(--popover)',
  border: '1px solid var(--popover-border)',
  borderRadius: 5,
  fontSize: 11,
}

export function MovingAverageSimulator({
  snapshots,
  logins,
  displayNames,
}: {
  snapshots: MetricSnapshot[]
  logins: string[]
  displayNames: Record<string, string>
}) {
  const [login, setLogin] = useState(logins[0] ?? '')
  const [windowSize, setWindowSize] = useState(5)
  const [emaAlpha, setEmaAlpha] = useState(0.3)
  const [growthPct, setGrowthPct] = useState(5)
  const [periods, setPeriods] = useState(6)

  const series = useMemo(
    () => computeMovingAverage(snapshots, login, windowSize, emaAlpha),
    [snapshots, login, windowSize, emaAlpha],
  )

  const lastEma = series[series.length - 1]?.ema ?? series[series.length - 1]?.viewers ?? 0
  const projection = simulateMovingAverageProjection(lastEma, growthPct, periods)
  const projectionData = projection.map((value, index) => ({
    at: `+${index + 1}h`,
    projected: value,
  }))

  const chartData = [
    ...series.map((point) => ({ ...point, projected: null as number | null })),
    ...projectionData.map((point) => ({
      at: point.at,
      viewers: null as number | null,
      sma: null as number | null,
      ema: null as number | null,
      projected: point.projected,
    })),
  ]

  return (
    <section className="ti-panel">
      <header>
        <div>
          <h2><LineChartIcon size={14} /> Simulador media móvil</h2>
          <p>SMA / EMA sobre capturas en vivo + proyección simple</p>
        </div>
        <SlidersHorizontal size={14} />
      </header>

      <div className="ti-sim-controls">
        <label>
          Talento
          <select value={login} onChange={(e) => setLogin(e.target.value)}>
            {logins.map((item) => (
              <option key={item} value={item}>{displayNames[item] ?? item}</option>
            ))}
          </select>
        </label>
        <label>
          Ventana SMA
          <input type="range" min={3} max={15} value={windowSize} onChange={(e) => setWindowSize(Number(e.target.value))} />
          <span>{windowSize}</span>
        </label>
        <label>
          Alpha EMA
          <input type="range" min={0.1} max={0.9} step={0.05} value={emaAlpha} onChange={(e) => setEmaAlpha(Number(e.target.value))} />
          <span>{emaAlpha.toFixed(2)}</span>
        </label>
        <label>
          Crecimiento sim.
          <input type="range" min={-10} max={20} value={growthPct} onChange={(e) => setGrowthPct(Number(e.target.value))} />
          <span>{growthPct >= 0 ? '+' : ''}{growthPct}%/h</span>
        </label>
        <label>
          Periodos
          <input type="number" min={1} max={24} value={periods} onChange={(e) => setPeriods(Math.max(1, Number(e.target.value)))} />
        </label>
      </div>

      {series.length > 0 ? (
        <div className="ti-sim-chart">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid stroke="var(--chart-grid)" />
              <XAxis dataKey="at" tick={{ fill: '#9aa4b5', fontSize: 9 }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#9aa4b5', fontSize: 9 }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="viewers" name="Viewers" stroke="#3b82f6" dot={false} strokeWidth={1.5} connectNulls={false} />
              <Line type="monotone" dataKey="sma" name={`SMA(${windowSize})`} stroke="#22c55e" dot={false} strokeWidth={1.5} connectNulls={false} />
              <Line type="monotone" dataKey="ema" name="EMA" stroke="#8b5cf6" dot={false} strokeWidth={1.5} connectNulls={false} />
              <Line type="monotone" dataKey="projected" name="Proyección" stroke="#f59e0b" strokeDasharray="4 4" dot={false} strokeWidth={1.5} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="ti-empty">Sin capturas en vivo para {displayNames[login] ?? login}.</div>
      )}

      <p className="ti-sim-note">
        Proyección desde EMA actual ({lastEma.toLocaleString('es-MX')} viewers) con {growthPct >= 0 ? '+' : ''}{growthPct}% por periodo simulado.
      </p>
    </section>
  )
}
