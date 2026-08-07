import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-shell'
import { humanizeInvokeError } from '@/lib/humanize-error'
import { isTauri } from '@/services/twitch'

export const GOOGLE_OAUTH_CALLBACK_PORT = 14564
export const GOOGLE_OAUTH_CALLBACK_PATH = '/auth/google/callback'
export const GOOGLE_OAUTH_REDIRECT_TO =
  `http://127.0.0.1:${GOOGLE_OAUTH_CALLBACK_PORT}${GOOGLE_OAUTH_CALLBACK_PATH}`

export type GoogleOAuthStatus = {
  connected: boolean
  email?: string
  expiresAt?: number
}

export async function googleOAuthStatus(): Promise<GoogleOAuthStatus> {
  if (!isTauri) return { connected: false }
  return invoke<GoogleOAuthStatus>('google_oauth_status')
}

export async function connectGoogleCalendar(): Promise<GoogleOAuthStatus> {
  if (!isTauri) throw new Error('Google Calendar requiere la app de escritorio NeuraGest.')
  try {
    const authUrl = await invoke<string>('google_oauth_begin', {
      redirectUri: GOOGLE_OAUTH_REDIRECT_TO,
    })
    const callbackPromise = invoke<string>('wait_oauth_callback', {
      port: GOOGLE_OAUTH_CALLBACK_PORT,
      expectedPathPrefix: GOOGLE_OAUTH_CALLBACK_PATH,
    })
    await open(authUrl)
    const callbackUrl = await callbackPromise
    return await invoke<GoogleOAuthStatus>('google_oauth_complete', {
      callbackUrl,
      redirectUri: GOOGLE_OAUTH_REDIRECT_TO,
    })
  } catch (error) {
    throw new Error(humanizeInvokeError(error))
  }
}

export async function disconnectGoogleCalendar(): Promise<void> {
  if (!isTauri) return
  await invoke('google_oauth_disconnect')
}

export type GoogleSyncResult = {
  pulled: number
  pushed: number
  lastSyncAt: string
}

export async function syncGoogleCalendar(calendarId = 'primary'): Promise<GoogleSyncResult> {
  if (!isTauri) throw new Error('Sincronizar Google Calendar requiere la app de escritorio.')
  return invoke<GoogleSyncResult>('sync_google_calendar', { calendarId })
}
