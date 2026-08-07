import { invoke } from '@tauri-apps/api/core'
import type { Talent } from '@/types'

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export type TwitchAuthState = {
  connected: boolean
  displayName?: string
  login?: string
  avatarUrl?: string
  expiresAt?: number
}

export type TwitchDeviceCodeInfo = {
  userCode: string
  verificationUri: string
  expiresIn: number
  interval: number
}

export type TwitchUserProfile = {
  login: string
  displayName: string
  avatarUrl: string
  expiresAt: number
}

export async function initTwitchOAuth(): Promise<TwitchDeviceCodeInfo> {
  if (!isTauri) throw new Error('Iniciar sesión con Twitch requiere la app de escritorio.')
  return invoke<TwitchDeviceCodeInfo>('init_twitch_oauth')
}

export async function pollTwitchOAuth(): Promise<TwitchUserProfile> {
  if (!isTauri) throw new Error('Iniciar sesión con Twitch requiere la app de escritorio.')
  return invoke<TwitchUserProfile>('poll_twitch_oauth')
}

/** Flujo completo sin UI intermedia (compatibilidad). */
export async function startTwitchOAuth(): Promise<TwitchUserProfile> {
  if (!isTauri) throw new Error('Iniciar sesión con Twitch requiere la app de escritorio.')
  return invoke<TwitchUserProfile>('start_twitch_oauth')
}

export async function twitchAuthState(): Promise<TwitchAuthState> {
  if (!isTauri) return { connected: false }
  return invoke<TwitchAuthState>('twitch_auth_state')
}

export async function disconnectTwitch(): Promise<void> {
  if (isTauri) await invoke('disconnect_twitch')
}

export async function refreshTalents(): Promise<Talent[]> {
  if (!isTauri) throw new Error('Los datos de Twitch requieren la app de escritorio NeuraGest.')
  return invoke<Talent[]>('refresh_talents')
}

export async function cachedTalents(): Promise<Talent[]> {
  if (!isTauri) return []
  return (await invoke<Talent[] | null>('cached_talents')) ?? []
}
