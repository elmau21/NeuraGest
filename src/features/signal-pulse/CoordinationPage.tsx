import { useCallback, useEffect, useMemo, useState } from 'react'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { Link } from 'react-router-dom'
import { ArrowLeft, Radio, RefreshCw, Share2, Users } from '@/components/icons'
import { useAppStore } from '@/stores/app-store'
import { fetchStreamEvents, type StreamEvent } from '@/services/metrics'
import { isTauri } from '@/services/twitch'
import { formatEventSubTypeLabel } from '@/services/activity-format'
import {
  buildRaidItems,
  buildSharedChatSessions,
  filterCoordinationEvents,
  matchesTalentFilter,
  type CoordinationWindowHours,
} from './coordination'

type LiveCoordPayload = {
  type?: string
  login?: string
  streamId?: string | null
  payload?: Record<string, unknown> | null
  occurredAt?: string
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return '—'
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function CoordinationPage() {
  const talents = useAppStore((s) => s.talents)
  const [events, setEvents] = useState<StreamEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [hours, setHours] = useState<CoordinationWindowHours>(48)
  const [talentFilter, setTalentFilter] = useState<string>('')
  const [activeOnly, setActiveOnly] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(undefined)
    try {
      const rows = await fetchStreamEvents(hours)
      setEvents(rows)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setLoading(false)
    }
  }, [hours])

  useEffect(() => {
    void reload()
  }, [reload])

  // Refresco inmediato cuando llega raid / shared chat por EventSub.
  useEffect(() => {
    if (!isTauri) return
    let unlisten: UnlistenFn | undefined
    let cancelled = false
    void listen<LiveCoordPayload>('helix-eventsub', (event) => {
      const type = event.payload.type ?? ''
      if (type !== 'channel.raid' && !type.startsWith('channel.shared_chat')) return
      void reload()
    }).then((fn) => {
      if (cancelled) fn()
      else unlisten = fn
    })
    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [reload])

  const coordEvents = useMemo(
    () => filterCoordinationEvents(events, hours),
    [events, hours],
  )

  const raids = useMemo(() => {
    const items = buildRaidItems(coordEvents)
    return items.filter((item) => matchesTalentFilter(item, talentFilter || null))
  }, [coordEvents, talentFilter])

  const sessions = useMemo(() => {
    let items = buildSharedChatSessions(coordEvents)
    items = items.filter((item) => matchesTalentFilter(item, talentFilter || null))
    if (activeOnly) items = items.filter((item) => item.active)
    return items
  }, [coordEvents, talentFilter, activeOnly])

  const activeCount = sessions.filter((s) => s.active).length
  const recentRaids = raids.filter((r) => r.recent).length

  const talentOptions = useMemo(
    () =>
      [...talents]
        .map((t) => ({ login: t.login, name: t.displayName }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [talents],
  )

  if (!isTauri) {
    return (
      <div className="card">
        <h1>Coordinación</h1>
        <p className="empty-state">
          Raids y shared chat requieren la app de escritorio con EventSub conectado.
        </p>
        <Link to="/senal" className="secondary" style={{ display: 'inline-flex', marginTop: 12 }}>
          <ArrowLeft size={14} /> Volver a Señal Pulse
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="page-title coord-header">
        <div>
          <p className="page-eyebrow">
            <Link to="/senal">Señal Pulse</Link>
            <span aria-hidden> / </span>
            Coordinación
          </p>
          <h1>
            <Share2 size={20} aria-hidden /> Raids y shared chat
          </h1>
          <p>Coordinación ops · EventSub real · ventana {hours}h</p>
        </div>
        <div className="page-actions coord-header-actions">
          <button type="button" className="secondary" onClick={() => void reload()} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'ml-spin' : undefined} />
            {loading ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      <div className="signal-kpi-strip coord-kpi-strip" role="group" aria-label="Resumen coordinación">
        <div className="signal-kpi">
          <span><Radio size={12} /> Raids</span>
          <strong>{raids.length}</strong>
          <em>{recentRaids > 0 ? `${recentRaids} recientes` : 'últimas horas'}</em>
        </div>
        <div className={`signal-kpi${activeCount > 0 ? ' live' : ''}`}>
          <span><Users size={12} /> Shared chat</span>
          <strong>{activeCount}</strong>
          <em>{activeCount > 0 ? 'en curso' : `${sessions.length} en historial`}</em>
        </div>
        <div className="signal-kpi">
          <span>Ventana</span>
          <strong>{hours}h</strong>
          <em>historial corto</em>
        </div>
      </div>

      <section className="card signal-panel coord-filters" aria-label="Filtros">
        <div className="coord-filter-row">
          <label>
            Talento
            <select
              value={talentFilter}
              onChange={(e) => setTalentFilter(e.target.value)}
              aria-label="Filtrar por talento"
            >
              <option value="">Toda la cartera</option>
              {talentOptions.map((t) => (
                <option key={t.login} value={t.login}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ventana
            <select
              value={hours}
              onChange={(e) => setHours(Number(e.target.value) as CoordinationWindowHours)}
              aria-label="Ventana de historial"
            >
              <option value={24}>24 horas</option>
              <option value={48}>48 horas</option>
            </select>
          </label>
          <label className="coord-check">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
            />
            Solo shared chat en curso
          </label>
        </div>
        {error ? <p className="integration-note integration-error" role="alert">{error}</p> : null}
      </section>

      <div className="signal-grid signal-grid-bottom coord-grid">
        <section className="card signal-panel">
          <header>
            <h3>Raids</h3>
            <span>from → to · viewers si EventSub los envió</span>
          </header>
          {loading && raids.length === 0 ? (
            <p className="empty-state" aria-busy="true">Cargando raids…</p>
          ) : raids.length === 0 ? (
            <div className="empty-state" role="status">
              <p>Sin raids en esta ventana.</p>
              <p>Cuando un talento reciba o lance raid, aparecerá aquí con viewers.</p>
            </div>
          ) : (
            <ul className="coord-list">
              {raids.map((raid) => (
                <li key={raid.id} className={raid.recent ? 'is-active' : undefined}>
                  <div className="coord-list-main">
                    <b>
                      @{raid.fromLogin}
                      <span className="coord-arrow" aria-hidden> → </span>
                      @{raid.toLogin}
                    </b>
                    <span>
                      {raid.viewers != null
                        ? `${raid.viewers.toLocaleString('es-MX')} viewers`
                        : 'Viewers no reportados'}
                      {' · '}
                      {formatWhen(raid.occurredAt)}
                    </span>
                  </div>
                  {raid.recent ? <span className="coord-badge">Reciente</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card signal-panel">
          <header>
            <h3>Shared chat</h3>
            <span>Sesiones · begin / update / end · canales</span>
          </header>
          {loading && sessions.length === 0 ? (
            <p className="empty-state" aria-busy="true">Cargando sesiones…</p>
          ) : sessions.length === 0 ? (
            <div className="empty-state" role="status">
              <p>Sin shared chat en esta ventana.</p>
              <p>Las sesiones en curso se destacan automáticamente.</p>
            </div>
          ) : (
            <ul className="coord-list">
              {sessions.map((session) => (
                <li key={session.sessionId} className={session.active ? 'is-active' : undefined}>
                  <div className="coord-list-main">
                    <b>
                      {session.hostLogin
                        ? `Host @${session.hostLogin}`
                        : `Sesión ${session.sessionId.slice(0, 8)}…`}
                    </b>
                    <span className="coord-channels">
                      {session.participantLogins.length > 0
                        ? session.participantLogins.map((l) => `@${l}`).join(' · ')
                        : session.talentLogins.map((l) => `@${l}`).join(' · ')}
                    </span>
                    <span>
                      {formatEventSubTypeLabel(session.lastEventType)}
                      {' · '}
                      {session.active
                        ? `desde ${formatWhen(session.startedAt)}`
                        : `fin ${formatWhen(session.endedAt ?? session.updatedAt)}`}
                    </span>
                  </div>
                  {session.active ? (
                    <span className="coord-badge live">En curso</span>
                  ) : (
                    <span className="coord-badge muted">Cerrada</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
