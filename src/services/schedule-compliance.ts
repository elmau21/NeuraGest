import type { CalendarEventOps } from '@/services/ops'
import type { StreamEvent } from '@/services/metrics'

export type ScheduleComplianceRow = {
  id: string
  talentLogin: string
  title: string
  scheduledAt?: string
  actualAt?: string
  status: 'on_time' | 'missed' | 'unscheduled' | 'early' | 'late'
  deltaMinutes?: number
  detail: string
}

const STREAM_TYPES = new Set(['stream', 'tournament', 'campaign'])

function minutesDiff(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / 60_000)
}

function sameDay(a: Date, b: Date) {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10)
}

export function buildScheduleCompliance(
  calendarEvents: CalendarEventOps[],
  streamEvents: StreamEvent[],
  loginsByTalentId: Record<string, string>,
  windowDays = 14,
): ScheduleComplianceRow[] {
  const since = Date.now() - windowDays * 86_400_000
  const scheduled = calendarEvents.filter(
    (e) => STREAM_TYPES.has(e.eventType) && new Date(e.startsAt).getTime() >= since,
  )
  const onlineEvents = streamEvents.filter(
    (e) => e.eventType === 'stream.online' && new Date(e.occurredAt).getTime() >= since,
  )

  const rows: ScheduleComplianceRow[] = []
  const matchedOnline = new Set<number>()

  for (const event of scheduled) {
    const login = event.talentLogin ?? (event.talentId ? loginsByTalentId[event.talentId] : undefined) ?? '—'
    const scheduledAt = new Date(event.startsAt)
    const candidates = onlineEvents
      .map((stream, index) => ({ stream, index }))
      .filter(({ stream }) =>
        (event.talentLogin ? stream.login === event.talentLogin : true)
        && sameDay(scheduledAt, new Date(stream.occurredAt)),
      )
      .sort(
        (a, b) =>
          Math.abs(minutesDiff(scheduledAt, new Date(a.stream.occurredAt)))
          - Math.abs(minutesDiff(scheduledAt, new Date(b.stream.occurredAt))),
      )

    const match = candidates[0]
    if (!match) {
      const ended = scheduledAt.getTime() < Date.now() - 2 * 3_600_000
      rows.push({
        id: event.id,
        talentLogin: login,
        title: event.title,
        scheduledAt: event.startsAt,
        status: ended ? 'missed' : 'missed',
        detail: ended
          ? 'Programado pero sin inicio de transmisión registrado.'
          : 'Aún no hay señal online para este slot.',
      })
      continue
    }

    matchedOnline.add(match.index)
    const actualAt = match.stream.occurredAt
    const delta = minutesDiff(new Date(actualAt), scheduledAt)
    let status: ScheduleComplianceRow['status'] = 'on_time'
    if (Math.abs(delta) <= 15) status = 'on_time'
    else if (delta < -15) status = 'early'
    else status = 'late'

    rows.push({
      id: event.id,
      talentLogin: login,
      title: event.title,
      scheduledAt: event.startsAt,
      actualAt,
      status,
      deltaMinutes: delta,
      detail: status === 'on_time'
        ? `Inicio alineado (±${Math.abs(delta)} min).`
        : status === 'early'
          ? `Empezó ${Math.abs(delta)} min antes de lo planeado.`
          : `Empezó ${delta} min tarde.`,
    })
  }

  for (const { stream, index } of onlineEvents.map((stream, index) => ({ stream, index }))) {
    if (matchedOnline.has(index)) continue
    rows.push({
      id: `unscheduled-${stream.id}`,
      talentLogin: stream.login,
      title: stream.title ?? 'Stream sin título',
      actualAt: stream.occurredAt,
      status: 'unscheduled',
      detail: 'Stream real detectado sin evento de calendario.',
    })
  }

  const order = { missed: 0, late: 1, unscheduled: 2, early: 3, on_time: 4 }
  return rows.sort((a, b) => order[a.status] - order[b.status])
}

export const COMPLIANCE_STATUS_LABELS: Record<ScheduleComplianceRow['status'], string> = {
  on_time: 'A tiempo',
  early: 'Anticipado',
  late: 'Tarde',
  missed: 'No realizado',
  unscheduled: 'Sin programar',
}

export function complianceSummary(rows: ScheduleComplianceRow[]) {
  const total = rows.length || 1
  const onTime = rows.filter((r) => r.status === 'on_time').length
  const missed = rows.filter((r) => r.status === 'missed').length
  const unscheduled = rows.filter((r) => r.status === 'unscheduled').length
  return {
    compliancePct: Math.round((onTime / total) * 100),
    onTime,
    missed,
    unscheduled,
    total: rows.length,
  }
}
