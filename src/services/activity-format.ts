export type ActivityActor = {
  display_name?: string | null
  twitch_login?: string | null
} | null

export function resolveActorName(
  actor?: ActivityActor,
  metadata?: Record<string, unknown> | null,
): string | undefined {
  const fromJoin = actor?.display_name?.trim() || undefined
  if (fromJoin) return fromJoin

  const metaName = metadata?.actorName ?? metadata?.actorDisplayName
  if (typeof metaName === 'string' && metaName.trim()) return metaName.trim()

  const fromLogin = actor?.twitch_login?.trim() || undefined
  if (fromLogin) return fromLogin

  const metaLogin = metadata?.actorLogin
  if (typeof metaLogin === 'string' && metaLogin.trim()) return metaLogin.trim()

  return undefined
}

export function resolveActorLogin(
  actor?: ActivityActor,
  metadata?: Record<string, unknown> | null,
): string | undefined {
  const fromJoin = actor?.twitch_login?.trim()
  if (fromJoin) return fromJoin
  const metaLogin = metadata?.actorLogin
  if (typeof metaLogin === 'string' && metaLogin.trim()) return metaLogin.trim()
  return undefined
}

function docLabel(meta: Record<string, unknown>): string {
  const title = meta.title ? String(meta.title) : ''
  const fileName = meta.fileName ? String(meta.fileName) : ''
  return title || fileName || 'documento'
}

function withActor(actorName: string | undefined, sentence: string): string {
  const who = actorName?.trim() || 'Alguien'
  return `${who} ${sentence}`
}

/** Etiquetas de auditoría / actividad en español, con quién hizo la acción. */
export function formatActivityLabel(
  entityType: string,
  action: string,
  metadata: Record<string, unknown> | null | undefined,
  actorName?: string,
): string {
  const meta = metadata ?? {}
  const title = meta.title ? String(meta.title) : ''
  const doc = docLabel(meta)
  const key = `${entityType}.${action}`

  switch (key) {
    case 'contract.viewed':
      return withActor(actorName, `abrió el contrato «${doc}»`)
    case 'contract.downloaded':
      return withActor(actorName, `descargó el contrato «${doc}»`)
    case 'contract.deleted':
      return withActor(actorName, `borró el contrato «${doc}»`)
    case 'contract.uploaded':
      return withActor(actorName, `subió el contrato «${doc}»`)
    case 'document.contract_sync':
      return withActor(actorName, `sincronizó el contrato «${doc}»`)
    case 'document.wiki_created':
    case 'wiki.created':
      return withActor(actorName, `creó la wiki «${title || 'sin título'}»`)
    case 'wiki.updated':
    case 'document.wiki_updated':
      return withActor(actorName, `editó la wiki «${title || 'sin título'}»`)
    case 'role.updated':
      return withActor(
        actorName,
        `actualizó roles de ${meta.login ?? 'usuario'}: ${(meta.roles as string[] | undefined)?.join(', ') ?? ''}`,
      )
    case 'role.granted':
      return withActor(actorName, `otorgó el rol ${meta.role ?? ''} a ${meta.login ?? 'usuario'}`)
    case 'role.revoked':
      return withActor(actorName, `revocó el rol ${meta.role ?? ''} a ${meta.login ?? 'usuario'}`)
    case 'task.created':
      return withActor(actorName, `creó la tarea «${title || 'sin título'}»`)
    case 'task.updated':
      return withActor(actorName, `actualizó la tarea${title ? ` «${title}»` : ''}`)
    case 'task.completed':
      return withActor(actorName, `completó la tarea «${title || 'sin título'}»`)
    case 'task.deleted':
      return withActor(actorName, `eliminó la tarea${title ? ` «${title}»` : ''}`)
    case 'task.commented':
      return withActor(
        actorName,
        `comentó en una tarea${meta.preview ? `: «${meta.preview}»` : ''}`,
      )
    case 'task.reassigned':
      return withActor(actorName, `reasignó la tarea «${title || meta.taskId || ''}»`)
    case 'calendar.created':
      return withActor(actorName, `creó el evento «${title || meta.event_type || 'calendario'}»`)
    case 'template.applied':
      return withActor(actorName, `aplicó la plantilla «${meta.template || 'operaciones'}»`)
    case 'rate_card.created':
    case 'rate_card.updated':
      return withActor(
        actorName,
        `${action === 'created' ? 'creó' : 'actualizó'} la rate card «${title || meta.label || 'tarifa'}»`,
      )
    case 'rate_card.deleted':
      return withActor(actorName, `eliminó la rate card «${title || meta.label || ''}»`)
    case 'brief.created':
    case 'brief.updated':
      return withActor(
        actorName,
        `${action === 'created' ? 'creó' : 'actualizó'} el brief «${title || meta.brandName || 'campaña'}»`,
      )
    case 'brief.deleted':
      return withActor(actorName, `eliminó el brief «${title || 'campaña'}»`)
    case 'asset.created':
      return withActor(actorName, `subió el asset «${title || 'archivo'}»`)
    case 'asset.updated':
      return withActor(actorName, `actualizó el asset${title ? ` «${title}»` : ''}`)
    case 'asset.deleted':
      return withActor(actorName, `eliminó el asset «${title || 'archivo'}»`)
    case 'crm.saved':
      return withActor(actorName, `guardó el deal «${title || meta.brandName || 'patrocinio'}»`)
    case 'crm.deleted':
      return withActor(actorName, `eliminó el deal «${title || meta.brandName || 'patrocinio'}»`)
    case 'handoff.created':
      return withActor(
        actorName,
        `registró un handoff${meta.talentLogin ? ` de @${meta.talentLogin}` : ' de turno'}`,
      )
    case 'handoff.updated':
      return withActor(actorName, `actualizó un handoff${meta.status ? ` (${meta.status})` : ''}`)
    case 'session.login':
    case 'auth.login':
      return withActor(actorName, 'inició sesión en NeuraGest')
    case 'session.logout':
    case 'auth.logout':
      return withActor(actorName, 'cerró sesión')
    case 'talent.live':
      return `${meta.displayName || 'Talento'} en vivo · ${meta.viewers ?? 0} viewers`
    case 'ml.anomaly_detected':
      return `ML anomalía · ${meta.displayName || 'talento'} (${meta.direction}) z=${meta.zScore ?? '?'}`
    case 'ml.regime_change':
      return `ML cambio régimen · ${meta.displayName || 'talento'} (${meta.direction})`
    case 'ml.risk_task_created':
      return `Tarea ML creada: ${meta.title || 'seguimiento inactividad'}`
    case 'ml.models_trained':
      return `Modelos ML entrenados · ${meta.modelCount ?? 0} (${meta.avgR2 ?? '?'})`
    default:
      return actorName
        ? `${actorName}: ${entityType} · ${action}`
        : `${entityType} · ${action}`
  }
}
