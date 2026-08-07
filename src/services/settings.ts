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
}

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

export async function getDiscordSettings(): Promise<DiscordSettings> {
  const raw = await getSetting<DiscordSettings>(DISCORD_KEY, { webhookUrl: '', enabled: false, postedLive: {} })
  return {
    ...raw,
    eventTemplates: { ...DEFAULT_DISCORD_EVENT_TEMPLATES, ...raw.eventTemplates },
  }
}

export async function saveDiscordSettings(settings: DiscordSettings): Promise<boolean> {
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
