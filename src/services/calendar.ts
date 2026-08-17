import { supabase } from '@/services/supabase'
import { DEFAULT_ORG_ID } from '@/services/org'
import { logActivity } from '@/services/activity-log'
import type { CalendarItem } from '@/types'

export type CalendarEventRecord = CalendarItem & {
  startsAt: string
  endsAt: string
  allDay?: boolean
  description?: string
}

export async function fetchCalendarEvents(): Promise<CalendarEventRecord[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('calendar_events')
    .select('id,title,description,event_type,starts_at,ends_at,all_day')
    .eq('organization_id', DEFAULT_ORG_ID)
    .is('deleted_at', null)
    .order('starts_at')
  return (data ?? []).map((row) => {
    const starts = new Date(row.starts_at)
    return {
      id: row.id,
      title: row.title,
      type: (row.event_type as CalendarItem['type']) ?? 'meeting',
      date: starts.toISOString().slice(0, 10),
      time: starts.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      allDay: row.all_day ?? false,
      description: row.description ?? undefined,
    }
  })
}

export async function createCalendarEvent(input: {
  title: string
  type: CalendarItem['type']
  startsAt: string
  endsAt: string
  description?: string
}): Promise<CalendarEventRecord | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('calendar_events')
    .insert({
      organization_id: DEFAULT_ORG_ID,
      title: input.title,
      event_type: input.type,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      description: input.description ?? null,
    })
    .select('id,title,description,event_type,starts_at,ends_at,all_day')
    .single()
  if (error || !data) return null
  await logActivity(
    'calendar',
    'created',
    { title: data.title, event_type: data.event_type },
    data.id,
  )
  const starts = new Date(data.starts_at)
  return {
    id: data.id,
    title: data.title,
    type: (data.event_type as CalendarItem['type']) ?? 'meeting',
    date: starts.toISOString().slice(0, 10),
    time: starts.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
    startsAt: data.starts_at,
    endsAt: data.ends_at,
    allDay: data.all_day ?? false,
    description: data.description ?? undefined,
  }
}

export type CalendarMutationResult = { ok: true } | { ok: false; error: string }

export async function deleteCalendarEvent(id: string): Promise<CalendarMutationResult> {
  if (!supabase) return { ok: false, error: 'La nube no está configurada' }
  const deletedAt = new Date().toISOString()
  const { data, error } = await supabase
    .from('calendar_events')
    .update({ deleted_at: deletedAt })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id,title')
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'No se pudo eliminar el evento (permisos o evento inexistente)' }
  await logActivity('calendar', 'deleted', { title: data.title, deleted_at: deletedAt }, id)
  return { ok: true }
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function formatIcsDate(iso: string): string {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '').replace('Z', 'Z')
}

export function buildIcsCalendar(events: CalendarEventRecord[], calendarName = 'NeuraGest'): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NeuraGest//Calendario//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
  ]
  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.id}@neuragest`,
      `DTSTAMP:${formatIcsDate(new Date().toISOString())}`,
      `DTSTART:${formatIcsDate(new Date(event.startsAt).toISOString())}`,
      `DTEND:${formatIcsDate(new Date(event.endsAt).toISOString())}`,
      `SUMMARY:${escapeIcs(event.title)}`,
      event.description ? `DESCRIPTION:${escapeIcs(event.description)}` : '',
      `CATEGORIES:${escapeIcs(event.type)}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.filter(Boolean).join('\r\n')
}

export function downloadIcs(events: CalendarEventRecord[], filename = 'neuragest-calendario.ics'): void {
  const blob = new Blob([buildIcsCalendar(events)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
