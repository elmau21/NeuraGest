interface VisionGaugeProps {
  value: number
  max: number
  label: string
  displayValue?: string
  suffix?: string
}

const RADIUS = 42
const STROKE = 7
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function VisionGauge({ value, max, label, displayValue, suffix }: VisionGaugeProps) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE
  const tone = pct >= 65 ? 'good' : pct >= 35 ? 'mid' : 'low'

  return (
    <article className="glass-card vision-gauge">
      <span className="vision-gauge-label">{label}</span>
      <div className="vision-gauge-ring">
        <svg viewBox="0 0 100 100" aria-hidden>
          <circle className="vision-gauge-track" cx="50" cy="50" r={RADIUS} strokeWidth={STROKE} fill="none" />
          <circle
            className={`vision-gauge-fill ${tone}`}
            cx="50"
            cy="50"
            r={RADIUS}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            transform="rotate(-90 50 50)"
          />
        </svg>
        <div className="vision-gauge-center">
          <strong>{displayValue ?? value.toLocaleString('es-MX')}</strong>
          {suffix ? <small>{suffix}</small> : null}
        </div>
      </div>
    </article>
  )
}
