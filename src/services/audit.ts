import { logActivity } from '@/services/activity-log'
import { supabase } from '@/services/supabase'
import { DEFAULT_ORG_ID } from '@/services/org'
import {
  ACTIVITY_SELECT,
  fetchActivity,
  loadActivityRows,
  type ActivityItem,
  type ActivityLogRow,
} from '@/services/activity'
import type { AppRole } from '@/services/app-users'

export type AuditFilter =
  | 'all'
  | 'roles'
  | 'contracts'
  | 'tasks'
  | 'wiki'
  | 'crm'
  | 'session'
  | 'ops'

export type ContractActivityAction = 'viewed' | 'downloaded' | 'deleted' | 'uploaded'

const AUDIT_ENTITY_TYPES: Record<Exclude<AuditFilter, 'all'>, string[]> = {
  roles: ['role', 'permission'],
  contracts: ['contract'],
  tasks: ['task'],
  wiki: ['wiki', 'document'],
  crm: ['crm', 'brief', 'rate_card', 'asset'],
  session: ['session'],
  ops: ['handoff', 'calendar', 'template', 'talent'],
}

/** Auditoría visible para roles operativos (no `dev`: solo datos/ML). */
export function canViewAudit(roles: AppRole[]): boolean {
  return roles.some((role) =>
    role === 'owner' || role === 'admin' || role === 'manager',
  )
}

export async function fetchAuditActivity(filter: AuditFilter = 'all', limit = 60): Promise<ActivityItem[]> {
  if (!supabase) return []
  if (filter === 'all') return fetchActivity(limit)

  if (filter === 'wiki') {
    const { data } = await supabase
      .from('activity_logs')
      .select(ACTIVITY_SELECT)
      .eq('organization_id', DEFAULT_ORG_ID)
      .or('entity_type.eq.wiki,and(entity_type.eq.document,action.like.wiki_%)')
      .order('created_at', { ascending: false })
      .limit(limit)
    return loadActivityRows((data ?? []) as ActivityLogRow[])
  }

  const types = AUDIT_ENTITY_TYPES[filter]
  const { data } = await supabase
    .from('activity_logs')
    .select(ACTIVITY_SELECT)
    .eq('organization_id', DEFAULT_ORG_ID)
    .in('entity_type', types)
    .order('created_at', { ascending: false })
    .limit(limit)

  return loadActivityRows((data ?? []) as ActivityLogRow[])
}

export async function logContractActivity(
  action: ContractActivityAction,
  fileName: string,
  talentLogin?: string,
): Promise<void> {
  await logActivity('contract', action, {
    fileName,
    talentLogin,
    title: fileName,
  })
}

export async function logRoleActivity(
  login: string,
  roles: string[],
  previousRoles?: string[],
): Promise<void> {
  await logActivity('role', 'updated', { login, roles, previousRoles })
}

export async function logAuthActivity(action: 'login' | 'logout'): Promise<void> {
  await logActivity('session', action)
}

export async function logCrmDealActivity(
  action: 'saved' | 'deleted',
  brandName: string,
  entityId?: string,
): Promise<void> {
  await logActivity('crm', action, { title: brandName, brandName }, entityId ?? null)
}

export async function logBriefActivity(
  action: 'created' | 'updated' | 'deleted',
  title: string,
  entityId?: string,
): Promise<void> {
  await logActivity('brief', action, { title }, entityId ?? null)
}

export async function logRateCardActivity(
  action: 'created' | 'updated' | 'deleted',
  label: string,
  entityId?: string,
): Promise<void> {
  await logActivity('rate_card', action, { title: label, label }, entityId ?? null)
}

export async function logAssetActivity(
  action: 'created' | 'deleted',
  title: string,
  entityId?: string,
): Promise<void> {
  await logActivity('asset', action, { title }, entityId ?? null)
}

export async function logHandoffActivity(
  action: 'created' | 'updated',
  meta: { status?: string; talentLogin?: string },
  entityId?: string,
): Promise<void> {
  await logActivity('handoff', action, meta, entityId ?? null)
}

export const AUDIT_FILTER_LABELS: Record<AuditFilter, string> = {
  all: 'Todo',
  roles: 'Roles / permisos',
  contracts: 'Contratos',
  tasks: 'Tareas',
  wiki: 'Wiki',
  crm: 'CRM / campañas',
  session: 'Sesiones',
  ops: 'Ops / calendario',
}
