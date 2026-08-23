import type { ActivityItem } from '@/services/activity'

export type ActivityNavigation = {
  to: string
}

export type ActivityNavigationContext = {
  canAccessControlCenter?: boolean
  canAccessDatos?: boolean
  canManageRoles?: boolean
}

type ActivityNavigationItem = Pick<
  ActivityItem,
  'entityType' | 'entityId' | 'action' | 'metadata'
> & {
  label?: string
}

function metaString(meta: Record<string, unknown>, key: string): string | undefined {
  const value = meta[key]
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || undefined
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return undefined
}

function looksLikeTwitchLogin(value: string): string | undefined {
  const normalized = value.trim().replace(/^@/, '').toLowerCase()
  if (!/^[a-z0-9_]{3,25}$/.test(normalized)) return undefined
  return normalized
}

/** Extrae login de etiquetas tipo «RyoNikku en vivo · 12 viewers». */
export function parseLiveLoginFromLabel(label: string | undefined): string | undefined {
  if (!label?.trim()) return undefined
  const match = label.trim().match(/^(.+?)\s+en\s+vivo(?:\s*·|$)/i)
  const candidate = match?.[1]?.trim()
  if (!candidate || candidate.toLowerCase() === 'talento') return undefined
  return looksLikeTwitchLogin(candidate)
}

function normalizeTalentLogin(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined
  return looksLikeTwitchLogin(value)
}

function resolveTalentLiveLogin(item: ActivityNavigationItem): string | undefined {
  const meta = item.metadata ?? {}
  return (
    normalizeTalentLogin(metaString(meta, 'login')) ??
    normalizeTalentLogin(metaString(meta, 'talentLogin')) ??
    normalizeTalentLogin(metaString(meta, 'channel')) ??
    normalizeTalentLogin(item.entityId) ??
    parseLiveLoginFromLabel(item.label) ??
    normalizeTalentLogin(metaString(meta, 'displayName'))
  )
}

/** Resuelve la ruta de destino para una notificación de actividad, o null si no hay destino. */
export function resolveActivityNavigation(
  item: ActivityNavigationItem,
  ctx: ActivityNavigationContext = {},
): ActivityNavigation | null {
  const meta = item.metadata ?? {}
  const explicitRoute = metaString(meta, 'route')
  if (explicitRoute?.startsWith('/')) {
    return { to: explicitRoute }
  }

  const key = `${item.entityType}.${item.action}`

  switch (item.entityType) {
    case 'task': {
      const base = ctx.canAccessControlCenter ? '/control/tareas' : '/tareas'
      if (item.entityId) return { to: `${base}?task=${item.entityId}` }
      return { to: base }
    }

    case 'event_ficha': {
      if (!ctx.canAccessControlCenter) return null
      if (item.entityId) return { to: `/control/fichas?ficha=${item.entityId}` }
      return { to: '/control/fichas' }
    }

    case 'calendar':
      if (item.entityId) return { to: `/calendario?event=${item.entityId}` }
      return { to: '/calendario' }

    case 'talent':
      if (item.action === 'live') {
        const login = resolveTalentLiveLogin(item)
        if (login) return { to: `/talento/${login}` }
        return { to: '/war-room' }
      }
      return null

    case 'contract':
    case 'document': {
      const docId = item.entityId ?? metaString(meta, 'documentId')
      const folderId = metaString(meta, 'folderId')
      if (folderId) return { to: `/documentos?folder=${folderId}` }
      if (docId) return { to: `/documentos?doc=${docId}` }
      return { to: '/documentos' }
    }

    case 'wiki':
      if (item.entityId) return { to: `/wiki?page=${item.entityId}` }
      return { to: '/wiki' }

    case 'role':
      return ctx.canManageRoles ? { to: '/ajustes?tab=permisos' } : { to: '/ajustes' }

    case 'template':
      return { to: '/ajustes?tab=plantillas' }

    case 'rate_card':
      return { to: '/rate-card' }

    case 'brief':
      if (item.entityId) return { to: `/diseno/briefs?brief=${item.entityId}` }
      return { to: '/diseno/briefs' }

    case 'asset':
      return { to: '/assets' }

    case 'crm':
      if (item.entityId) return { to: `/crm?deal=${item.entityId}` }
      return { to: '/crm' }

    case 'handoff':
      return { to: '/handoff' }

    case 'ops_owner_assistant':
      return { to: '/ajustes' }

    case 'ml': {
      if (!ctx.canAccessDatos) return null
      if (key === 'ml.risk_task_created') {
        const taskId = metaString(meta, 'taskId')
        if (taskId) {
          const base = ctx.canAccessControlCenter ? '/control/tareas' : '/tareas'
          return { to: `${base}?task=${taskId}` }
        }
      }
      if (
        (key === 'ml.anomaly_detected' || key === 'ml.regime_change') &&
        item.entityId
      ) {
        return { to: `/talento/${item.entityId}` }
      }
      return { to: '/ciencia-datos' }
    }

    case 'session':
    case 'auth':
      return null

    default:
      return null
  }
}

export function isActivityNavigable(
  item: ActivityNavigationItem,
  ctx?: ActivityNavigationContext,
): boolean {
  return resolveActivityNavigation(item, ctx) !== null
}
