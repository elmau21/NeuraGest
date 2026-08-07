import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/supabase'
import type { Talent } from '../types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase: SupabaseClient<Database> | null = url && key
  ? createClient<Database>(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null

export const isSupabaseConfigured = Boolean(supabase)

export async function subscribeToActivity(onChange: () => void) {
  if (!supabase) return () => undefined
  const channel = supabase
    .channel('neuragest-activity')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stream_sessions' }, onChange)
    .subscribe()
  return () => { void supabase.removeChannel(channel) }
}

export async function persistTwitchSnapshots(talents: Talent[]): Promise<boolean> {
  if (!supabase || talents.length === 0) return false

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()
  if (profileError || !profile?.organization_id) return false
  const organizationId = profile.organization_id
  const capturedAt = new Date().toISOString()

  const { error: talentError } = await supabase.from('talents').upsert(
    talents.map((talent) => ({
      organization_id: organizationId,
      twitch_user_id: talent.id,
      login: talent.login,
      display_name: talent.login === 'nosomevt' ? 'Nosome' : talent.displayName,
      avatar_url: talent.avatar,
      description: talent.description,
      twitch_created_at: talent.createdAt,
      metadata: {
        is_live: talent.isLive,
        viewers: talent.viewers,
        category: talent.category,
        title: talent.title,
        last_twitch_sync_at: capturedAt,
      },
    })),
    { onConflict: 'organization_id,login' },
  )
  if (talentError) return false

  const { data: storedTalents, error: storedError } = await supabase
    .from('talents')
    .select('id,login')
    .eq('organization_id', organizationId)
    .in('login', talents.map((talent) => talent.login))
  if (storedError || !storedTalents) return false
  const idByLogin = new Map(storedTalents.map((talent) => [talent.login, talent.id]))

  const { error: snapshotError } = await supabase.from('viewer_snapshots').insert(
    talents.flatMap((talent) => {
      const talentId = idByLogin.get(talent.login)
      return talentId ? [{
        organization_id: organizationId,
        talent_id: talentId,
        viewers: talent.viewers,
        captured_at: capturedAt,
      }] : []
    }),
  )
  if (snapshotError) return false

  const liveTalents = talents.filter((talent) => talent.isLive && talent.streamId && talent.startedAt)
  if (liveTalents.length > 0) {
    const { error: sessionError } = await supabase.from('stream_sessions').upsert(
      liveTalents.flatMap((talent) => {
        const talentId = idByLogin.get(talent.login)
        return talentId ? [{
          organization_id: organizationId,
          talent_id: talentId,
          twitch_stream_id: talent.streamId!,
          title: talent.title,
          category_name: talent.category,
          started_at: talent.startedAt!,
          peak_viewers: talent.viewers,
          ended_at: null,
        }] : []
      }),
      { onConflict: 'twitch_stream_id' },
    )
    if (sessionError) return false

    const streamIds = liveTalents.map((talent) => talent.streamId!)
    const { data: sessions, error: sessionsError } = await supabase
      .from('stream_sessions')
      .select('id,twitch_stream_id')
      .in('twitch_stream_id', streamIds)
    if (sessionsError || !sessions) return false
    const sessionByStream = new Map(sessions.map((session) => [session.twitch_stream_id, session.id]))
    const { error: metricsError } = await supabase.from('stream_metrics').insert(
      liveTalents.flatMap((talent) => {
        const sessionId = sessionByStream.get(talent.streamId!)
        return sessionId ? [{
          organization_id: organizationId,
          session_id: sessionId,
          viewers: talent.viewers,
          captured_at: capturedAt,
        }] : []
      }),
    )
    if (metricsError) return false
  }

  return true
}
