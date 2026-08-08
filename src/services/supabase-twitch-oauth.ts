import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-shell'
import type { Session, User } from '@supabase/supabase-js'
import { humanizeInvokeError } from '@/lib/humanize-error'
import { supabase } from '@/services/supabase'
import { isTauri } from '@/services/twitch'

export const OAUTH_CALLBACK_PORT = 14563
export const OAUTH_CALLBACK_PATH = '/auth/callback'
export const OAUTH_REDIRECT_TO = `http://127.0.0.1:${OAUTH_CALLBACK_PORT}${OAUTH_CALLBACK_PATH}`

export type SupabaseTwitchLoginResult = {
  login: string
  displayName: string
  avatarUrl: string
  authUserId: string
  expiresAt?: number
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

export function extractTwitchLogin(user: User): string | null {
  const meta = user.user_metadata ?? {}
  const appMeta = user.app_metadata ?? {}
  const candidates = [
    readString(meta.preferred_username),
    readString(meta.login),
    readString(meta.user_name),
    readString(meta.name),
    readString(meta.nickname),
    readString(appMeta.provider_id),
  ]
  for (const candidate of candidates) {
    if (candidate) return candidate.replace(/^@/, '').toLowerCase()
  }
  const email = readString(user.email)
  if (email && !email.endsWith('@twitch.neuragest.local')) {
    const local = email.split('@')[0]
    if (local) return local.toLowerCase()
  }
  return null
}

export function profileFromSupabaseUser(user: User, session?: Session | null): SupabaseTwitchLoginResult | null {
  const login = extractTwitchLogin(user)
  if (!login) return null
  const meta = user.user_metadata ?? {}
  const displayName =
    readString(meta.full_name) ??
    readString(meta.display_name) ??
    readString(meta.name) ??
    login
  const avatarUrl =
    readString(meta.avatar_url) ??
    readString(meta.picture) ??
    readString(meta.profile_image_url) ??
    ''
  return {
    login,
    displayName,
    avatarUrl,
    authUserId: user.id,
    expiresAt: session?.expires_at ? session.expires_at * 1000 : undefined,
  }
}

async function syncProviderTokens(session: Session, profile: SupabaseTwitchLoginResult): Promise<void> {
  if (!session.provider_token) return
  await invoke('store_twitch_oauth_tokens', {
    accessToken: session.provider_token,
    refreshToken: session.provider_refresh_token ?? '',
    expiresIn: Math.max(60, (session.expires_in ?? 3600)),
    login: profile.login,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
  })
}

export async function signInWithSupabaseTwitch(): Promise<SupabaseTwitchLoginResult> {
  if (!supabase || !isTauri) {
    throw new Error('Iniciar sesión con Twitch requiere la app de escritorio NeuraGest.')
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'twitch',
    options: {
      redirectTo: OAUTH_REDIRECT_TO,
      skipBrowserRedirect: true,
    },
  })

  if (error) throw error
  if (!data.url) throw new Error('No se recibió la URL para autorizar Twitch.')

  try {
    const callbackPromise = invoke<string>('wait_oauth_callback', { port: OAUTH_CALLBACK_PORT })
    await open(data.url)

    const callbackUrl = await callbackPromise
    const parsed = new URL(callbackUrl)
    const oauthError =
      parsed.searchParams.get('error_description') ??
      parsed.searchParams.get('error')
    if (oauthError) throw new Error(oauthError)

    const code = parsed.searchParams.get('code')
    if (!code) throw new Error('Twitch no devolvió el código de autorización.')

    const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) throw exchangeError
    if (!sessionData.session?.user) throw new Error('No se pudo establecer la sesión.')

    const profile = profileFromSupabaseUser(sessionData.session.user, sessionData.session)
    if (!profile) {
      throw new Error('No se recibió el perfil de Twitch esperado.')
    }

    await syncProviderTokens(sessionData.session, profile)
    return profile
  } catch (error) {
    throw new Error(humanizeInvokeError(error))
  }
}

export async function getActiveSupabaseTwitchProfile(): Promise<SupabaseTwitchLoginResult | null> {
  if (!supabase) return null

  let session: Session | null = null
  const { data, error } = await supabase.auth.getSession()
  const existing = !error ? data.session : null
  const freshEnough =
    existing?.user &&
    (existing.expires_at ?? 0) * 1000 > Date.now() + 30_000

  if (freshEnough && existing) {
    session = existing
  } else {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError || !refreshed.session?.user) {
      if (existing?.user) session = existing
      else return null
    } else {
      session = refreshed.session
    }
  }

  const profile = profileFromSupabaseUser(session.user, session)
  if (!profile) return null
  await syncProviderTokens(session, profile).catch(() => undefined)
  return profile
}

export async function signOutSupabase(): Promise<void> {
  if (!supabase) return
  await supabase.auth.signOut()
}
