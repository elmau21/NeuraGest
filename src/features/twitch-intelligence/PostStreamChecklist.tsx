import { useCallback, useEffect, useState } from 'react'
import { CheckSquare, Radio } from '@/components/icons'
import { listen } from '@tauri-apps/api/event'
import { fetchStreamEvents } from '@/services/metrics'
import { isTauri } from '@/services/twitch'
import type { StreamOfflinePayload } from '@/services/twitch-intelligence'
import {
  createPostStreamSession,
  loadPostStreamSessions,
  savePostStreamSessions,
  type PostStreamSession,
} from './twitch-intelligence-utils'

export function PostStreamChecklist({
  displayNames,
}: {
  displayNames: Record<string, string>
}) {
  const [sessions, setSessions] = useState<PostStreamSession[]>(() => loadPostStreamSessions())

  const addSession = useCallback((payload: {
    login: string
    title?: string | null
    categoryName?: string | null
    occurredAt: string
  }) => {
    const displayName = displayNames[payload.login] ?? payload.login
    const session = createPostStreamSession(
      payload.login,
      displayName,
      payload.occurredAt,
      payload.title ?? undefined,
      payload.categoryName ?? undefined,
    )
    setSessions((prev) => {
      if (prev.some((row) => row.id === session.id)) return prev
      const next = [session, ...prev].slice(0, 30)
      savePostStreamSessions(next)
      return next
    })
  }, [displayNames])

  useEffect(() => {
    if (!isTauri) return
    let cancelled = false
    void fetchStreamEvents(48).then((events) => {
      if (cancelled) return
      for (const event of events.filter((row) => row.eventType === 'stream.offline')) {
        addSession({
          login: event.login,
          title: event.title,
          categoryName: event.categoryName,
          occurredAt: event.occurredAt,
        })
      }
    })
    return () => { cancelled = true }
  }, [addSession])

  useEffect(() => {
    if (!isTauri) return
    const unlisten = listen<StreamOfflinePayload>('stream-offline', (event) => {
      addSession({
        login: event.payload.login,
        title: event.payload.title,
        categoryName: event.payload.categoryName,
        occurredAt: event.payload.occurredAt,
      })
    })
    return () => { void unlisten.then((fn) => fn()) }
  }, [addSession])

  const toggleItem = (sessionId: string, itemId: string) => {
    setSessions((prev) => {
      const next = prev.map((session) => {
        if (session.id !== sessionId) return session
        const items = session.items.map((item) =>
          item.id === itemId ? { ...item, done: !item.done } : item,
        )
        const completed = items.every((item) => item.done)
        return { ...session, items, completed }
      })
      savePostStreamSessions(next)
      return next
    })
  }

  const dismiss = (sessionId: string) => {
    setSessions((prev) => {
      const next = prev.filter((row) => row.id !== sessionId)
      savePostStreamSessions(next)
      return next
    })
  }

  const pending = sessions.filter((row) => !row.completed)

  return (
    <section className="ti-panel">
      <header>
        <div>
          <h2><CheckSquare size={14} /> Checklist post-stream</h2>
          <p>Se activa automáticamente al terminar un stream en vivo.</p>
        </div>
        <span className={`ti-badge ${pending.length > 0 ? 'warning' : 'ok'}`}>
          <Radio size={11} /> {pending.length} pendientes
        </span>
      </header>

      <div className="ti-checklist-list">
        {sessions.map((session) => (
          <article key={session.id} className={session.completed ? 'done' : ''}>
            <div className="ti-checklist-head">
              <div>
                <b>{session.displayName}</b>
                <small>
                  Offline {new Date(session.offlineAt).toLocaleString('es-MX')}
                  {session.category && ` · ${session.category}`}
                </small>
                {session.title && <p>{session.title}</p>}
              </div>
              {session.completed && (
                <button className="secondary" onClick={() => dismiss(session.id)}>Archivar</button>
              )}
            </div>
            <ul>
              {session.items.map((item) => (
                <li key={item.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => toggleItem(session.id, item.id)}
                    />
                    {item.label}
                  </label>
                </li>
              ))}
            </ul>
          </article>
        ))}
        {sessions.length === 0 && (
          <div className="ti-empty">
            {isTauri
              ? 'Esperando que un talento termine su stream…'
              : 'Requiere la app de escritorio para detectar fin de stream.'}
          </div>
        )}
      </div>
    </section>
  )
}
