import { invoke } from '@tauri-apps/api/core'
import type { Session, User } from '@supabase/supabase-js'
import { humanizeInvokeError } from '@/lib/humanize-error'
import { prepareDesktopAuthorizeUrl } from '@/services/oauth-authorize-url'
import { supabase } from '@/services/supabase'
import { isTauri } from '@/services/twitch'

export const OAUTH_CALLBACK_PORT = 14563
export const OAUTH_CALLBACK_PATH = '/auth/callback'

export function oauthRedirectTo(port: number = OAUTH_CALLBACK_PORT): string {
  return `http://127.0.0.1:${port}${OAUTH_CALLBACK_PATH}`
}

/** @deprecated Prefer oauthRedirectTo(boundPort) after prepare_oauth_callback. */
export const OAUTH_REDIRECT_TO = oauthRedirectTo()

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

async function closeOAuthAuthorizeWindow(): Promise<void> {
  if (!isTauri) return
  try {
    await invoke('close_oauth_authorize_window')
  } catch {
    // Best-effort.
  }
}

export async function cancelOAuthCallbackListener(): Promise<void> {
  if (!isTauri) return
  try {
    await invoke('cancel_oauth_callback')
  } catch {
    // Best-effort: previous listener may already be gone.
  }
}

export type SignInTwitchHooks = {
  /** Fired only after the loopback listener is bound and the authorize window is opened. */
  onBrowserOpened?: () => void
}

export async function signInWithSupabaseTwitch(
  hooks?: SignInTwitchHooks,
): Promise<SupabaseTwitchLoginResult> {
  if (!supabase || !isTauri) {
    throw new Error('Iniciar sesión con Twitch requiere la app de escritorio NeuraGest.')
  }

  // 1) Bind loopback FIRST — never open authorize if this fails.
  const boundPort = await invoke<number>('prepare_oauth_callback', {
    preferredPort: OAUTH_CALLBACK_PORT,
    expectedPathPrefix: OAUTH_CALLBACK_PATH,
  })
  const redirectTo = oauthRedirectTo(boundPort)

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'twitch',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  })

  if (error) {
    await cancelOAuthCallbackListener()
    throw error
  }
  if (!data.url) {
    await cancelOAuthCallbackListener()
    throw new Error('No se recibió la URL para autorizar Twitch.')
  }

  // 2) Fail closed: require redirect_to=loopback + intact PKCE before opening anything.
  let authorizeUrl: string
  try {
    authorizeUrl = prepareDesktopAuthorizeUrl(data.url, redirectTo)
  } catch (guardError) {
    await cancelOAuthCallbackListener()
    throw guardError
  }

  try {
    // 3) Start accept BEFORE open so a fast redirect cannot race the listener.
    const callbackPromise = invoke<string>('wait_oauth_callback')
    // Isolated webview — not the system browser (Arc/Awards) and not shell `open` (truncates & on Windows).
    await invoke('open_oauth_authorize_window', { authorizeUrl })
    hooks?.onBrowserOpened?.()

    const callbackUrl = await callbackPromise
    await closeOAuthAuthorizeWindow()
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
    await cancelOAuthCallbackListener()
    await closeOAuthAuthorizeWindow()
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
