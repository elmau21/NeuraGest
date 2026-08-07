import { supabase } from '@/services/supabase'
import { DEFAULT_ORG_ID } from '@/services/org'
import type { ActivityItem } from '@/services/activity'
import { fetchActivity } from '@/services/activity'

export type AuditFilter = 'all' | 'roles' | 'contracts' | 'tasks'

const AUDIT_ENTITY_TYPES: Record<Exclude<AuditFilter, 'all'>, string[]> = {
  roles: ['role', 'permission'],
  contracts: ['document', 'contract'],
  tasks: ['task'],
}

export async function fetchAuditActivity(filter: AuditFilter = 'all', limit = 60): Promise<ActivityItem[]> {
  if (!supabase) return []
  if (filter === 'all') return fetchActivity(limit)

  const types = AUDIT_ENTITY_TYPES[filter]
  const { data } = await supabase
    .from('activity_logs')
    .select('id,entity_type,entity_id,action,metadata,created_at')
    .eq('organization_id', DEFAULT_ORG_ID)
    .in('entity_type', types)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data ?? []).map((row) => {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>
    return {
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id ?? undefined,
      action: row.action,
      metadata,
      createdAt: row.created_at ?? new Date().toISOString(),
      label: formatAuditLabel(row.entity_type, row.action, metadata),
    }
  })
}

function formatAuditLabel(entityType: string, action: string, meta: Record<string, unknown>): string {
  const title = meta.title ? String(meta.title) : ''
  switch (`${entityType}.${action}`) {
    case 'role.updated': return `Roles actualizados: ${meta.login ?? 'usuario'} → ${(meta.roles as string[] | undefined)?.join(', ') ?? ''}`
    case 'role.granted': return `Rol otorgado a ${meta.login ?? 'usuario'}: ${meta.role ?? ''}`
    case 'role.revoked': return `Rol revocado a ${meta.login ?? 'usuario'}: ${meta.role ?? ''}`
    case 'contract.viewed': return `Contrato consultado: ${title || meta.fileName || 'documento'}`
    case 'contract.downloaded': return `Contrato descargado: ${title || meta.fileName || 'documento'}`
    case 'document.contract_sync': return `Contrato sincronizado: ${meta.fileName ?? title}`
    case 'task.created': return `Tarea creada: ${title || 'sin título'}`
    case 'task.updated': return `Tarea actualizada${title ? `: ${title}` : ''}`
    case 'task.deleted': return `Tarea eliminada${title ? `: ${title}` : ''}`
    case 'task.commented': return `Comentario en tarea${meta.preview ? `: «${meta.preview}»` : ''}`
    case 'task.reassigned': return `Tarea reasignada: ${title || meta.taskId || ''}`
    default: return `${entityType} · ${action}`
  }
}

export async function logContractActivity(
  action: 'viewed' | 'downloaded',
  fileName: string,
  talentLogin?: string,
): Promise<void> {
  if (!supabase) return
  await supabase.rpc('log_activity', {
    p_entity_type: 'contract',
    p_entity_id: null,
    p_action: action,
    p_metadata: { fileName, talentLogin, title: fileName },
  })
}

export async function logRoleActivity(
  login: string,
  roles: string[],
  previousRoles?: string[],
): Promise<void> {
  if (!supabase) return
  await supabase.rpc('log_activity', {
    p_entity_type: 'role',
    p_entity_id: null,
    p_action: 'updated',
    p_metadata: { login, roles, previousRoles },
  })
}

export const AUDIT_FILTER_LABELS: Record<AuditFilter, string> = {
  all: 'Todo',
  roles: 'Roles / permisos',
  contracts: 'Contratos',
  tasks: 'Tareas',
}
