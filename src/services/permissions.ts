import type { AppRole } from '@/services/app-users'

export const MUTATE_ROLES: AppRole[] = ['owner', 'admin', 'manager', 'dev']
export const ADMIN_MUTATE_ROLES: AppRole[] = ['owner', 'admin', 'dev']

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
