import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '@/services/twitch'
import { supabase } from '@/services/supabase'

/** Grupo Neura por defecto (override con VRCHAT_GROUP_ID). */
export const DEFAULT_VRCHAT_GROUP_ID =
  'grp_627b5237-b389-41eb-9eeb-c89233c8474c'

export const VRCHAT_GROUP_HOME_URL = (groupId = DEFAULT_VRCHAT_GROUP_ID) =>
  `https://vrchat.com/home/group/${groupId}`

/** Poll lento en Señal Pulse — no martillar API comunitaria. */
export const VRCHAT_POLL_INTERVAL_MS = 15 * 60 * 1000

export type VrchatConfigStatus = {
  configured: boolean
  hasUsername: boolean
  hasPassword: boolean
  hasAuthCookie: boolean
  hasPersistedCookie: boolean
  groupId: string
  groupUrl: string
  missingHint: string | null
}

export type VrchatGroupSnapshot = {
  id: number
  groupId: string
  name: string
  iconUrl: string | null
  memberCount: number
  onlineMemberCount: number
  shortCode: string | null
  discriminator: string | null
  syncedAt: string
}

export type VrchatGroupSyncResult = {
  ok: boolean
  needsTwoFactor: boolean
  twoFactorMethods: string[]
  snapshot: VrchatGroupSnapshot | null
  groupId: string
  message: string
}

export type VrchatGroupKpi = {
  groupId: string
  groupUrl: string
  name: string
  iconUrl: string | null
  memberCount: number
  onlineMemberCount: number
  memberDelta: number | null
  onlineDelta: number | null
  syncedAt: string | null
  configured: boolean | null
  missingHint: string | null
}

type DbRow = {
  id: number
  group_id: string
  name: string
  icon_url: string | null
  member_count: number
  online_member_count: number
  short_code: string | null
  discriminator: string | null
  synced_at: string
}

type RawSnapshot = {
  id: number
  groupId: string
  name: string
  iconUrl?: string | null
  memberCount: number
  onlineMemberCount: number
  shortCode?: string | null
  discriminator?: string | null
  syncedAt: string
}

function mapRaw(row: RawSnapshot): VrchatGroupSnapshot {
  return {
    id: row.id,
    groupId: row.groupId,
    name: row.name,
    iconUrl: row.iconUrl ?? null,
    memberCount: row.memberCount,
    onlineMemberCount: row.onlineMemberCount,
    shortCode: row.shortCode ?? null,
    discriminator: row.discriminator ?? null,
    syncedAt: row.syncedAt,
  }
}

function mapDb(row: DbRow): VrchatGroupSnapshot {
  return {
    id: row.id,
    groupId: row.group_id,
    name: row.name,
    iconUrl: row.icon_url,
    memberCount: row.member_count,
    onlineMemberCount: row.online_member_count,
    shortCode: row.short_code,
    discriminator: row.discriminator,
    syncedAt: row.synced_at,
  }
}

export async function fetchVrchatConfigStatus(): Promise<VrchatConfigStatus | null> {
  if (!isTauri) return null
  return invoke<VrchatConfigStatus>('vrchat_config_status')
}

export async function syncVrchatGroup(): Promise<VrchatGroupSyncResult> {
  if (!isTauri) {
    throw new Error('Sync VRChat requiere la app de escritorio (Tauri).')
  }
  return invoke<VrchatGroupSyncResult>('sync_vrchat_group')
}

export async function verifyVrchat2fa(
  code: string,
  method?: 'totp' | 'email',
): Promise<VrchatGroupSyncResult> {
  if (!isTauri) {
    throw new Error('2FA VRChat requiere la app de escritorio (Tauri).')
  }
  return invoke<VrchatGroupSyncResult>('verify_vrchat_2fa', {
    code,
    method: method ?? 'totp',
  })
}

/** Lectura desde Supabase (web o Tauri). */
export async function fetchVrchatGroupSnapshots(
  limit = 10,
  groupId = DEFAULT_VRCHAT_GROUP_ID,
): Promise<VrchatGroupSnapshot[]> {
  if (isTauri) {
    try {
      const rows = await invoke<RawSnapshot[]>('fetch_vrchat_group_snapshots', {
        limit,
      })
      return rows.map(mapRaw)
    } catch {
      /* fallback a Supabase anon */
    }
  }
  if (!supabase) return []
  const { data, error } = await supabase
    .from('vrchat_group_snapshots')
    .select(
      'id,group_id,name,icon_url,member_count,online_member_count,short_code,discriminator,synced_at',
    )
    .eq('group_id', groupId)
    .order('synced_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data as DbRow[] | null)?.map(mapDb) ?? []
}

export function buildVrchatGroupKpi(
  snapshots: VrchatGroupSnapshot[],
  config: VrchatConfigStatus | null,
): VrchatGroupKpi {
  const latest = snapshots[0] ?? null
  const prev = snapshots[1] ?? null
  const groupId = config?.groupId ?? latest?.groupId ?? DEFAULT_VRCHAT_GROUP_ID
  return {
    groupId,
    groupUrl: config?.groupUrl ?? VRCHAT_GROUP_HOME_URL(groupId),
    name: latest?.name ?? 'Grupo VRChat',
    iconUrl: latest?.iconUrl ?? null,
    memberCount: latest?.memberCount ?? 0,
    onlineMemberCount: latest?.onlineMemberCount ?? 0,
    memberDelta:
      latest && prev ? latest.memberCount - prev.memberCount : null,
    onlineDelta:
      latest && prev
        ? latest.onlineMemberCount - prev.onlineMemberCount
        : null,
    syncedAt: latest?.syncedAt ?? null,
    configured: config?.configured ?? null,
    missingHint: config?.missingHint ?? null,
  }
}

export function formatSignedDelta(delta: number | null): string {
  if (delta == null) return '—'
  if (delta > 0) return `+${delta.toLocaleString('es-MX')}`
  return delta.toLocaleString('es-MX')
}

export const VRCHAT_DISCLAIMER =
  'VRChat Groups · API comunitaria (no oficial). Sync lento; no martillar endpoints.'
