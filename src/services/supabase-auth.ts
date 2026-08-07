import { supabase } from '@/services/supabase'
import { isTauri } from '@/services/twitch'

export async function syncSupabaseAuthBridge(authUserId: string): Promise<boolean> {
  if (!supabase || !isTauri || !authUserId) return false
  try {
    await supabase.rpc('sync_auth_user_from_app', {
      p_auth_user_id: authUserId,
    })
    return true
  } catch {
    return false
  }
}
