import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, Film, Lightbulb, RefreshCw } from 'lucide-react'
import { buildVodSuggestions, fetchWeeklyVods, type VodSuggestion, type WeeklyVod } from '@/services/vod-digest'
import { isTauri } from '@/services/twitch'

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function VodDigestPage() {
  const [vods, setVods] = useState<WeeklyVod[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!isTauri) return
    setLoading(true)
    setError(null)
    try {
      setVods(await fetchWeeklyVods())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const suggestions = useMemo(() => buildVodSuggestions(vods), [vods])
  const totalViews = vods.reduce((s, v) => s + v.viewCount, 0)

  if (!isTauri) {
    return <div className="card agency-gate"><p>VOD digest requiere la app de escritorio y conexión con Twitch.</p></div>
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1><Film size={22} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />VOD digest semanal</h1>
          <p>Repeticiones de Twitch de los últimos 7 días y sugerencias de contenido para el roster.</p>
        </div>
        <button className="secondary" disabled={loading} onClick={() => void reload()}>
          <RefreshCw size={16} />{loading ? 'Consultando Twitch…' : 'Actualizar'}
        </button>
      </div>

      {error && <p className="integration-note">{error}</p>}

      <div className="kpi-grid ops-kpi-4">
        <div className="card"><span>VODs</span><b>{vods.length}</b></div>
        <div className="card"><span>Views totales</span><b>{totalViews.toLocaleString('es-MX')}</b></div>
        <div className="card"><span>Top VOD</span><b>{vods[0]?.viewCount.toLocaleString('es-MX') ?? '—'}</b></div>
        <div className="card"><span>Sugerencias</span><b>{suggestions.length}</b></div>
      </div>

      <div className="ops-two-col">
        <div className="card">
          <h3>VODs de la semana</h3>
          <div className="vod-digest-list">
            {vods.map((vod) => (
              <article key={vod.id} className="vod-digest-item">
                {vod.thumbnailUrl && (
                  <img src={vod.thumbnailUrl.replace('%{width}', '120').replace('%{height}', '68')} alt="" />
                )}
                <div>
                  <b>{vod.title || 'Sin título'}</b>
                  <small>{vod.displayName} · {formatDuration(vod.durationSeconds)} · {new Date(vod.publishedAt).toLocaleDateString('es-MX')}</small>
                </div>
                <em>{vod.viewCount.toLocaleString('es-MX')}</em>
                <a href={vod.url} target="_blank" rel="noreferrer" aria-label="Abrir VOD"><ExternalLink size={14} /></a>
              </article>
            ))}
            {!loading && vods.length === 0 && <p className="empty-state">Sin VODs en la ventana semanal.</p>}
          </div>
        </div>

        <div className="card">
          <h3><Lightbulb size={16} /> Sugerencias</h3>
          <ul className="vod-suggestions-list">
            {suggestions.map((s: VodSuggestion) => (
              <li key={s.vodId} className={`vod-suggestion ${s.priority}`}>
                <span className="vod-suggestion-pill">{s.priority}</span>
                <div>
                  <b>{s.displayName}</b>
                  <p>{s.title}</p>
                  <small>{s.reason}</small>
                </div>
                <a href={s.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /></a>
              </li>
            ))}
            {!loading && suggestions.length === 0 && (
              <p className="empty-state">Sin sugerencias — sincroniza VODs o amplía la ventana.</p>
            )}
          </ul>
        </div>
      </div>
    </>
  )
}
