import { supabase } from '@/services/supabase'
import { profileFromSupabaseUser } from '@/services/supabase-twitch-oauth'
import type { Json } from '@/types/supabase'

export async function currentActorMeta(): Promise<{
  actorName?: string
  actorLogin?: string
}> {
  if (!supabase) return {}
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}
  const profile = profileFromSupabaseUser(user)
  if (profile) {
    return { actorName: profile.displayName, actorLogin: profile.login }
  }
  const { data } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle()
  return { actorName: data?.display_name?.trim() || undefined }
}

/** RPC log_activity con metadata de actor (nombre / login Twitch). */
export async function logActivity(
  entityType: string,
  action: string,
  metadata: Record<string, unknown> = {},
  entityId: string | null = null,
): Promise<void> {
  if (!supabase) return
  const actor = await currentActorMeta()
  await supabase.rpc('log_activity', {
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_action: action,
    p_metadata: { ...metadata, ...actor } as Json,
  })
}
