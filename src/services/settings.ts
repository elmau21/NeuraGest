import { supabase } from '@/services/supabase'
import { DEFAULT_ORG_ID } from '@/services/org'

export type DiscordEventKind = 'raid' | 'milestone' | 'campaignEnd'

export type DiscordEventTemplates = {
  raid: string
  milestone: string
  campaignEnd: string
}

export const DEFAULT_DISCORD_EVENT_TEMPLATES: DiscordEventTemplates = {
  raid: '🎯 **{talent}** recibió raid de **{raider}** · {viewers} viewers en destino',
  milestone: '🏆 **{talent}** alcanzó **{milestone}** · ¡felicidades al roster!',
  campaignEnd: '📋 Campaña **{brand}** finalizada con **{talent}** · revisar entregables en NeuraGest',
}

export type DiscordSettings = {
  webhookUrl: string
  enabled: boolean
  postedLive: Record<string, string>
  eventTemplates?: DiscordEventTemplates
  /** Mostrar estado de NeuraGest en el perfil de Discord (Rich Presence). */
  presenceEnabled?: boolean
  /** Application ID del Discord Developer Portal (override de .env). */
  presenceApplicationId?: string
  presenceDetails?: string
  presenceState?: string
  /** Si true (default), el estado refleja la página actual. */
  presenceShowPage?: boolean
  /** Imagen grande con asset key `neuragest` (logo NeuraLive en el portal). */
  presenceUseLargeImage?: boolean
  /** Badge circular `neuragest_icon` (default ON con large image). */
  presenceUseSmallImage?: boolean
  /** Etiqueta del botón RPC (máx. 32). Requiere URL válida. */
  presenceButtonLabel?: string
  /** URL del botón RPC (https). Vacío = sin botón (salvo env NEURALIVE_URL / invite). */
  presenceButtonUrl?: string
}

/** Application ID de la app Discord NeuraGest (agencia). Público por diseño; override opcional. */
export const NEURAGEST_DISCORD_APPLICATION_ID = '1535443541634064424'

export const DEFAULT_DISCORD_PRESENCE = {
  /** Activo por defecto: Discord abierto + ID de agencia → out-of-box. */
  presenceEnabled: true,
  /** Vacío = usar ID embebido / de agencia (no hace falta pegar nada). */
  presenceApplicationId: '',
  presenceDetails: 'Operaciones Twitch · NeuraLive',
  presenceState: '',
  presenceShowPage: true,
  /** ON por defecto: usa el Art Asset `neuragest` (logo NeuraLive). */
  presenceUseLargeImage: true,
  /** ON por defecto: badge `neuragest_icon`. */
  presenceUseSmallImage: true,
  presenceButtonLabel: '',
  presenceButtonUrl: '',
} as const

export type GoogleCalendarSettings = {
  syncEnabled: boolean
  calendarId: string
  lastSyncAt?: string
  oauthNote: string
  connected?: boolean
  connectedEmail?: string
}

export type NativeAlertSettings = {
  enabled: boolean
  notifyOnline: boolean
  notifyOffline: boolean
  notifyViewerThreshold: boolean
  viewerThreshold: number
  postedAlerts: Record<string, string>
}

const DISCORD_KEY = 'discord'
const GCAL_KEY = 'google_calendar'
const NATIVE_ALERTS_KEY = 'native_alerts'

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  if (!supabase) return fallback
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('organization_id', DEFAULT_ORG_ID)
    .eq('key', key)
    .maybeSingle()
  return (data?.value as T | undefined) ?? fallback
}

import type { Json } from '@/types/supabase'

export async function saveSetting<T extends Json>(key: string, value: T): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('settings').upsert(
    { organization_id: DEFAULT_ORG_ID, user_id: null, key, value },
    { onConflict: 'organization_id,user_id,key' },
  )
  return !error
}

/** Sticky local: 'enabled' = migración fuerza ON; 'user-set' = respetar lo guardado. */
const PRESENCE_MIGRATION_KEY = 'neuragest-discord-presence-agency-v1'
const PRESENCE_IMAGE_MIGRATION_KEY = 'neuragest-discord-presence-large-image-v1'
const PRESENCE_SMALL_IMAGE_MIGRATION_KEY = 'neuragest-discord-presence-small-image-v1'

/**
 * Presence activo por defecto. Si un save antiguo dejó `presenceEnabled: false`
 * sin Application ID propio, lo reactivamos hasta que el usuario guarde de nuevo.
 */
function resolvePresenceEnabled(raw: DiscordSettings): boolean {
  if (typeof raw.presenceEnabled !== 'boolean') {
    return DEFAULT_DISCORD_PRESENCE.presenceEnabled
  }
  try {
    const flag = localStorage.getItem(PRESENCE_MIGRATION_KEY)
    if (flag === 'enabled') return true
    if (flag === 'user-set') return raw.presenceEnabled
  } catch {
    /* ignore */
  }
  if (raw.presenceEnabled === false && !raw.presenceApplicationId?.trim()) {
    try {
      localStorage.setItem(PRESENCE_MIGRATION_KEY, 'enabled')
    } catch {
      /* ignore */
    }
    return true
  }
  return raw.presenceEnabled
}

/** Imagen grande ON por defecto (logo NeuraLive). Migración one-shot desde saves antiguos. */
function resolvePresenceUseLargeImage(raw: DiscordSettings): boolean {
  if (typeof raw.presenceUseLargeImage !== 'boolean') {
    return DEFAULT_DISCORD_PRESENCE.presenceUseLargeImage
  }
  try {
    const flag = localStorage.getItem(PRESENCE_IMAGE_MIGRATION_KEY)
    if (flag === 'enabled') return true
    if (flag === 'user-set') return raw.presenceUseLargeImage
  } catch {
    /* ignore */
  }
  if (raw.presenceUseLargeImage === false) {
    try {
      localStorage.setItem(PRESENCE_IMAGE_MIGRATION_KEY, 'enabled')
    } catch {
      /* ignore */
    }
    return true
  }
  return raw.presenceUseLargeImage
}

/** Badge circular ON por defecto. Migración one-shot si el save aún no tenía el campo. */
function resolvePresenceUseSmallImage(raw: DiscordSettings): boolean {
  if (typeof raw.presenceUseSmallImage !== 'boolean') {
    return DEFAULT_DISCORD_PRESENCE.presenceUseSmallImage
  }
  try {
    const flag = localStorage.getItem(PRESENCE_SMALL_IMAGE_MIGRATION_KEY)
    if (flag === 'enabled') return true
    if (flag === 'user-set') return raw.presenceUseSmallImage
  } catch {
    /* ignore */
  }
  return raw.presenceUseSmallImage
}

/** Detalle por defecto renovado; actualiza copy antiguo genérico. */
function resolvePresenceDetails(raw: DiscordSettings): string {
  const value = raw.presenceDetails?.trim()
  if (
    !value
    || value === 'Gestionando talentos'
    || value === 'NeuraLive · Gestión de talentos'
  ) {
    return DEFAULT_DISCORD_PRESENCE.presenceDetails
  }
  return value
}

export async function getDiscordSettings(): Promise<DiscordSettings> {
  const raw = await getSetting<DiscordSettings>(DISCORD_KEY, { webhookUrl: '', enabled: false, postedLive: {} })
  return {
    ...DEFAULT_DISCORD_PRESENCE,
    ...raw,
    eventTemplates: { ...DEFAULT_DISCORD_EVENT_TEMPLATES, ...raw.eventTemplates },
    presenceEnabled: resolvePresenceEnabled(raw),
    presenceApplicationId: raw.presenceApplicationId ?? DEFAULT_DISCORD_PRESENCE.presenceApplicationId,
    presenceDetails: resolvePresenceDetails(raw),
    presenceState: raw.presenceState ?? DEFAULT_DISCORD_PRESENCE.presenceState,
    presenceShowPage: raw.presenceShowPage ?? DEFAULT_DISCORD_PRESENCE.presenceShowPage,
    presenceUseLargeImage: resolvePresenceUseLargeImage(raw),
    presenceUseSmallImage: resolvePresenceUseSmallImage(raw),
    presenceButtonLabel: raw.presenceButtonLabel ?? DEFAULT_DISCORD_PRESENCE.presenceButtonLabel,
    presenceButtonUrl: raw.presenceButtonUrl ?? DEFAULT_DISCORD_PRESENCE.presenceButtonUrl,
  }
}

export async function saveDiscordSettings(settings: DiscordSettings): Promise<boolean> {
  try {
    localStorage.setItem(PRESENCE_MIGRATION_KEY, 'user-set')
    localStorage.setItem(PRESENCE_IMAGE_MIGRATION_KEY, 'user-set')
    localStorage.setItem(PRESENCE_SMALL_IMAGE_MIGRATION_KEY, 'user-set')
  } catch {
    /* ignore */
  }
  return saveSetting(DISCORD_KEY, settings)
}

export async function getGoogleCalendarSettings(): Promise<GoogleCalendarSettings> {
  return getSetting<GoogleCalendarSettings>(GCAL_KEY, {
    syncEnabled: false,
    calendarId: 'primary',
    oauthNote: 'Conexión con Google pendiente — usa exportación ICS mientras tanto.',
  })
}

export async function saveGoogleCalendarSettings(settings: GoogleCalendarSettings): Promise<boolean> {
  return saveSetting(GCAL_KEY, settings)
}

export async function getNativeAlertSettings(): Promise<NativeAlertSettings> {
  return getSetting<NativeAlertSettings>(NATIVE_ALERTS_KEY, {
    enabled: false,
    notifyOnline: true,
    notifyOffline: true,
    notifyViewerThreshold: false,
    viewerThreshold: 100,
    postedAlerts: {},
  })
}

export async function saveNativeAlertSettings(settings: NativeAlertSettings): Promise<boolean> {
  return saveSetting(NATIVE_ALERTS_KEY, settings)
}
