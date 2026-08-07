import { useEffect, useState } from 'react'
import { Download, Plus } from 'lucide-react'
import {
  createCalendarEvent,
  downloadIcs,
  fetchCalendarEvents,
  type CalendarEventRecord,
} from '@/services/calendar'
import { useAuthStore } from '@/stores/auth-store'
import { canMutate } from '@/services/permissions'

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>
}

export function CalendarPage() {
  const [events, setEvents] = useState<CalendarEventRecord[]>([])
  const [loading, setLoading] = useState(true)
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
    if (created) setEvents((current) => [...current, created].sort((a, b) => a.startsAt.localeCompare(b.startsAt)))
  }

  return <>
    <div className="page-title">
      <div><h1>Calendario</h1><p>Streams, reuniones, entregas y campañas.</p></div>
      <div className="calendar-actions">
        <button className="secondary" onClick={() => downloadIcs(events)}><Download size={16}/>Exportar ICS</button>
        <button className="primary" disabled={readonly} onClick={() => void create()}><Plus size={16}/>Nuevo evento</button>
      </div>
    </div>
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
                <small className={`event ${event.type}`} key={event.id}>{event.time} {event.title}</small>
              ))}
            </div>
          )
        })}
      </div>
    </Card>
  </>
}
