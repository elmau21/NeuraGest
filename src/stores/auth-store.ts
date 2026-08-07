import { create } from 'zustand'
import { syncSupabaseAuthBridge } from '@/services/supabase-auth'
import {
  canAccessAdminPanel,
  ensureAppUser,
  fetchMyRoles,
  type AppRole,
} from '@/services/app-users'
import {
  getActiveSupabaseTwitchProfile,
  signInWithSupabaseTwitch,
  signOutSupabase,
  type SupabaseTwitchLoginResult,
} from '@/services/supabase-twitch-oauth'
import {
  disconnectTwitch,
  isTauri,
  twitchAuthState,
  type TwitchAuthState,
  type TwitchUserProfile,
} from '@/services/twitch'
import { humanizeInvokeError } from '@/lib/humanize-error'

export type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated'
export type OAuthFlowPhase = 'idle' | 'opening' | 'waiting' | 'success' | 'error'

export type TwitchSession = {
  login: string
  displayName: string
  avatarUrl: string
  expiresAt?: number
  authUserId: string
}

type AuthState = {
  status: AuthStatus
  session: TwitchSession | null
  roles: AppRole[]
  appUserId: string | null
  canAdmin: boolean
  identityError: string | null
  oauthFlow: OAuthFlowPhase
  error: string | null
  initialize: () => Promise<void>
  syncAppIdentity: () => Promise<void>
  startTwitchLogin: () => Promise<void>
  cancelOAuthFlow: () => void
  logout: () => Promise<void>
}

function profileToSession(profile: SupabaseTwitchLoginResult | TwitchUserProfile | TwitchAuthState, authUserId?: string): TwitchSession | null {
  if ('authUserId' in profile && profile.authUserId) {
    return {
      login: profile.login,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      expiresAt: profile.expiresAt,
      authUserId: profile.authUserId,
    }
  }
  const login = 'login' in profile ? profile.login : undefined
  const displayName = profile.displayName
  const avatarUrl = 'avatarUrl' in profile ? profile.avatarUrl : undefined
  if (!login || !displayName || !authUserId) return null
  return {
    login,
    displayName,
    avatarUrl: avatarUrl ?? '',
    expiresAt: profile.expiresAt,
    authUserId,
  }
}

async function loadRolesAndIdentity(
  session: TwitchSession | null,
): Promise<Pick<AuthState, 'roles' | 'appUserId' | 'canAdmin' | 'identityError'>> {
  if (!session || !isTauri) {
    return { roles: [], appUserId: null, canAdmin: false, identityError: null }
  }
  try {
    const ensured = await ensureAppUser(session.authUserId)
    await syncSupabaseAuthBridge(session.authUserId)
    const roles = ensured.roles.length > 0 ? ensured.roles : await fetchMyRoles()
    return {
      roles,
      appUserId: ensured.id,
      canAdmin: canAccessAdminPanel(session.login, roles),
      identityError: null,
    }
  } catch (error) {
    try {
      const roles = await fetchMyRoles()
      return {
        roles,
        appUserId: null,
        canAdmin: canAccessAdminPanel(session.login, roles),
        identityError: error instanceof Error ? error.message : String(error),
      }
    } catch {
      return {
        roles: [],
        appUserId: null,
        canAdmin: canAccessAdminPanel(session.login, []),
        identityError: error instanceof Error ? error.message : String(error),
      }
    }
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'checking',
  session: null,
  roles: [],
  appUserId: null,
  canAdmin: false,
  identityError: null,
  oauthFlow: 'idle',
  error: null,

  syncAppIdentity: async () => {
    const session = get().session
    if (!session) return
    const identity = await loadRolesAndIdentity(session)
    set(identity)
  },

  initialize: async () => {
    set({ status: 'checking', error: null })
    if (!isTauri) {
      set({ status: 'unauthenticated', session: null, roles: [], appUserId: null, canAdmin: false })
      return
    }
    try {
      const supabaseProfile = await getActiveSupabaseTwitchProfile()
      if (supabaseProfile) {
        const session = profileToSession(supabaseProfile)
        if (!session) {
          set({
            status: 'unauthenticated',
            session: null,
            oauthFlow: 'idle',
            error: 'No se pudo cargar la sesión con Twitch.',
            roles: [],
            appUserId: null,
            canAdmin: false,
          })
          return
        }
        const identity = await loadRolesAndIdentity(session)
        set({
          status: 'authenticated',
          session,
          oauthFlow: 'idle',
          error: null,
          ...identity,
        })
        return
      }

      const state = await twitchAuthState()
      if (state.connected) {
        set({
          status: 'unauthenticated',
          session: null,
          oauthFlow: 'idle',
          error: 'Tu sesión Twitch anterior expiró o usa el flujo antiguo. Vuelve a iniciar sesión con Twitch.',
          roles: [],
          appUserId: null,
          canAdmin: false,
        })
        return
      }

      set({
        status: 'unauthenticated',
        session: null,
        oauthFlow: 'idle',
        roles: [],
        appUserId: null,
        canAdmin: false,
      })
    } catch (error) {
      set({
        status: 'unauthenticated',
        session: null,
        error: error instanceof Error ? error.message : String(error),
        roles: [],
        appUserId: null,
        canAdmin: false,
      })
    }
  },

  startTwitchLogin: async () => {
    if (!isTauri) {
      set({ error: 'Usa la app de escritorio NeuraGest para iniciar sesión con Twitch.' })
      return
    }
    set({ oauthFlow: 'opening', error: null })
    try {
      set({ oauthFlow: 'waiting' })
      const profile = await signInWithSupabaseTwitch()
      const session = profileToSession(profile)
      if (!session) throw new Error('Twitch no devolvió un perfil válido.')
      const identity = await loadRolesAndIdentity(session)
      set({
        status: 'authenticated',
        session,
        oauthFlow: 'success',
        error: null,
        ...identity,
      })
    } catch (error) {
      set({
        oauthFlow: 'error',
        error: humanizeInvokeError(error),
      })
    }
  },

  cancelOAuthFlow: () => {
    if (get().oauthFlow === 'waiting') return
    set({ oauthFlow: 'idle', error: null })
  },

  logout: async () => {
    try {
      await signOutSupabase()
      await disconnectTwitch()
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
    set({
      status: 'unauthenticated',
      session: null,
      oauthFlow: 'idle',
      error: null,
      roles: [],
      appUserId: null,
      canAdmin: false,
      identityError: null,
    })
  },
}))
