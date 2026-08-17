import { useEffect, useState } from 'react'
import { Download, Plus, Trash2, X } from '@/components/icons'
import {
  createCalendarEvent,
  deleteCalendarEvent,
  downloadIcs,
  fetchCalendarEvents,
  type CalendarEventRecord,
} from '@/services/calendar'
import { useAuthStore } from '@/stores/auth-store'
import { canMutate } from '@/services/permissions'
import { toastError, toastSuccess } from '@/stores/toast-store'
import type { CalendarItem } from '@/types'

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>
}

const EVENT_TYPE_LABELS: Record<CalendarItem['type'], string> = {
  stream: 'Stream',
  meeting: 'Reunión',
  delivery: 'Entrega',
  campaign: 'Campaña',
  tournament: 'Torneo',
}

function formatEventRange(event: CalendarEventRecord): string {
  const start = new Date(event.startsAt)
  const end = new Date(event.endsAt)
  const date = start.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  if (event.allDay) return `${date} · Todo el día`
  const time = `${start.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`
  return `${date} · ${time}`
}

export function CalendarPage() {
  const [events, setEvents] = useState<CalendarEventRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CalendarEventRecord | null>(null)
  const [deleting, setDeleting] = useState(false)
  const roles = useAuthStore((s) => s.roles)
  const session = useAuthStore((s) => s.session)
  const readonly = !canMutate(roles, session?.login)
  const now = new Date()
  const monthLabel = now.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  const days = Array.from({ length: 35 }, (_, index) => index - ((now.getDay() + 6) % 7))

  const load = () => void fetchCalendarEvents().then(setEvents).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const create = async () => {
    if (readonly) return
    const start = new Date()
    start.setHours(18, 0, 0, 0)
    const end = new Date(start)
    end.setHours(19, 0, 0, 0)
    const created = await createCalendarEvent({
      title: 'Nuevo evento',
      type: 'meeting',
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
    })
    if (created) {
      setEvents((current) => [...current, created].sort((a, b) => a.startsAt.localeCompare(b.startsAt)))
      toastSuccess('Evento creado')
    } else {
      toastError('No se pudo crear el evento')
    }
  }

  const removeSelected = async () => {
    if (readonly || !selected || deleting) return
    if (!window.confirm(`¿Eliminar el evento «${selected.title}»? Esta acción no se puede deshacer.`)) return
    setDeleting(true)
    const result = await deleteCalendarEvent(selected.id)
    setDeleting(false)
    if (!result.ok) {
      toastError(result.error)
      return
    }
    setEvents((current) => current.filter((event) => event.id !== selected.id))
    setSelected(null)
    toastSuccess('Evento eliminado')
  }

  return <>
    <div className="page-title">
      <div><h1>Calendario</h1><p>Streams, reuniones, entregas y campañas.</p></div>
      <div className="calendar-actions">
        <button className="secondary" onClick={() => downloadIcs(events)}><Download size={16}/>Exportar ICS</button>
        <button className="primary" disabled={readonly} onClick={() => void create()}><Plus size={16}/>Nuevo evento</button>
      </div>
    </div>
    {readonly && <p className="integration-note staff-readonly-banner">Modo staff: puedes ver el calendario pero no modificarlo.</p>}
    <Card>
      <div className="calendar-head"><h3>{monthLabel}</h3><div><button className="secondary active">Mes</button></div></div>
      {loading && <p className="empty-state calendar-empty">Cargando eventos…</p>}
      {!loading && events.length === 0 && <p className="empty-state calendar-empty">No hay eventos programados.</p>}
      <div className="calendar-grid">
        {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map((day) => <b key={day}>{day}</b>)}
        {days.map((offset, index) => {
          const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
          const dayNum = date.getDate()
          const inMonth = date.getMonth() === now.getMonth()
          const dayEvents = events.filter((event) => event.date === date.toISOString().slice(0, 10))
          return (
            <div className={`day ${inMonth ? '' : 'muted'}`} key={index}>
              <span>{dayNum}</span>
              {dayEvents.map((event) => (
                <button
                  type="button"
                  className={`event event-btn ${event.type} ${selected?.id === event.id ? 'selected' : ''}`}
                  key={event.id}
                  title={event.title}
                  onClick={() => setSelected(event)}
                >
                  {event.time} {event.title}
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </Card>

    {selected && (
      <div className="modal-backdrop" onClick={() => setSelected(null)}>
        <div className="agency-modal card" onClick={(event) => event.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h3>{selected.title}</h3>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--muted)' }}>{formatEventRange(selected)}</p>
            </div>
            <button type="button" className="secondary" onClick={() => setSelected(null)} aria-label="Cerrar">
              <X size={16}/>
            </button>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
            Tipo: {EVENT_TYPE_LABELS[selected.type] ?? selected.type}
          </p>
          {selected.description && (
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{selected.description}</p>
          )}
          <div className="agency-modal-actions">
            {!readonly && (
              <button
                type="button"
                className="secondary danger"
                disabled={deleting}
                onClick={() => void removeSelected()}
              >
                <Trash2 size={15}/>{deleting ? 'Eliminando…' : 'Eliminar evento'}
              </button>
            )}
            <button type="button" className="secondary" onClick={() => setSelected(null)}>Cerrar</button>
          </div>
        </div>
      </div>
    )}
  </>
}
