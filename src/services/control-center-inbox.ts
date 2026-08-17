import type { TaskRecord } from '@/services/tasks'
import type { DesignBrief } from '@/services/design-briefs'
import type { TalentManagerRecord } from '@/services/agency'
import type { TalentChannelGap } from '@/services/channel-gaps'
import type { NlEvent, NlTryout, NlVod } from '@/services/neuraleague/types'
import type { HelixStatus } from '@/stores/app-store'
import type { Talent } from '@/types'

export type InboxItemType =
  | 'task'
  | 'live_uncovered'
  | 'brief'
  | 'tryout'
  | 'design_gap'
  | 'nl_event'

export type InboxPriority = 'urgent' | 'high' | 'medium' | 'low'

export type InboxAction =
  | 'mark_done'
  | 'assign_role'
  | 'quick_brief'
  | 'discord'
  | 'open'
  | 'mark_resolved'
  | 'unmark_resolved'
  | 'mark_ignored'
  | 'unmark_ignored'

export type ControlInboxItem = {
  id: string
  type: InboxItemType
  title: string
  detail: string
  priority: InboxPriority
  href?: string
  taskId?: string
  talentLogin?: string
  resolved?: boolean
  ignored?: boolean
  actions: InboxAction[]
}

export type OpsAlertTone = 'critical' | 'warning'

export type OpsAlert = {
  id: string
  title: string
  detail: string
  tone: OpsAlertTone
  href?: string
}

const PRIORITY_RANK: Record<InboxPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

export const INBOX_TYPE_LABELS: Record<InboxItemType, string> = {
  task: 'Tarea',
  live_uncovered: 'Live',
  brief: 'Brief',
  tryout: 'Tryout',
  design_gap: 'Diseño',
  nl_event: 'NeuraLeague',
}

export const INBOX_PRIORITY_LABELS: Record<InboxPriority, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
}

function dayBounds(now: Date): { start: number; end: number; today: string } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const end = start + 24 * 60 * 60 * 1000 - 1
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
  return { start, end, today }
}

function taskPriority(task: TaskRecord, today: string): InboxPriority {
  if (task.priority === 'urgent') return 'urgent'
  if (task.dueDate && task.dueDate < today) return 'urgent'
  if (task.priority === 'high') return 'high'
  if (task.dueDate === today) return 'high'
  return 'medium'
}

/** Tareas abiertas vencidas o con vencimiento hoy. */
export function collectDueTasks(tasks: TaskRecord[], now = new Date()): ControlInboxItem[] {
  const { today } = dayBounds(now)
  return tasks
    .filter((t) => t.status !== 'done' && t.dueDate && t.dueDate <= today)
    .map((t) => {
      const overdue = t.dueDate! < today
      return {
        id: `task:${t.id}`,
        type: 'task' as const,
        title: t.title,
        detail: overdue ? `Vencida · ${t.dueDate}` : `Vence hoy · ${t.priority}`,
        priority: taskPriority(t, today),
        href: `/control/tareas?task=${t.id}`,
        taskId: t.id,
        actions: ['mark_done', 'discord', 'open'] as InboxAction[],
      }
    })
}

/**
 * Lives sin manager claro.
 * Si hay asignaciones manager↔talento, marca lives sin manager.
 * Si no hay ninguna asignación, marca todos los lives (cobertura poco clara).
 */
export function collectUncoveredLives(
  talents: Talent[],
  managers: TalentManagerRecord[],
): ControlInboxItem[] {
  const live = talents.filter((t) => t.isLive)
  if (live.length === 0) return []

  const hasAssignments = managers.length > 0
  const covered = new Set(managers.map((m) => m.talentLogin.toLowerCase()))

  return live
    .filter((t) => !hasAssignments || !covered.has(t.login.toLowerCase()))
    .map((t) => ({
      id: `live:${t.id}`,
      type: 'live_uncovered' as const,
      title: `${t.displayName} en directo`,
      detail: hasAssignments
        ? 'Sin manager asignado'
        : 'Sin mapa de cobertura manager↔talento',
      priority: 'urgent' as const,
      href: `/talento/${t.login}`,
      talentLogin: t.login,
      actions: ['discord', 'quick_brief', 'open'] as InboxAction[],
    }))
}

export function collectPendingBriefs(briefs: DesignBrief[]): ControlInboxItem[] {
  return briefs
    .filter((b) => b.status === 'draft' || b.status === 'ready')
    .map((b) => ({
      id: `brief:${b.id}`,
      type: 'brief' as const,
      title: b.title,
      detail: b.status === 'draft' ? 'Borrador pendiente' : 'Listo para diseño',
      priority: (b.status === 'ready' ? 'high' : 'medium') as InboxPriority,
      href: '/diseno/briefs',
      talentLogin: b.talentLogin,
      actions: ['quick_brief', 'discord', 'open'] as InboxAction[],
    }))
}

export function collectOpenTryouts(tryouts: NlTryout[]): ControlInboxItem[] {
  return tryouts
    .filter((t) => t.status === 'open')
    .map((t) => ({
      id: `tryout:${t.id}`,
      type: 'tryout' as const,
      title: t.title,
      detail: t.closesAt
        ? `Abierto · cierra ${new Date(t.closesAt).toLocaleDateString('es-MX')}`
        : 'Tryout abierto',
      priority: 'medium' as const,
      href: '/neuralleague/reclutamiento',
      actions: ['discord', 'open'] as InboxAction[],
    }))
}

/** Resumen por talento con huecos de assets (solo si missingCount > 0). */
export function collectDesignGaps(
  gaps: TalentChannelGap[],
  resolvedLogins: Set<string> = new Set(),
  ignoredLogins: Set<string> = new Set(),
  limit = 6,
): ControlInboxItem[] {
  const loginKey = (login: string) => login.toLowerCase()
  const isResolved = (g: TalentChannelGap) => resolvedLogins.has(loginKey(g.login))
  const isIgnored = (g: TalentChannelGap) => ignoredLogins.has(loginKey(g.login))

  const open = gaps.filter(
    (g) => g.missingCount > 0 && !isResolved(g) && !isIgnored(g),
  )
  const resolved = gaps.filter((g) => g.missingCount > 0 && isResolved(g))
  const ignored = gaps.filter(
    (g) => g.missingCount > 0 && isIgnored(g) && !isResolved(g),
  )

  const mapGap = (
    g: TalentChannelGap,
    state: 'open' | 'resolved' | 'ignored',
  ): ControlInboxItem => ({
    id: `gap:${g.login}`,
    type: 'design_gap' as const,
    title: `Huecos de diseño · ${g.displayName}`,
    detail:
      state === 'resolved'
        ? 'Marcado como resuelto · aún faltan assets en Drive'
        : state === 'ignored'
          ? 'Ignorado · sigue pendiente en Drive'
          : `${g.missingCount} asset${g.missingCount === 1 ? '' : 's'} faltante${g.missingCount === 1 ? '' : 's'}`,
    priority: (state === 'open'
      ? g.missingCount >= 3
        ? 'high'
        : 'medium'
      : 'low') as InboxPriority,
    href: '/diseno/huecos',
    talentLogin: g.login,
    resolved: state === 'resolved',
    ignored: state === 'ignored',
    actions:
      state === 'resolved'
        ? (['unmark_resolved', 'open'] as InboxAction[])
        : state === 'ignored'
          ? (['unmark_ignored', 'open'] as InboxAction[])
          : (['mark_resolved', 'mark_ignored', 'quick_brief', 'open'] as InboxAction[]),
  })

  return [
    ...open.slice(0, limit).map((g) => mapGap(g, 'open')),
    ...ignored.map((g) => mapGap(g, 'ignored')),
    ...resolved.map((g) => mapGap(g, 'resolved')),
  ]
}

/** Scrims / eventos NL del día (calendario local). */
export function collectTodayNlEvents(events: NlEvent[], now = new Date()): ControlInboxItem[] {
  const { start, end } = dayBounds(now)
  return events
    .filter((e) => {
      if (e.status === 'cancelled') return false
      const t = Date.parse(e.startsAt)
      return !Number.isNaN(t) && t >= start && t <= end
    })
    .map((e) => ({
      id: `nl:${e.id}`,
      type: 'nl_event' as const,
      title: e.title,
      detail: `${e.eventType} · ${new Date(e.startsAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`,
      priority: (e.status === 'live' ? 'high' : 'medium') as InboxPriority,
      href: '/neuralleague/calendario',
      actions: ['discord', 'open'] as InboxAction[],
    }))
}

export function buildControlInbox(input: {
  tasks: TaskRecord[]
  talents: Talent[]
  managers: TalentManagerRecord[]
  briefs: DesignBrief[]
  tryouts: NlTryout[]
  gaps: TalentChannelGap[]
  events: NlEvent[]
  resolvedGapLogins?: Set<string>
  ignoredGapLogins?: Set<string>
  now?: Date
}): ControlInboxItem[] {
  const now = input.now ?? new Date()
  const resolved = input.resolvedGapLogins ?? new Set<string>()
  const ignored = input.ignoredGapLogins ?? new Set<string>()
  const items = [
    ...collectDueTasks(input.tasks, now),
    ...collectUncoveredLives(input.talents, input.managers),
    ...collectPendingBriefs(input.briefs),
    ...collectOpenTryouts(input.tryouts),
    ...collectDesignGaps(input.gaps, resolved, ignored),
    ...collectTodayNlEvents(input.events, now),
  ]
  return items.sort((a, b) => {
    const rank = (item: ControlInboxItem) => {
      if (item.resolved) return 2
      if (item.ignored) return 1
      return 0
    }
    const ra = rank(a)
    const rb = rank(b)
    if (ra !== rb) return ra - rb
    return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.title.localeCompare(b.title, 'es')
  })
}

export function buildOpsAlerts(input: {
  helixStatus: HelixStatus
  talents: Talent[]
  events: NlEvent[]
  vods: NlVod[]
  /** Contratos / deals con fecha de fin ISO date (YYYY-MM-DD). */
  contractEnds?: Array<{ id: string; title: string; endsOn: string; href?: string }>
  /** Streams programados hoy (heurística suave de offline). */
  scheduledStreams?: Array<{ talentLogin: string; title: string; startsAt: string }>
  now?: Date
}): OpsAlert[] {
  const now = input.now ?? new Date()
  const alerts: OpsAlert[] = []

  if (input.helixStatus === 'error') {
    alerts.push({
      id: 'helix-error',
      title: 'Sync Twitch caído',
      detail: 'No estamos recibiendo datos públicos de Twitch. Revisa la conexión.',
      tone: 'critical',
      href: '/',
    })
  }

  const liveLogins = new Set(
    input.talents.filter((t) => t.isLive).map((t) => t.login.toLowerCase()),
  )
  for (const stream of input.scheduledStreams ?? []) {
    const start = Date.parse(stream.startsAt)
    if (Number.isNaN(start)) continue
    const minutesLate = (now.getTime() - start) / 60_000
    if (minutesLate < 20 || minutesLate > 180) continue
    if (liveLogins.has(stream.talentLogin.toLowerCase())) continue
    alerts.push({
      id: `offline:${stream.talentLogin}:${stream.startsAt}`,
      title: `Posible offline · @${stream.talentLogin}`,
      detail: `Tenía stream programado («${stream.title}») y aún no aparece en vivo.`,
      tone: 'warning',
      href: `/talento/${stream.talentLogin}`,
    })
  }

  const vodEventIds = new Set(
    input.vods.map((v) => v.eventId).filter((id): id is string => Boolean(id)),
  )
  for (const event of input.events) {
    if (event.eventType !== 'scrim' && event.eventType !== 'match') continue
    if (event.status !== 'done' && event.status !== 'live') continue
    if (vodEventIds.has(event.id)) continue
    alerts.push({
      id: `novod:${event.id}`,
      title: `Sin VOD · ${event.title}`,
      detail: `${event.eventType} sin grabación asociada en NeuraLeague.`,
      tone: 'warning',
      href: '/neuralleague/operacion',
    })
  }

  const { today } = dayBounds(now)
  const horizon = new Date(now)
  horizon.setDate(horizon.getDate() + 14)
  const horizonIso = [
    horizon.getFullYear(),
    String(horizon.getMonth() + 1).padStart(2, '0'),
    String(horizon.getDate()).padStart(2, '0'),
  ].join('-')

  for (const c of input.contractEnds ?? []) {
    if (!c.endsOn || c.endsOn < today || c.endsOn > horizonIso) continue
    alerts.push({
      id: `contract:${c.id}`,
      title: `Contrato por vencer · ${c.title}`,
      detail: `Termina el ${c.endsOn}`,
      tone: c.endsOn <= today ? 'critical' : 'warning',
      href: c.href ?? '/documentos',
    })
  }

  const order: Record<OpsAlertTone, number> = { critical: 0, warning: 1 }
  return alerts.sort((a, b) => order[a.tone] - order[b.tone] || a.title.localeCompare(b.title, 'es'))
}
