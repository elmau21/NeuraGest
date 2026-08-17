import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Sparkles } from '@/components/icons'
import { listPipelineItems, type PipelineItem } from '@/services/agency'
import type { MetricSnapshot, StreamEvent } from '@/services/metrics'
import { isTauri } from '@/services/twitch'
import { buildHighlightsQueue, type HighlightQueueItem } from './twitch-intelligence-utils'

export function HighlightsQueue({
  snapshots,
  events,
}: {
  snapshots: MetricSnapshot[]
  events: StreamEvent[]
}) {
  const [items, setItems] = useState<HighlightQueueItem[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!isTauri) return
    setLoading(true)
    try {
      const pipeline = await listPipelineItems()
      setItems(buildHighlightsQueue(pipeline, snapshots, events))
    } finally {
      setLoading(false)
    }
  }, [snapshots, events])

  useEffect(() => { void reload() }, [reload])

  if (!isTauri) {
    return <div className="ti-empty">Cola de highlights requiere la app de escritorio y sincronización en la nube.</div>
  }

  return (
    <section className="ti-panel">
      <header>
        <div>
          <h2><Sparkles size={14} /> Cola highlights con score</h2>
          <p>Priorización automática de clips/highlights del pipeline</p>
        </div>
        <span className="ti-badge ok">{items.length} en cola</span>
      </header>

      <div className="ti-highlights-list">
        {items.map((item, index) => (
          <article key={item.id}>
            <div className="ti-score-ring" data-tier={item.score >= 70 ? 'high' : item.score >= 45 ? 'mid' : 'low'}>
              <strong>{item.score}</strong>
              <small>#{index + 1}</small>
            </div>
            <div>
              <b>{item.title}</b>
              <small>
                {item.talentLogin ? `@${item.talentLogin}` : 'General'} · {item.status} · {item.contentType}
              </small>
              <p>{item.scoreBreakdown}</p>
            </div>
            {item.url && (
              <a href={item.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /></a>
            )}
          </article>
        ))}
        {!loading && items.length === 0 && (
          <div className="ti-empty">Agrega clips o highlights en Pipeline para encolarlos aquí.</div>
        )}
      </div>
    </section>
  )
}

export type { PipelineItem }
