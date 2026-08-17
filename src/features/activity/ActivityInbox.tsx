import { useEffect, useRef, useState } from 'react'
import { Bell, X } from '@/components/icons'
import { fetchActivity, watchActivity, type ActivityItem } from '@/services/activity'

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'ahora'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  return new Date(iso).toLocaleDateString('es-MX')
}

export function ActivityInbox() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<ActivityItem[]>([])
  const wrapRef = useRef<HTMLDivElement>(null)

  const load = () => void fetchActivity().then(setItems)

  useEffect(() => {
    load()
    return watchActivity(load)
  }, [])

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [open])

  const unread = items.length > 0

  return (
    <div className="activity-inbox-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`activity-bell${open ? ' active' : ''}`}
        aria-label={unread ? `Actividad (${items.length} recientes)` : 'Actividad'}
        title="Actividad"
        onClick={(event) => {
          event.stopPropagation()
          setOpen((value) => !value)
        }}
      >
        <Bell size={16} strokeWidth={2} aria-hidden />
        {unread && <span className="activity-unread" aria-hidden />}
      </button>
      {open && (
        <div className="activity-inbox card" onClick={(event) => event.stopPropagation()}>
          <div className="activity-inbox-head">
            <b>Actividad</b>
            <button className="secondary" onClick={() => setOpen(false)}><X size={14}/></button>
          </div>
          <div className="activity-list">
            {items.map((item) => (
              <div key={item.id} className="activity-row">
                <span>{relativeTime(item.createdAt)}</span>
                <p>{item.label}</p>
                <small>
                  {item.actorLogin
                    ? `@${item.actorLogin}`
                    : item.actorName ?? item.entityType}
                </small>
              </div>
            ))}
            {items.length === 0 && <p className="empty-state">Sin actividad reciente.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
