import { Clock } from 'lucide-react'
import { buildScheduleHeatmap, dayLabel, type HeatmapCell } from './twitch-intelligence-utils'

function cellColor(intensity: number) {
  if (intensity === 0) return '#0d1117'
  if (intensity < 25) return '#1e3a2f'
  if (intensity < 50) return '#166534'
  if (intensity < 75) return '#22c55e'
  return '#4ade80'
}

export function ScheduleHeatmap({ cells }: { cells: HeatmapCell[] }) {
  const maxIntensity = Math.max(...cells.map((cell) => cell.intensity), 1)
  const peak = cells.reduce((best, cell) => (cell.intensity > best.intensity ? cell : best), cells[0])

  return (
    <section className="ti-panel">
      <header>
        <div>
          <h2><Clock size={14} /> Heatmap horarios</h2>
          <p>Probabilidad de estar en directo según histórico guardado</p>
        </div>
        <span className="ti-badge ok">
          Pico: {dayLabel(peak?.day ?? 0)} {peak?.hour ?? 0}:00
        </span>
      </header>

      <div className="ti-heatmap-wrap">
        <div className="ti-heatmap-hours">
          <span />
          {Array.from({ length: 24 }, (_, hour) => (
            <span key={hour}>{hour % 6 === 0 ? `${hour}h` : ''}</span>
          ))}
        </div>
        {[0, 1, 2, 3, 4, 5, 6].map((day) => (
          <div className="ti-heatmap-row" key={day}>
            <span className="ti-heatmap-day">{dayLabel(day)}</span>
            {Array.from({ length: 24 }, (_, hour) => {
              const cell = cells.find((item) => item.day === day && item.hour === hour)
              const intensity = cell?.intensity ?? 0
              return (
                <div
                  key={hour}
                  className="ti-heatmap-cell"
                  style={{
                    background: cellColor(intensity),
                    opacity: intensity > 0 ? 0.35 + (intensity / maxIntensity) * 0.65 : 1,
                  }}
                  title={`${dayLabel(day)} ${hour}:00 · ${intensity}% live (${cell?.snapshots ?? 0} capturas)`}
                />
              )
            })}
          </div>
        ))}
      </div>

      <div className="ti-heatmap-legend">
        <span>Baja actividad</span>
        <i style={{ background: cellColor(10) }} />
        <i style={{ background: cellColor(40) }} />
        <i style={{ background: cellColor(70) }} />
        <i style={{ background: cellColor(90) }} />
        <span>Alta actividad</span>
      </div>
    </section>
  )
}

export function useHeatmapCells(snapshots: Parameters<typeof buildScheduleHeatmap>[0]) {
  return buildScheduleHeatmap(snapshots)
}
