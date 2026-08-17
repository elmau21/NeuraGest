import { useState } from 'react'
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { AlertCircle, Tag } from '@/components/icons'
import type { CategoryRadarTalent } from './twitch-intelligence-utils'

const tooltipStyle = {
  backgroundColor: 'var(--popover)',
  border: '1px solid var(--popover-border)',
  borderRadius: 5,
  fontSize: 11,
}

export function AtypicalCategoryRadar({ talents }: { talents: CategoryRadarTalent[] }) {
  const atypicalCount = talents.filter((row) => row.atypical).length
  const [selected, setSelected] = useState(talents[0]?.login ?? '')

  const active = talents.find((row) => row.login === selected) ?? talents[0]

  if (!active) {
    return <div className="ti-empty">Sin capturas en vivo suficientes para el radar de categorías.</div>
  }

  return (
    <section className="ti-panel">
      <header>
        <div>
          <h2><Tag size={14} /> Radar categoría atípica</h2>
          <p>Distribución histórica vs. categoría actual por talento</p>
        </div>
        <span className={atypicalCount > 0 ? 'ti-badge warning' : 'ti-badge ok'}>
          {atypicalCount} atípicos
        </span>
      </header>

      <div className="ti-radar-toolbar">
        {talents.map((row) => (
          <button
            key={row.login}
            className={`${selected === row.login ? 'active' : ''} ${row.atypical ? 'atypical' : ''}`}
            onClick={() => setSelected(row.login)}
          >
            {row.displayName}
            {row.atypical && <AlertCircle size={11} />}
          </button>
        ))}
      </div>

      <div className="ti-radar-body">
        <div className="ti-radar-chart">
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={active.points} cx="50%" cy="50%" outerRadius="72%">
              <PolarGrid stroke="#313947" />
              <PolarAngleAxis dataKey="category" tick={{ fill: '#9aa4b5', fontSize: 9 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#687386', fontSize: 8 }} />
              <Radar
                name="Share %"
                dataKey="share"
                stroke="#8b5cf6"
                fill="#8b5cf6"
                fillOpacity={0.35}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value}%`, 'Share histórico']} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <aside className="ti-radar-meta">
          <dl>
            <div><dt>Habitual</dt><dd>{active.dominantCategory}</dd></div>
            <div><dt>Actual</dt><dd className={active.atypical ? 'atypical' : ''}>{active.currentCategory}</dd></div>
            <div><dt>Estado</dt><dd>{active.atypical ? '⚠ Categoría atípica detectada' : '✓ Dentro del patrón'}</dd></div>
          </dl>
          <ul>
            {active.points.map((point) => (
              <li key={point.category}>
                <span>{point.category}</span>
                <strong>{point.share}%</strong>
                {point.isCurrent && <em>actual</em>}
                {point.isDominant && <em>dominante</em>}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  )
}
