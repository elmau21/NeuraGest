import type { AppRole } from '@/services/app-users'
import { ROLE_MANAGER_ROLES } from '@/services/app-users'

export const MUTATE_ROLES: AppRole[] = ['owner', 'admin', 'manager', 'assistant', 'dev']
export const ADMIN_MUTATE_ROLES: AppRole[] = ['owner', 'admin', 'dev']
export const DESIGN_MUTATE_ROLES: AppRole[] = ['owner', 'admin', 'manager', 'assistant', 'dev', 'designer']
export const LEAGUE_ROLES: AppRole[] = ['league_manager', 'coach', 'analyst', 'player']
export const LEAGUE_MUTATE_ROLES: AppRole[] = [
  'owner',
  'admin',
  'manager',
  'assistant',
  'league_manager',
  'coach',
  'analyst',
]

/** Roles con navegación completa (prioridad sobre roles restringidos). */
export const FULL_NAV_ROLES: AppRole[] = ['owner', 'admin', 'manager', 'staff', 'assistant']

/** Quién ve el item «Centro de control» en el sidebar. */
export const CONTROL_CENTER_ROLES: AppRole[] = ['owner', 'admin', 'manager', 'assistant']

export const CONTROL_CENTER_PATH = '/control'
export const CONTROL_CENTER_ALIAS_PATH = '/asistente'

/** Rutas del bloque «Datos» (sidebar + guard de URL). */
export const DATOS_PATHS = [
  '/inteligencia',
  '/ciencia-datos',
  '/ml',
  '/estadisticas',
  '/analitica',
  '/auditoria',
] as const

/** Quién ve la categoría Datos en el sidebar. */
export const DATOS_NAV_ROLES: AppRole[] = ['owner', 'dev', 'assistant']

/** Rutas de datos permitidas para un usuario solo-`dev`. */
export const DEV_ALLOWED_PATHS = [
  '/inteligencia',
  '/ciencia-datos',
  '/ml',
  '/estadisticas',
  '/analitica',
] as const

export const DEV_DEFAULT_PATH = '/inteligencia'

/** Rutas permitidas para un usuario solo-`designer`. */
export const DESIGNER_ALLOWED_PATHS = [
  '/war-room',
  '/diseno',
] as const

export const DESIGNER_DEFAULT_PATH = '/war-room'

/** Rutas permitidas para roles solo-liga: NeuraLeague + War Room + ajustes básicos. */
export const LEAGUE_ALLOWED_PATHS = ['/neuralleague', '/war-room', '/ajustes'] as const

export const LEAGUE_DEFAULT_PATH = '/war-room'

export function canMutate(roles: AppRole[], login?: string | null): boolean {
  if (login?.toLowerCase() === 'maufuwari') return true
  return roles.some((role) => MUTATE_ROLES.includes(role))
}

/** Mutaciones solo-admin/owner (secretos Helix, CRM crítico, etc.). */
export function canAdminMutate(roles: AppRole[], login?: string | null): boolean {
  if (login?.toLowerCase() === 'maufuwari') return true
  return roles.some((role) => ADMIN_MUTATE_ROLES.includes(role))
}

/** Crear carpetas en Document Drive (/documentos). Director de esports → rol `league_manager` (Manager Liga). */
export const DOCUMENT_DRIVE_FOLDER_ROLES: AppRole[] = ['owner', 'assistant', 'league_manager']

export function canCreateDocumentDriveFolder(roles: AppRole[], login?: string | null): boolean {
  if (login?.toLowerCase() === 'maufuwari') return true
  return roles.some((role) => DOCUMENT_DRIVE_FOLDER_ROLES.includes(role))
}

/** Lectura de Contratos en Document Drive (datos sensibles; no admin/dev). */
export const CONTRATOS_ACCESS_ROLES: AppRole[] = DOCUMENT_DRIVE_FOLDER_ROLES

export function canAccessContratos(roles: AppRole[], login?: string | null): boolean {
  if (login?.toLowerCase() === 'maufuwari') return true
  return roles.some((role) => CONTRATOS_ACCESS_ROLES.includes(role))
}

/** Escritura en Drive creativo, briefs y huecos de canal. */
export function canMutateDesign(roles: AppRole[], login?: string | null): boolean {
  if (login?.toLowerCase() === 'maufuwari') return true
  return roles.some((role) => DESIGN_MUTATE_ROLES.includes(role))
}

/** Escritura en NeuraLeague (estructura, stats, VODs, reclutamiento, operación). */
export function canMutateLeague(roles: AppRole[], login?: string | null): boolean {
  if (login?.toLowerCase() === 'maufuwari') return true
  return roles.some((role) => LEAGUE_MUTATE_ROLES.includes(role))
}

export function canMutateCrm(roles: AppRole[], login?: string | null): boolean {
  return canAdminMutate(roles, login)
}

export function canMutateWiki(roles: AppRole[], login?: string | null): boolean {
  return canMutate(roles, login)
}

export function isStaffReadOnly(roles: AppRole[], login?: string | null): boolean {
  return !canMutate(roles, login)
}

export function hasAnyLeagueRole(roles: AppRole[]): boolean {
  return roles.some((role) => LEAGUE_ROLES.includes(role))
}

/** True si el usuario tiene un rol con menú completo (owner gana sobre dev/designer/liga). */
export function hasFullNavAccess(roles: AppRole[], login?: string | null): boolean {
  if (login?.toLowerCase() === 'maufuwari') return true
  return roles.some((role) => FULL_NAV_ROLES.includes(role))
}

export function canAccessControlCenter(roles: AppRole[], login?: string | null): boolean {
  if (login?.toLowerCase() === 'maufuwari') return true
  return roles.some((role) => CONTROL_CENTER_ROLES.includes(role))
}

/** Roles fuertes: no gestionables por assistant (solo owner/dev). */
export const STRONG_APP_ROLES: AppRole[] = ['owner', 'dev']

/** Panel de permisos / listado de usuarios (owner, dev, assistant). */
export function canManageAppRoles(roles: AppRole[], login?: string | null): boolean {
  if (login?.toLowerCase() === 'maufuwari') return true
  return roles.some((role) => ROLE_MANAGER_ROLES.includes(role))
}

/**
 * Privilegio fuerte: ver/gestionar chips Owner/Dev.
 * Assistant puede gestionar roles operativos, pero no estos.
 */
export function canAssignStrongRoles(roles: AppRole[], login?: string | null): boolean {
  if (login?.toLowerCase() === 'maufuwari') return true
  return roles.includes('owner') || roles.includes('dev')
}

/** Solo un owner (o MauFuwari) puede asignar/quitar el rol owner. */
export function canAssignOwnerRole(roles: AppRole[], login?: string | null): boolean {
  if (login?.toLowerCase() === 'maufuwari') return true
  return roles.includes('owner')
}

/** Owner o dev (o MauFuwari) pueden asignar/quitar el rol dev. */
export function canAssignDevRole(roles: AppRole[], login?: string | null): boolean {
  return canAssignStrongRoles(roles, login)
}

/** Solo `dev` sin owner/admin/manager/staff/assistant → menú de datos restringido. */
export function isDevOnlyNav(roles: AppRole[], login?: string | null): boolean {
  if (hasFullNavAccess(roles, login)) return false
  return roles.includes('dev') && !roles.includes('designer') && !hasAnyLeagueRole(roles)
}

/** Solo `designer` sin roles de menú completo → War Room + Diseño. */
export function isDesignerOnlyNav(roles: AppRole[], login?: string | null): boolean {
  if (hasFullNavAccess(roles, login)) return false
  return roles.includes('designer') && !roles.includes('dev') && !hasAnyLeagueRole(roles)
}

/** Solo roles de liga sin menú completo → NeuraLeague + War Room + ajustes básicos. */
export function isLeagueOnlyNav(roles: AppRole[], login?: string | null): boolean {
  if (hasFullNavAccess(roles, login)) return false
  return hasAnyLeagueRole(roles) && !roles.includes('dev') && !roles.includes('designer')
}

/**
 * Preferencias personales (alertas Windows, Discord presence, sonido).
 * Owner/admin/manager/dev mutan todo; roles solo-liga (o liga sin menú completo) solo lo básico.
 */
export function canEditPersonalSettings(roles: AppRole[], login?: string | null): boolean {
  if (canMutate(roles, login)) return true
  if (hasFullNavAccess(roles, login)) return false
  return hasAnyLeagueRole(roles)
}

/** True si Ajustes debe mostrar solo el subset personal (sin Helix, permisos, etc.). */
export function isBasicSettingsOnly(roles: AppRole[], login?: string | null): boolean {
  if (hasFullNavAccess(roles, login)) return false
  return hasAnyLeagueRole(roles)
}

/** Nav restringida (dev / designer / liga sin roles de menú completo). */
export function isRestrictedNav(roles: AppRole[], login?: string | null): boolean {
  if (hasFullNavAccess(roles, login)) return false
  return roles.includes('dev') || roles.includes('designer') || hasAnyLeagueRole(roles)
}

/** Usuario autenticado sin ningún rol asignado en la app. */
export function isNoRoleUser(roles: AppRole[], login?: string | null): boolean {
  if (login?.toLowerCase() === 'maufuwari') return false
  return roles.length === 0
}

export function hasAppAccess(roles: AppRole[], login?: string | null): boolean {
  return !isNoRoleUser(roles, login)
}

export function isDatosPath(pathname: string): boolean {
  const path = normalizeAppPath(pathname)
  return DATOS_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

export function canAccessDatosNav(roles: AppRole[], login?: string | null): boolean {
  if (login?.toLowerCase() === 'maufuwari') return true
  return roles.some((role) => DATOS_NAV_ROLES.includes(role))
}

export function normalizeAppPath(pathname: string): string {
  if (!pathname) return '/'
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

function pathAllowed(path: string, allowed: readonly string[]): boolean {
  return allowed.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

export function canAccessPath(roles: AppRole[], pathname: string, login?: string | null): boolean {
  const path = normalizeAppPath(pathname)
  if (isNoRoleUser(roles, login)) return path === '/'
  if (isDatosPath(path) && !canAccessDatosNav(roles, login)) return false
  if (path === CONTROL_CENTER_PATH || path === CONTROL_CENTER_ALIAS_PATH || path.startsWith(`${CONTROL_CENTER_PATH}/`)) {
    return canAccessControlCenter(roles, login)
  }
  if (hasFullNavAccess(roles, login)) return true
  if (!isRestrictedNav(roles, login)) return true

  const allowed: string[] = []
  if (roles.includes('designer')) allowed.push(...DESIGNER_ALLOWED_PATHS)
  if (roles.includes('dev')) allowed.push(...DEV_ALLOWED_PATHS)
  if (hasAnyLeagueRole(roles)) allowed.push(...LEAGUE_ALLOWED_PATHS)
  return pathAllowed(path, allowed)
}

export function defaultPathForRoles(roles: AppRole[], login?: string | null): string {
  if (login?.toLowerCase() === 'maufuwari') return '/'
  if (roles.includes('assistant') && !roles.includes('owner')) return CONTROL_CENTER_PATH
  if (hasFullNavAccess(roles, login)) return '/'
  if (roles.includes('designer')) return DESIGNER_DEFAULT_PATH
  if (hasAnyLeagueRole(roles)) return LEAGUE_DEFAULT_PATH
  if (roles.includes('dev')) return DEV_DEFAULT_PATH
  return '/'
}
