import { AlertTriangle, Info, Radio, Tag, TrendingDown } from 'lucide-react'
import type { EventSubStatus, StreakIndicator } from '@/services/metrics'

const iconByType = {
  days_offline: Radio,
  viewer_drop: TrendingDown,
  atypical_category: Tag,
} as const

const severityClass = {
  critical: 'critical',
  warning: 'warning',
  info: 'info',
} as const

function eventSubLabel(status: EventSubStatus | null) {
  if (!status) return 'Tiempo real no disponible (requiere app de escritorio)'
  switch (status.state) {
    case 'connected': return `Tiempo real · ${status.subscriptions} suscripciones activas`
    case 'connecting': return 'Conectando tiempo real…'
    case 'fallback_polling': return 'Tiempo real en pausa · actualización cada 60s'
    default: return 'Tiempo real desconectado · actualización cada 60s'
  }
}

export function StreakIndicatorsPanel({
  streaks,
  eventSub,
}: {
  streaks: StreakIndicator[]
  eventSub: EventSubStatus | null
}) {
  return (
    <section className="an-panel an-streaks">
      <header>
        <div>
          <h2>Indicadores de rachas</h2>
          <p>Días sin stream, caídas de viewers y categorías atípicas</p>
        </div>
        <span className={`an-eventsub-badge ${eventSub?.state ?? 'disconnected'}`}>
          {eventSubLabel(eventSub)}
        </span>
      </header>
      {streaks.length > 0 ? (
        <div className="an-streak-list">
          {streaks.map((item) => {
            const Icon = iconByType[item.type]
            return (
              <article className={severityClass[item.severity]} key={`${item.login}-${item.type}-${item.label}`}>
                <Icon size={15} />
                <div>
                  <b>{item.displayName}</b>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </div>
                {item.severity !== 'info' && <AlertTriangle size={13} />}
                {item.severity === 'info' && <Info size={13} />}
              </article>
            )
          })}
        </div>
      ) : (
        <div className="an-empty">Sin alertas de rachas en el histórico reciente.</div>
      )}
    </section>
  )
}
