import { supabase, isSupabaseConfigured } from '@/services/supabase'

export type SupabaseHealthStatus = {
  configured: boolean
  status: 'checking' | 'connected' | 'error' | 'no_credentials'
  latencyMs?: number
  projectRef?: string
  projectUrl?: string
  hasSupabaseAuthSession: boolean
  authMode: 'supabase' | 'twitch_sqlite'
  dbOk?: boolean
  realtimeOk?: boolean
  storageOk?: boolean
  tablesOk?: boolean
  rolesCount?: number
  talentsCount?: number
  appUsersCount?: number
  lastCheckedAt?: string
  error?: string
}

function projectRefFromUrl(url?: string): string | undefined {
  if (!url) return undefined
  try {
    return new URL(url).hostname.split('.')[0]
  } catch {
    return undefined
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error('Tiempo de espera agotado')), ms)
    }),
  ])
}

export async function checkSupabaseHealth(): Promise<SupabaseHealthStatus> {
  const projectUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const base: SupabaseHealthStatus = {
    configured: isSupabaseConfigured,
    status: isSupabaseConfigured ? 'checking' : 'no_credentials',
    projectUrl,
    projectRef: projectRefFromUrl(projectUrl),
    hasSupabaseAuthSession: false,
    authMode: 'twitch_sqlite',
    lastCheckedAt: new Date().toISOString(),
  }

  if (!supabase || !isSupabaseConfigured) {
    return { ...base, status: 'no_credentials', error: 'Faltan credenciales de la nube en la configuración' }
  }

  const started = performance.now()

  try {
    const sessionPromise = supabase.auth.getSession()
    const pingPromise = supabase.rpc('health_ping')
    const storagePromise = supabase.storage.listBuckets()

    const [sessionResult, pingResult, storageResult] = await withTimeout(
      Promise.all([sessionPromise, pingPromise, storagePromise]),
      12_000,
    )

    const latencyMs = Math.round(performance.now() - started)
    const hasSupabaseAuthSession = Boolean(sessionResult.data.session)
    const dbOk = !pingResult.error && pingResult.data?.ok === true
    const tablesOk = dbOk && typeof pingResult.data?.roles_count === 'number'
    const storageOk = !storageResult.error

    let realtimeOk = false
    try {
      realtimeOk = await withTimeout(
        new Promise<boolean>((resolve) => {
          const channel = supabase!
            .channel(`health-${Date.now()}`)
            .subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                void supabase!.removeChannel(channel)
                resolve(true)
              }
              if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                void supabase!.removeChannel(channel)
                resolve(false)
              }
            })
          window.setTimeout(() => {
            void supabase!.removeChannel(channel)
            resolve(false)
          }, 4000)
        }),
        5000,
      )
    } catch {
      realtimeOk = false
    }

    const pingData = pingResult.data as {
      roles_count?: number
      talents_count?: number
      app_users_count?: number
    } | null

    const connected = dbOk && tablesOk
    return {
      ...base,
      status: connected ? 'connected' : 'error',
      latencyMs,
      hasSupabaseAuthSession,
      authMode: hasSupabaseAuthSession ? 'supabase' : 'twitch_sqlite',
      dbOk,
      realtimeOk,
      storageOk,
      tablesOk,
      rolesCount: pingData?.roles_count,
      talentsCount: pingData?.talents_count,
      appUsersCount: pingData?.app_users_count,
      error: connected
        ? undefined
        : pingResult.error?.message ?? storageResult.error?.message ?? 'Comprobación de conexión incompleta',
    }
  } catch (error) {
    return {
      ...base,
      status: 'error',
      latencyMs: Math.round(performance.now() - started),
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
