import { supabase } from '@/services/supabase'
import { isTauri } from '@/services/twitch'

/** Crea/actualiza public.users + user_roles espejo tras login Twitch. */
export async function syncSupabaseAuthBridge(authUserId: string): Promise<boolean> {
  if (!supabase || !isTauri || !authUserId) return false
  try {
    const { error } = await supabase.rpc('sync_auth_user_from_app', {
      p_auth_user_id: authUserId,
    })
    if (error) return false
    return true
  } catch {
    return false
  }
}
