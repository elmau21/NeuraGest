import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '@/services/twitch'

export type AppRole =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'staff'
  | 'dev'
  | 'designer'
  | 'league_manager'
  | 'coach'
  | 'analyst'
  | 'player'

export const ALL_APP_ROLES: AppRole[] = [
  'owner',
  'admin',
  'manager',
  'staff',
  'dev',
  'designer',
  'league_manager',
  'coach',
  'analyst',
  'player',
]
export const ADMIN_ROLES: AppRole[] = ['owner', 'dev']

export type AppUserRecord = {
  id: string
  twitchLogin: string
  displayName?: string
  avatarUrl?: string
  lastSeenAt: string
  roles: AppRole[]
}

export type EnsureAppUserResult = {
  id: string
  roles: AppRole[]
}

export function canAccessAdminPanel(login?: string | null, roles: AppRole[] = []): boolean {
  if (login?.toLowerCase() === 'maufuwari') return true
  return roles.some((role) => ADMIN_ROLES.includes(role))
}

export async function ensureAppUser(authUserId: string): Promise<EnsureAppUserResult> {
  if (!isTauri) throw new Error('La sincronización de usuarios requiere la app de escritorio.')
  return invoke<EnsureAppUserResult>('ensure_app_user', { authUserId })
}

export async function fetchMyRoles(): Promise<AppRole[]> {
  if (!isTauri) return []
  return invoke<AppRole[]>('fetch_my_roles')
}

export async function listAppUsers(): Promise<AppUserRecord[]> {
  if (!isTauri) throw new Error('La administración de permisos requiere la app de escritorio.')
  return invoke<AppUserRecord[]>('list_app_users')
}

export async function setAppUserRoles(
  targetUserId: string,
  roles: AppRole[],
  confirmProtected = false,
): Promise<AppRole[]> {
  if (!isTauri) throw new Error('La administración de permisos requiere la app de escritorio.')
  return invoke<AppRole[]>('set_app_user_roles', {
    targetUserId,
    roles,
    confirmProtected,
  })
}
