import { supabase, subscribeToActivity } from '@/services/supabase'
import { DEFAULT_ORG_ID } from '@/services/org'
import {
  formatActivityLabel,
  resolveActorLogin,
  resolveActorName,
  type ActivityActor,
} from '@/services/activity-format'
import { logActivity } from '@/services/activity-log'

export type ActivityItem = {
  id: number
  entityType: string
  entityId?: string
  action: string
  metadata: Record<string, unknown>
  createdAt: string
  label: string
  actorName?: string
  actorLogin?: string
}

type ActivityLogRow = {
  id: number
  entity_type: string
  entity_id: string | null
  action: string
  metadata: Record<string, unknown> | null
  created_at: string | null
  actor_id?: string | null
  actor?: ActivityActor
}

const ACTIVITY_SELECT =
  'id,entity_type,entity_id,action,metadata,created_at,actor_id,actor:users!activity_logs_actor_id_fkey(display_name)'

async function enrichActorsFromDirectory(
  rows: ActivityLogRow[],
): Promise<Map<string, ActivityActor>> {
  const directory = new Map<string, ActivityActor>()
  if (!supabase) return directory

  const ids = [...new Set(rows.map((row) => row.actor_id).filter((id): id is string => Boolean(id)))]
  if (ids.length === 0) return directory

  const { data, error } = await supabase.rpc('lookup_activity_actors', { p_ids: ids })
  if (error || !data) return directory

  for (const row of data as Array<{
    auth_user_id: string
    display_name: string | null
    twitch_login: string | null
  }>) {
    directory.set(row.auth_user_id, {
      display_name: row.display_name,
      twitch_login: row.twitch_login,
    })
  }
  return directory
}

export function mapActivityRows(
  rows: ActivityLogRow[],
  actorDirectory?: Map<string, ActivityActor>,
): ActivityItem[] {
  return rows.map((row) => {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>
    const fromDirectory = row.actor_id ? actorDirectory?.get(row.actor_id) : undefined
    const actor = fromDirectory ?? row.actor
    const actorName = resolveActorName(actor, metadata)
    const actorLogin = resolveActorLogin(actor, metadata)
    return {
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id ?? undefined,
      action: row.action,
      metadata,
      createdAt: row.created_at ?? new Date().toISOString(),
      actorName,
      actorLogin,
      label: formatActivityLabel(row.entity_type, row.action, metadata, actorName),
    }
  })
}

async function loadActivityRows(rows: ActivityLogRow[]): Promise<ActivityItem[]> {
  const directory = await enrichActorsFromDirectory(rows)
  return mapActivityRows(rows, directory)
}

export async function fetchActivity(limit = 40): Promise<ActivityItem[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('activity_logs')
    .select(ACTIVITY_SELECT)
    .eq('organization_id', DEFAULT_ORG_ID)
    .order('created_at', { ascending: false })
    .limit(limit)
  return loadActivityRows((data ?? []) as ActivityLogRow[])
}

export function watchActivity(onChange: () => void): () => void {
  let cleanup: (() => void) | undefined
  void subscribeToActivity(onChange).then((unsub) => {
    cleanup = unsub
  })
  return () => { cleanup?.() }
}

export async function logTalentLive(displayName: string, viewers: number, login: string): Promise<void> {
  await logActivity('talent', 'live', { displayName, viewers, login })
}

export { ACTIVITY_SELECT, loadActivityRows }
export type { ActivityLogRow }
