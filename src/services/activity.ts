import { supabase, subscribeToActivity } from '@/services/supabase'
import { DEFAULT_ORG_ID } from '@/services/org'

export type ActivityItem = {
  id: number
  entityType: string
  entityId?: string
  action: string
  metadata: Record<string, unknown>
  createdAt: string
  label: string
}

function formatLabel(item: {
  entity_type: string
  action: string
  metadata: Record<string, unknown> | null
}): string {
  const meta = item.metadata ?? {}
  const title = meta.title ? String(meta.title) : ''
  switch (`${item.entity_type}.${item.action}`) {
    case 'task.created': return `Nueva tarea: ${title || 'sin título'}`
    case 'task.updated': return `Tarea actualizada${title ? `: ${title}` : ''}`
    case 'task.commented': return `Comentario en tarea${meta.preview ? `: «${meta.preview}»` : ''}`
    case 'document.wiki_created': return `Wiki creada: ${title}`
    case 'calendar.created': return `Evento: ${title || meta.event_type || 'calendario'}`
    case 'template.applied': return `Plantilla aplicada: ${meta.template || 'operaciones'}`
    case 'role.updated': return `Roles actualizados para ${meta.login || 'usuario'}`
    case 'role.granted': return `Rol otorgado: ${meta.login || 'usuario'}`
    case 'role.revoked': return `Rol revocado: ${meta.login || 'usuario'}`
    case 'contract.viewed': return `Contrato consultado: ${meta.fileName || title || 'documento'}`
    case 'contract.downloaded': return `Contrato descargado: ${meta.fileName || title || 'documento'}`
    case 'document.contract_sync': return `Contrato sincronizado: ${meta.fileName ?? title}`
    case 'rate_card.created': return `Rate card: ${title || meta.label || 'tarifa nueva'}`
    case 'rate_card.updated': return `Rate card actualizada: ${title || meta.label || ''}`
    case 'brief.created': return `Brief creado: ${title || meta.brandName || 'campaña'}`
    case 'brief.updated': return `Brief actualizado: ${title || ''}`
    case 'asset.created': return `Asset subido: ${title || 'archivo'}`
    case 'asset.updated': return `Asset actualizado: ${title || ''}`
    case 'handoff.created': return `Handoff de turno registrado`
    case 'handoff.updated': return `Handoff ${meta.status || 'actualizado'}`
    case 'task.deleted': return `Tarea eliminada${title ? `: ${title}` : ''}`
    case 'talent.live': return `${meta.displayName || 'Talento'} en vivo · ${meta.viewers ?? 0} viewers`
    case 'ml.anomaly_detected': return `ML anomalía · ${meta.displayName || 'talento'} (${meta.direction}) z=${meta.zScore ?? '?'}`
    case 'ml.regime_change': return `ML cambio régimen · ${meta.displayName || 'talento'} (${meta.direction})`
    case 'ml.risk_task_created': return `Tarea ML creada: ${meta.title || 'seguimiento inactividad'}`
    case 'ml.models_trained': return `Modelos ML entrenados · ${meta.modelCount ?? 0} (${meta.avgR2 ?? '?'})`
    default:
      return `${item.entity_type} · ${item.action}`
  }
}

export async function fetchActivity(limit = 40): Promise<ActivityItem[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('activity_logs')
    .select('id,entity_type,entity_id,action,metadata,created_at')
    .eq('organization_id', DEFAULT_ORG_ID)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []).map((row) => ({
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id ?? undefined,
    action: row.action,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.created_at ?? new Date().toISOString(),
    label: formatLabel({
      entity_type: row.entity_type,
      action: row.action,
      metadata: row.metadata as Record<string, unknown> | null,
    }),
  }))
}

export function watchActivity(onChange: () => void): () => void {
  let cleanup: (() => void) | undefined
  void subscribeToActivity(onChange).then((unsub) => {
    cleanup = unsub
  })
  return () => { cleanup?.() }
}

export async function logTalentLive(displayName: string, viewers: number, login: string): Promise<void> {
  if (!supabase) return
  await supabase.rpc('log_activity', {
    p_entity_type: 'talent',
    p_entity_id: null,
    p_action: 'live',
    p_metadata: { displayName, viewers, login },
  })
}
