import { supabase } from '@/services/supabase'
import { DEFAULT_ORG_ID } from '@/services/org'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type OrgPresenceUser = {
  userId: string
  login: string
  displayName: string
  avatarUrl: string
  path?: string
  lastSeen: string
}

export type OrgPresenceTrackInput = {
  userId: string
  login: string
  displayName: string
  avatarUrl: string
  path?: string
}

type PresencePayload = {
  userId?: string
  login?: string
  displayName?: string
  avatarUrl?: string
  path?: string
  lastSeen?: string
}

const CHANNEL_PREFIX = 'neuragest-presence'

let channel: RealtimeChannel | null = null
let trackedKey: string | null = null
const listeners = new Set<(users: OrgPresenceUser[]) => void>()

function channelName(orgId = DEFAULT_ORG_ID) {
  return `${CHANNEL_PREFIX}:${orgId}`
}

function flattenPresence(state: Record<string, PresencePayload[]>): OrgPresenceUser[] {
  const byUser = new Map<string, OrgPresenceUser>()
  for (const metas of Object.values(state)) {
    for (const meta of metas) {
      const userId = meta.userId?.trim()
      if (!userId) continue
      const lastSeen = meta.lastSeen ?? new Date().toISOString()
      const prev = byUser.get(userId)
      if (prev && prev.lastSeen > lastSeen) continue
      byUser.set(userId, {
        userId,
        login: meta.login?.trim() || 'usuario',
        displayName: meta.displayName?.trim() || meta.login?.trim() || 'Usuario',
        avatarUrl: meta.avatarUrl ?? '',
        path: meta.path,
        lastSeen,
      })
    }
  }
  return [...byUser.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, 'es'),
  )
}

function emitPresence() {
  if (!channel) {
    for (const listener of listeners) listener([])
    return
  }
  const users = flattenPresence(channel.presenceState() as Record<string, PresencePayload[]>)
  for (const listener of listeners) listener(users)
}

export function subscribeOrgPresence(onChange: (users: OrgPresenceUser[]) => void): () => void {
  listeners.add(onChange)
  if (channel) onChange(flattenPresence(channel.presenceState() as Record<string, PresencePayload[]>))
  else onChange([])
  return () => { listeners.delete(onChange) }
}

export async function trackOrgPresence(input: OrgPresenceTrackInput): Promise<void> {
  if (!supabase || !input.userId) return

  const name = channelName()
  if (!channel) {
    channel = supabase.channel(name, {
      config: {
        private: true,
        presence: { key: input.userId },
      },
    })
    channel
      .on('presence', { event: 'sync' }, emitPresence)
      .on('presence', { event: 'join' }, emitPresence)
      .on('presence', { event: 'leave' }, emitPresence)

    await new Promise<void>((resolve, reject) => {
      channel!.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') resolve()
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reject(err ?? new Error(`Presence: ${status}`))
        }
      })
    })
  }

  const payload: PresencePayload = {
    userId: input.userId,
    login: input.login,
    displayName: input.displayName,
    avatarUrl: input.avatarUrl,
    path: input.path,
    lastSeen: new Date().toISOString(),
  }
  const key = `${input.userId}|${input.path ?? ''}|${input.displayName}`
  if (key === trackedKey) {
    await channel.track(payload)
    return
  }
  trackedKey = key
  await channel.track(payload)
  emitPresence()
}

export async function clearOrgPresence(): Promise<void> {
  trackedKey = null
  if (!channel || !supabase) return
  const current = channel
  channel = null
  try {
    await current.untrack()
  } catch {
    /* ignore */
  }
  try {
    await supabase.removeChannel(current)
  } catch {
    /* ignore */
  }
  emitPresence()
}
