import type { AppRole } from '@/services/app-users'

export const MUTATE_ROLES: AppRole[] = ['owner', 'admin', 'manager', 'dev']
export const ADMIN_MUTATE_ROLES: AppRole[] = ['owner', 'admin', 'dev']

/** Roles con navegación completa (prioridad sobre `dev`). */
export const FULL_NAV_ROLES: AppRole[] = ['owner', 'admin', 'manager', 'staff']

/** Rutas de datos permitidas para un usuario solo-`dev`. */
export const DEV_ALLOWED_PATHS = [
  '/inteligencia',
  '/ciencia-datos',
  '/ml',
  '/estadisticas',
  '/analitica',
] as const

export const DEV_DEFAULT_PATH = '/inteligencia'

export function canMutate(roles: AppRole[], login?: string | null): boolean {
  if (login?.toLowerCase() === 'maufuwari') return true
  return roles.some((role) => MUTATE_ROLES.includes(role))
}

export function canMutateCrm(roles: AppRole[], login?: string | null): boolean {
  if (login?.toLowerCase() === 'maufuwari') return true
  return roles.some((role) => ADMIN_MUTATE_ROLES.includes(role))
}

export function canMutateWiki(roles: AppRole[], login?: string | null): boolean {
  return canMutate(roles, login)
}

export function isStaffReadOnly(roles: AppRole[], login?: string | null): boolean {
  return !canMutate(roles, login)
}

/** True si el usuario tiene un rol con menú completo (owner gana sobre dev). */
export function hasFullNavAccess(roles: AppRole[], login?: string | null): boolean {
  if (login?.toLowerCase() === 'maufuwari') return true
  return roles.some((role) => FULL_NAV_ROLES.includes(role))
}

/** Solo `dev` sin owner/admin/manager/staff → menú de datos restringido. */
export function isDevOnlyNav(roles: AppRole[], login?: string | null): boolean {
  if (hasFullNavAccess(roles, login)) return false
  return roles.includes('dev')
}

export function normalizeAppPath(pathname: string): string {
  if (!pathname) return '/'
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

export function canAccessPath(roles: AppRole[], pathname: string, login?: string | null): boolean {
  if (!isDevOnlyNav(roles, login)) return true
  const path = normalizeAppPath(pathname)
  return DEV_ALLOWED_PATHS.some(
    (allowed) => path === allowed || path.startsWith(`${allowed}/`),
  )
}

export function defaultPathForRoles(roles: AppRole[], login?: string | null): string {
  if (isDevOnlyNav(roles, login)) return DEV_DEFAULT_PATH
  return '/'
}
