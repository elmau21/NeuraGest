import { supabase } from '@/services/supabase'
import { DEFAULT_ORG_ID } from '@/services/org'
import { logActivity } from '@/services/activity-log'

export type OwnerAssistantLink = {
  id: string
  ownerUserId: string
  ownerLogin: string
  assistantUserId: string
  assistantLogin: string
  createdAt: string
  updatedAt: string
}

function mapLink(row: Record<string, unknown>): OwnerAssistantLink {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    ownerLogin: String(row.owner_login ?? ''),
    assistantUserId: String(row.assistant_user_id),
    assistantLogin: String(row.assistant_login ?? ''),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  }
}

export async function fetchOwnerAssistantLinks(): Promise<OwnerAssistantLink[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('ops_owner_assistant_links')
    .select('id,owner_user_id,owner_login,assistant_user_id,assistant_login,created_at,updated_at')
    .eq('organization_id', DEFAULT_ORG_ID)
    .order('owner_login')
  if (error || !data) return []
  return data.map((row) => mapLink(row as Record<string, unknown>))
}

export async function fetchOwnerAssistantLinkForUser(
  authUserId: string,
): Promise<OwnerAssistantLink | null> {
  if (!supabase || !authUserId) return null
  const { data, error } = await supabase
    .from('ops_owner_assistant_links')
    .select('id,owner_user_id,owner_login,assistant_user_id,assistant_login,created_at,updated_at')
    .eq('organization_id', DEFAULT_ORG_ID)
    .or(`owner_user_id.eq.${authUserId},assistant_user_id.eq.${authUserId}`)
    .maybeSingle()
  if (error || !data) return null
  return mapLink(data as Record<string, unknown>)
}

export async function fetchOwnerAssistantLinkByOwner(
  ownerUserId: string,
): Promise<OwnerAssistantLink | null> {
  if (!supabase || !ownerUserId) return null
  const { data, error } = await supabase
    .from('ops_owner_assistant_links')
    .select('id,owner_user_id,owner_login,assistant_user_id,assistant_login,created_at,updated_at')
    .eq('organization_id', DEFAULT_ORG_ID)
    .eq('owner_user_id', ownerUserId)
    .maybeSingle()
  if (error || !data) return null
  return mapLink(data as Record<string, unknown>)
}

export async function assignOwnerAssistant(input: {
  ownerUserId: string
  ownerLogin: string
  assistantUserId: string
  assistantLogin: string
}): Promise<OwnerAssistantLink | null> {
  if (!supabase) return null
  const ownerLogin = input.ownerLogin.trim().toLowerCase()
  const assistantLogin = input.assistantLogin.trim().toLowerCase()
  const payload = {
    organization_id: DEFAULT_ORG_ID,
    owner_user_id: input.ownerUserId,
    owner_login: ownerLogin,
    assistant_user_id: input.assistantUserId,
    assistant_login: assistantLogin,
  }
  const { data, error } = await supabase
    .from('ops_owner_assistant_links')
    .upsert(payload, { onConflict: 'organization_id,owner_user_id' })
    .select('id,owner_user_id,owner_login,assistant_user_id,assistant_login,created_at,updated_at')
    .single()
  if (error || !data) return null
  const link = mapLink(data as Record<string, unknown>)
  await logActivity('ops_owner_assistant', 'assigned', {
    ownerLogin: link.ownerLogin,
    assistantLogin: link.assistantLogin,
  }, link.id)
  return link
}

export async function unassignOwnerAssistant(ownerUserId: string): Promise<boolean> {
  if (!supabase || !ownerUserId) return false
  const existing = await fetchOwnerAssistantLinkByOwner(ownerUserId)
  const { error } = await supabase
    .from('ops_owner_assistant_links')
    .delete()
    .eq('organization_id', DEFAULT_ORG_ID)
    .eq('owner_user_id', ownerUserId)
  if (error) return false
  if (existing) {
    await logActivity('ops_owner_assistant', 'unassigned', {
      ownerLogin: existing.ownerLogin,
      assistantLogin: existing.assistantLogin,
    }, existing.id)
  }
  return true
}

/** IDs de asistentes ya vinculados a otro owner (excluye el del owner dado). */
export function assignedAssistantIds(
  links: OwnerAssistantLink[],
  exceptOwnerUserId?: string,
): Set<string> {
  const taken = new Set<string>()
  for (const link of links) {
    if (exceptOwnerUserId && link.ownerUserId === exceptOwnerUserId) continue
    taken.add(link.assistantUserId)
  }
  return taken
}
