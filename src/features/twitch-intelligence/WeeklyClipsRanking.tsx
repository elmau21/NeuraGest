import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, RefreshCw, Trophy } from 'lucide-react'
import { fetchWeeklyClips, type WeeklyClip } from '@/services/twitch-intelligence'
import { isTauri } from '@/services/twitch'

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function WeeklyClipsRanking() {
  const [clips, setClips] = useState<WeeklyClip[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()

  const reload = useCallback(async () => {
    if (!isTauri) return
    setLoading(true)
    setError(undefined)
    try {
      setClips(await fetchWeeklyClips())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const totalViews = clips.reduce((sum, clip) => sum + clip.viewCount, 0)

  if (!isTauri) {
    return <div className="ti-empty">Ranking de clips requiere la app de escritorio y conexión con Twitch.</div>
  }

  return (
    <section className="ti-panel">
      <header>
        <div>
          <h2><Trophy size={14} /> Ranking clips semanal</h2>
          <p>Top clips de Twitch de los últimos 7 días</p>
        </div>
        <button className="ti-sync" disabled={loading} onClick={() => void reload()}>
          <RefreshCw size={13} />{loading ? 'Consultando…' : 'Actualizar'}
        </button>
      </header>

      {error && <p className="integration-note">{error}</p>}

      <div className="ti-clips-summary">
        <article><span>Clips</span><strong>{clips.length}</strong></article>
        <article><span>Views totales</span><strong>{totalViews.toLocaleString('es-MX')}</strong></article>
        <article><span>Top clip</span><strong>{clips[0]?.viewCount.toLocaleString('es-MX') ?? '—'}</strong></article>
      </div>

      <div className="ti-clips-list">
        {clips.map((clip, index) => (
          <article key={clip.id}>
            <strong>{index + 1}</strong>
            {clip.thumbnailUrl && <img src={clip.thumbnailUrl.replace('%{width}', '88').replace('%{height}', '50')} alt="" />}
            <div>
              <b>{clip.title || 'Sin título'}</b>
              <small>{clip.displayName} · {formatDuration(clip.duration)} · {new Date(clip.createdAt).toLocaleDateString('es-MX')}</small>
            </div>
            <em>{clip.viewCount.toLocaleString('es-MX')} views</em>
            <a href={clip.url} target="_blank" rel="noreferrer" aria-label="Abrir clip">
              <ExternalLink size={14} />
            </a>
          </article>
        ))}
        {!loading && clips.length === 0 && (
          <div className="ti-empty">No hay clips en la ventana semanal para la cartera.</div>
        )}
      </div>
    </section>
  )
}
