import type { StreamEvent } from '@/services/metrics'

export const COORDINATION_RAID = 'channel.raid'
export const COORDINATION_SHARED_PREFIX = 'channel.shared_chat'

export type RaidCoordItem = {
  kind: 'raid'
  id: string
  occurredAt: string
  talentLogin: string
  fromLogin: string
  fromName: string
  toLogin: string
  toName: string
  viewers: number | null
  /** Reciente (< 15 min) — destaque ops. */
  recent: boolean
}

export type SharedChatCoordItem = {
  kind: 'shared_chat'
  sessionId: string
  status: 'begin' | 'update' | 'end' | 'active'
  active: boolean
  startedAt: string
  updatedAt: string
  endedAt: string | null
  hostLogin: string | null
  hostName: string | null
  /** Logins de talento de cartera involucrados. */
  talentLogins: string[]
  participantLogins: string[]
  participantNames: string[]
  lastEventType: string
}

export type CoordinationWindowHours = 24 | 48

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function asViewers(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return Math.round(value)
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Math.max(0, Math.round(Number(value)))
  }
  return null
}

function payloadOf(ev: StreamEvent): Record<string, unknown> {
  return ev.payload && typeof ev.payload === 'object' ? ev.payload : {}
}

function isRecent(iso: string, nowMs: number, windowMs = 15 * 60_000): boolean {
  const ts = Date.parse(iso)
  if (!Number.isFinite(ts)) return false
  return nowMs - ts <= windowMs && nowMs - ts >= 0
}

export function isCoordinationEvent(eventType: string): boolean {
  return eventType === COORDINATION_RAID || eventType.startsWith(COORDINATION_SHARED_PREFIX)
}

export function filterCoordinationEvents(
  events: StreamEvent[],
  hours: CoordinationWindowHours,
  now = new Date(),
): StreamEvent[] {
  const since = now.getTime() - hours * 60 * 60_000
  return events.filter((ev) => {
    if (!isCoordinationEvent(ev.eventType)) return false
    const ts = Date.parse(ev.occurredAt)
    return Number.isFinite(ts) && ts >= since
  })
}

export function buildRaidItems(
  events: StreamEvent[],
  now = new Date(),
): RaidCoordItem[] {
  const nowMs = now.getTime()
  return events
    .filter((ev) => ev.eventType === COORDINATION_RAID)
    .map((ev) => {
      const p = payloadOf(ev)
      const fromLogin = asString(p.fromLogin) ?? '—'
      const toLogin = asString(p.toLogin) ?? ev.login
      return {
        kind: 'raid' as const,
        id: `raid-${ev.id}`,
        occurredAt: ev.occurredAt,
        talentLogin: ev.login.toLowerCase(),
        fromLogin,
        fromName: asString(p.fromName) ?? fromLogin,
        toLogin,
        toName: asString(p.toName) ?? toLogin,
        viewers: asViewers(p.viewers),
        recent: isRecent(ev.occurredAt, nowMs),
      }
    })
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
}

function sharedPhase(eventType: string): 'begin' | 'update' | 'end' | null {
  if (eventType.endsWith('.begin')) return 'begin'
  if (eventType.endsWith('.update')) return 'update'
  if (eventType.endsWith('.end')) return 'end'
  return null
}

export function buildSharedChatSessions(
  events: StreamEvent[],
): SharedChatCoordItem[] {
  const shared = events
    .filter((ev) => ev.eventType.startsWith(COORDINATION_SHARED_PREFIX))
    .slice()
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))

  type Acc = {
    sessionId: string
    startedAt: string
    updatedAt: string
    endedAt: string | null
    hostLogin: string | null
    hostName: string | null
    talentLogins: Set<string>
    participantLogins: Set<string>
    participantNames: Map<string, string>
    lastEventType: string
    status: 'begin' | 'update' | 'end'
  }

  const bySession = new Map<string, Acc>()

  for (const ev of shared) {
    const phase = sharedPhase(ev.eventType)
    if (!phase) continue
    const p = payloadOf(ev)
    const sessionId =
      asString(p.sessionId) ?? ev.streamId ?? `legacy-${ev.login.toLowerCase()}-${ev.id}`
    const existing = bySession.get(sessionId)
    const talentLogin = ev.login.toLowerCase()

    const participantRows = Array.isArray(p.participants) ? p.participants : []
    const nextParticipants = new Set(existing?.participantLogins ?? [])
    const nextNames = new Map(existing?.participantNames ?? [])
    for (const row of participantRows) {
      if (!row || typeof row !== 'object') continue
      const rec = row as Record<string, unknown>
      const login = asString(rec.login)?.toLowerCase()
      if (!login) continue
      nextParticipants.add(login)
      nextNames.set(login, asString(rec.name) ?? login)
    }
    if (nextParticipants.size === 0) {
      nextParticipants.add(talentLogin)
      nextNames.set(talentLogin, talentLogin)
    }

    const hostLogin = asString(p.hostLogin)?.toLowerCase() ?? existing?.hostLogin ?? null
    const hostName = asString(p.hostName) ?? existing?.hostName ?? hostLogin

    const talentLogins = new Set(existing?.talentLogins ?? [])
    talentLogins.add(talentLogin)

    if (!existing) {
      bySession.set(sessionId, {
        sessionId,
        startedAt: ev.occurredAt,
        updatedAt: ev.occurredAt,
        endedAt: phase === 'end' ? ev.occurredAt : null,
        hostLogin,
        hostName,
        talentLogins,
        participantLogins: nextParticipants,
        participantNames: nextNames,
        lastEventType: ev.eventType,
        status: phase,
      })
      continue
    }

    existing.updatedAt = ev.occurredAt
    existing.lastEventType = ev.eventType
    existing.status = phase
    existing.hostLogin = hostLogin
    existing.hostName = hostName
    existing.talentLogins = talentLogins
    existing.participantLogins = nextParticipants
    existing.participantNames = nextNames
    if (phase === 'end') existing.endedAt = ev.occurredAt
    if (phase === 'begin' && !existing.startedAt) existing.startedAt = ev.occurredAt
  }

  return [...bySession.values()]
    .map((row) => ({
      kind: 'shared_chat' as const,
      sessionId: row.sessionId,
      status: row.endedAt ? ('end' as const) : row.status === 'end' ? ('end' as const) : ('active' as const),
      active: !row.endedAt && row.status !== 'end',
      startedAt: row.startedAt,
      updatedAt: row.updatedAt,
      endedAt: row.endedAt,
      hostLogin: row.hostLogin,
      hostName: row.hostName,
      talentLogins: [...row.talentLogins].sort(),
      participantLogins: [...row.participantLogins].sort(),
      participantNames: [...row.participantLogins]
        .sort()
        .map((login) => row.participantNames.get(login) ?? login),
      lastEventType: row.lastEventType,
    }))
    .sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1
      return b.updatedAt.localeCompare(a.updatedAt)
    })
}

export function matchesTalentFilter(
  item: RaidCoordItem | SharedChatCoordItem,
  talentLogin: string | null,
): boolean {
  if (!talentLogin) return true
  const key = talentLogin.toLowerCase()
  if (item.kind === 'raid') {
    return (
      item.talentLogin === key ||
      item.toLogin.toLowerCase() === key ||
      item.fromLogin.toLowerCase() === key
    )
  }
  return item.talentLogins.includes(key) || item.participantLogins.includes(key)
}
