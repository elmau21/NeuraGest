import { useEffect, useMemo } from 'react'
import { Radio, RefreshCw, Users } from '@/components/icons'
import { useAppStore } from '@/stores/app-store'
import { isTauri } from '@/services/twitch'
import { useMetricHistory } from '@/hooks/useMetricHistory'
import { MultiStreamMosaic } from './MultiStreamMosaic'
import { ActiveUsersPanel } from '@/features/presence/ActiveUsersPanel'
import { WarRoomSkeleton } from '@/components/Skeleton'
import { toastError, toastSuccess } from '@/stores/toast-store'

export function WarRoomPage() {
  const talents = useAppStore((s) => s.talents)
  const refreshTalentData = useAppStore((s) => s.refreshTalentData)
  const helixStatus = useAppStore((s) => s.helixStatus)
  const lastUpdate = useAppStore((s) => s.lastTwitchUpdate)
  const hasCompletedSync = useAppStore((s) => s.hasCompletedTwitchSync)
  const twitchLoading = useAppStore((s) => s.twitchLoading)
  const { snapshots, eventSub, reload, loading } = useMetricHistory(6)

  useEffect(() => {
    const timer = window.setInterval(() => { void refreshTalentData() }, 30_000)
    return () => window.clearInterval(timer)
  }, [refreshTalentData])

  const liveTalents = useMemo(
    () => [...talents].filter((t) => t.isLive).sort((a, b) => b.viewers - a.viewers),
    [talents],
  )

  const offlineCount = talents.length - liveTalents.length
  const showSkeleton = !hasCompletedSync && (twitchLoading || talents.every((t) => t.id.startsWith('pending-')))

  if (!isTauri) {
    return (
      <div className="card agency-gate">
        <p>War Room requiere la app de escritorio y conexión con Twitch para monitoreo multi-live.</p>
      </div>
    )
  }

  if (showSkeleton) return <WarRoomSkeleton />

  return (
    <>
      <div className="page-title">
        <div>
          <h1>War Room / NOC</h1>
          <p>Centro de operaciones multi-live — mira y gestiona varios streams a la vez.</p>
        </div>
        <div className="page-actions">
          <button className="secondary" disabled={loading} onClick={() => {
            void refreshTalentData().then(() => reload()).then(() => {
              const err = useAppStore.getState().twitchError
              if (err) toastError('No se pudo actualizar')
              else toastSuccess('Sincronizado')
            })
          }}>
            <RefreshCw size={16} />{loading ? 'Actualizando…' : 'Refrescar'}
          </button>
        </div>
      </div>

      <div className="kpi-grid ops-kpi-4">
        <div className="card"><span>En directo</span><b className="ops-live-count">{liveTalents.length}</b></div>
        <div className="card"><span>Offline</span><b>{offlineCount}</b></div>
        <div className="card"><span>Viewers totales</span><b>{liveTalents.reduce((s, t) => s + t.viewers, 0).toLocaleString('es-MX')}</b></div>
        <div className="card"><span>Tiempo real</span><b>{eventSub?.state === 'connected' ? 'Conectado' : eventSub?.state === 'connecting' ? 'Conectando' : eventSub?.state === 'fallback_polling' ? 'Modo alterno' : 'Desconectado'}</b></div>
      </div>

      <ActiveUsersPanel />

      <p className="integration-note">
        Twitch: {helixStatus === 'connected' ? 'conectado' : helixStatus === 'connecting' ? 'conectando' : helixStatus === 'error' ? 'error' : 'pendiente'}
        {lastUpdate ? ` · ${new Date(lastUpdate).toLocaleTimeString('es-MX')}` : ''}
        · Capturas 6h: {snapshots.filter((s) => s.isLive).length} en vivo
      </p>

      {liveTalents.length === 0 ? (
        <div className="card ops-empty-noc">
          <Radio size={32} />
          <b>Ningún talento en directo</b>
          <span>El mosaico se llenará automáticamente cuando se detecten streams en Twitch.</span>
        </div>
      ) : (
        <>
          <MultiStreamMosaic liveTalents={liveTalents} />

          <div className="ops-noc-section-label">
            <h3>Tablero de estado</h3>
            <span>Métricas rápidas y tendencia reciente</span>
          </div>
          <div className="ops-noc-grid">
            {liveTalents.map((talent) => {
              const recent = snapshots
                .filter((s) => s.login === talent.login && s.isLive)
                .slice(-8)
              return (
                <div className="card ops-noc-tile" key={talent.id}>
                  <div className="ops-noc-head">
                    {talent.avatar ? <img src={talent.avatar} alt="" /> : <div className="avatar-placeholder">{talent.displayName.slice(0, 2)}</div>}
                    <div>
                      <b>{talent.displayName}</b>
                      <span>@{talent.login}</span>
                    </div>
                    <span className="ops-live-pill">● LIVE</span>
                  </div>
                  <div className="ops-noc-metric">
                    <strong>{talent.viewers.toLocaleString('es-MX')}</strong>
                    <span>viewers</span>
                  </div>
                  <dl className="ops-noc-meta">
                    <div><dt>Categoría</dt><dd>{talent.category || '—'}</dd></div>
                    <div><dt>Título</dt><dd>{talent.title || '—'}</dd></div>
                    <div><dt>Seguidores</dt><dd>{talent.followers > 0 ? talent.followers.toLocaleString('es-MX') : '—'}</dd></div>
                  </dl>
                  {recent.length > 1 && (
                    <div className="ops-sparkline" aria-hidden>
                      {recent.map((point) => (
                        <i key={point.id} style={{ height: `${Math.max(8, Math.min(100, point.viewers / Math.max(talent.viewers, 1) * 100))}%` }} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="card ops-offline-strip">
        <h3><Users size={15} /> Roster offline ({offlineCount})</h3>
        <div className="ops-offline-list">
          {talents.filter((t) => !t.isLive).map((t) => (
            <span key={t.id}>@{t.login}</span>
          ))}
        </div>
      </div>
    </>
  )
}
