import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '@/services/twitch'
import type { DiscordSettings } from '@/services/settings'

export type DiscordRpcStatus = {
  connected: boolean
  enabled: boolean
  applicationId?: string
  message: string
}

export const DEFAULT_PRESENCE_DETAILS = 'Operaciones Twitch · NeuraLive'
export const DEFAULT_PRESENCE_STATE = 'En NeuraGest'
export const DEFAULT_PRESENCE_SMALL_TEXT = 'En vivo en NeuraGest'

/** Claves de Art Assets en Discord Developer Portal (subir PNG con estos nombres). */
export const DISCORD_LARGE_IMAGE_KEY = 'neuragest'
export const DISCORD_SMALL_IMAGE_KEY = 'neuragest_icon'

type StatusListener = (status: DiscordRpcStatus) => void

let lastStatus: DiscordRpcStatus | null = null
const statusListeners = new Set<StatusListener>()

/** Último estado conocido del Rich Presence (para UI de Ajustes). */
export function getLastDiscordPresenceStatus(): DiscordRpcStatus | null {
  return lastStatus
}

export function subscribeDiscordPresenceStatus(listener: StatusListener): () => void {
  statusListeners.add(listener)
  if (lastStatus) listener(lastStatus)
  return () => {
    statusListeners.delete(listener)
  }
}

export function publishDiscordPresenceStatus(status: DiscordRpcStatus): void {
  lastStatus = status
  for (const listener of statusListeners) {
    try {
      listener(status)
    } catch {
      // no romper la app
    }
  }
}

function isHttpUrl(value: string): boolean {
  const trimmed = value.trim()
  return /^https?:\/\//i.test(trimmed) && trimmed.length <= 512
}

/** Etiqueta legible para el estado en Discord según la ruta actual. */
export function presenceLabelForPath(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/'
  const exact: Record<string, string> = {
    '/': 'Dashboard',
    '/war-room': 'War Room',
    '/talentos': 'Talentos',
    '/pipeline': 'Pipeline',
    '/crm': 'CRM',
    '/schedule': 'Schedule',
    '/comisiones': 'Comisiones',
    '/portal': 'Portal',
    '/rate-card': 'Rate Card',
    '/brief': 'Brief',
    '/assets': 'Assets',
    '/handoff': 'Handoff',
    '/media-kit': 'Media Kit',
    '/media-kit/comparar': 'Comparar kits',
    '/vod-digest': 'VOD Digest',
    '/board-pack': 'Board pack',
    '/onboarding': 'Onboarding',
    '/tareas': 'Tareas',
    '/wiki': 'Wiki',
    '/documentos': 'Documentos',
    '/calendario': 'Calendario',
    '/inteligencia': 'Inteligencia Twitch',
    '/ciencia-datos': 'Ciencia de datos',
    '/estadisticas': 'Estadísticas',
    '/analitica': 'Analítica',
    '/auditoria': 'Auditoría',
    '/ajustes': 'Ajustes',
  }
  if (exact[path]) return exact[path]
  if (path.startsWith('/talento/') || path.startsWith('/talentos/')) return 'Perfil de talento'
  if (path.startsWith('/portal/')) return 'Portal'
  return DEFAULT_PRESENCE_STATE
}

/** Hover del badge circular: página actual o marca. */
export function presenceSmallTextFor(pathname: string | undefined, showPage: boolean): string {
  if (showPage && pathname) {
    const label = presenceLabelForPath(pathname)
    if (label && label !== DEFAULT_PRESENCE_STATE) return label
  }
  return DEFAULT_PRESENCE_SMALL_TEXT
}

export async function discordRpcDefaultApplicationId(): Promise<string | null> {
  if (!isTauri) return null
  try {
    return await invoke<string | null>('discord_rpc_default_application_id')
  } catch (error) {
    console.warn('[discord-presence] default application id', error)
    return null
  }
}

export async function discordRpcStatus(): Promise<DiscordRpcStatus> {
  if (!isTauri) {
    return { connected: false, enabled: false, message: 'Requiere la app de escritorio' }
  }
  try {
    const status = await invoke<DiscordRpcStatus>('discord_rpc_status')
    publishDiscordPresenceStatus(status)
    return status
  } catch (error) {
    console.warn('[discord-presence] status', error)
    const status = { connected: false, enabled: false, message: 'Estado en Discord no disponible' }
    publishDiscordPresenceStatus(status)
    return status
  }
}

function friendlyPresenceMessage(status: DiscordRpcStatus): string {
  if (status.connected) return 'Conectado — Discord muestra NeuraGest'
  if (!status.enabled) return status.message || 'Estado en Discord desactivado'
  const raw = (status.message || '').toLowerCase()
  if (raw.includes('no está disponible') || raw.includes('cerrado') || raw.includes('no responde')) {
    return 'Discord no detectado. Ábrelo en este PC (app de escritorio) e inténtalo de nuevo.'
  }
  if (raw.includes('application id')) {
    return 'Falta el Application ID de Discord. Revisa Ajustes → Discord.'
  }
  return status.message || 'No se pudo actualizar el estado en Discord'
}

export async function applyDiscordPresence(
  settings: Pick<
    DiscordSettings,
    | 'presenceEnabled'
    | 'presenceApplicationId'
    | 'presenceDetails'
    | 'presenceState'
    | 'presenceShowPage'
    | 'presenceUseLargeImage'
    | 'presenceUseSmallImage'
    | 'presenceButtonLabel'
    | 'presenceButtonUrl'
  >,
  pathname?: string,
  options?: { forceRefresh?: boolean },
): Promise<DiscordRpcStatus> {
  if (!isTauri) {
    const status = { connected: false, enabled: false, message: 'Requiere la app de escritorio' }
    publishDiscordPresenceStatus(status)
    return status
  }

  const enabled = Boolean(settings.presenceEnabled)
  if (!enabled) {
    try {
      const status = await invoke<DiscordRpcStatus>('discord_rpc_clear')
      const normalized = { ...status, message: friendlyPresenceMessage({ ...status, enabled: false }) }
      publishDiscordPresenceStatus(normalized)
      return normalized
    } catch (error) {
      console.warn('[discord-presence] clear', error)
      const status = { connected: false, enabled: false, message: 'Estado en Discord desactivado' }
      publishDiscordPresenceStatus(status)
      return status
    }
  }

  const showPage = settings.presenceShowPage !== false
  const customState = settings.presenceState?.trim()
  const state =
    customState
    || (showPage && pathname
      ? presenceLabelForPath(pathname)
      : DEFAULT_PRESENCE_STATE)

  const details = settings.presenceDetails?.trim() || DEFAULT_PRESENCE_DETAILS
  const smallText = presenceSmallTextFor(pathname, showPage && !customState)
  const useLargeImage = settings.presenceUseLargeImage !== false
  const useSmallImage = settings.presenceUseSmallImage !== false

  const buttons: Array<{ label: string; url: string }> = []
  const buttonUrl = settings.presenceButtonUrl?.trim() ?? ''
  if (isHttpUrl(buttonUrl)) {
    const label = (settings.presenceButtonLabel?.trim() || 'Abrir').slice(0, 32)
    buttons.push({ label, url: buttonUrl })
  }

  try {
    const status = await invoke<DiscordRpcStatus>('discord_rpc_set_presence', {
      payload: {
        enabled: true,
        applicationId: settings.presenceApplicationId?.trim() || null,
        details,
        state,
        // Default ON: assets `neuragest` + `neuragest_icon` en Developer Portal.
        useLargeImage,
        useSmallImage,
        smallText,
        buttons,
        forceRefresh: Boolean(options?.forceRefresh),
      },
    })
    const normalized = {
      ...status,
      message: friendlyPresenceMessage(status),
    }
    if (!status.connected) {
      console.warn('[discord-presence] set_presence no conectado', status)
    }
    publishDiscordPresenceStatus(normalized)
    return normalized
  } catch (error) {
    console.warn('[discord-presence] set_presence', error)
    const status = {
      connected: false,
      enabled: true,
      message: 'Discord no detectado. Ábrelo en este PC (app de escritorio) e inténtalo de nuevo.',
    }
    publishDiscordPresenceStatus(status)
    return status
  }
}
