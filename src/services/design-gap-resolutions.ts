import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/services/supabase'
import { currentActorMeta, logActivity } from '@/services/activity-log'
import { DEFAULT_ORG_ID } from '@/services/org'
import { isTauri } from '@/services/twitch'
import type { Database } from '@/types/supabase'

export type DesignGapResolution = {
  id: string
  talentLogin: string
  talentId?: string
  resolvedAt: string
  resolvedByLogin?: string
  notes: string
}

type ResolutionRow = {
  id: string
  talent_login: string
  talent_id: string | null
  resolved_at: string
  resolved_by_login: string | null
  notes: string
}

const SELECT = 'id,talent_login,talent_id,resolved_at,resolved_by_login,notes'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function requireClient() {
  if (!isTauri) throw new Error('Los huecos de diseño requieren la app de escritorio.')
  if (!supabase) throw new Error('No hay conexión con el almacenamiento en la nube.')
  return supabase
}

function parseUuid(value?: string | null): string | null {
  const trimmed = value?.trim()
  if (!trimmed || !UUID_RE.test(trimmed)) return null
  return trimmed
}

function formatSupabaseError(error: {
  message: string
  details?: string | null
  hint?: string | null
}): string {
  const parts = [error.message]
  if (error.details) parts.push(error.details)
  if (error.hint) parts.push(error.hint)
  return parts.join(' · ')
}

async function resolveTalentId(
  client: SupabaseClient<Database>,
  login: string,
  hint?: string,
): Promise<string | null> {
  const fromHint = parseUuid(hint)
  if (fromHint) return fromHint

  const { data, error } = await client
    .from('talents')
    .select('id')
    .eq('organization_id', DEFAULT_ORG_ID)
    .eq('login', login)
    .maybeSingle()

  if (error) return null
  return data?.id ?? null
}

function mapRow(row: ResolutionRow): DesignGapResolution {
  return {
    id: row.id,
    talentLogin: row.talent_login,
    talentId: row.talent_id ?? undefined,
    resolvedAt: row.resolved_at,
    resolvedByLogin: row.resolved_by_login ?? undefined,
    notes: row.notes ?? '',
  }
}

export function resolutionLoginSet(rows: DesignGapResolution[]): Set<string> {
  return new Set(rows.map((r) => r.talentLogin.toLowerCase()))
}

export async function listDesignGapResolutions(): Promise<DesignGapResolution[]> {
  if (!isTauri || !supabase) return []
  const { data, error } = await supabase
    .from('design_gap_resolutions')
    .select(SELECT)
    .eq('organization_id', DEFAULT_ORG_ID)
    .order('resolved_at', { ascending: false })
  if (error) throw new Error(formatSupabaseError(error))
  if (!data) return []
  return (data as ResolutionRow[]).map(mapRow)
}

export async function markDesignGapResolved(input: {
  talentLogin: string
  talentId?: string
  displayName?: string
}): Promise<DesignGapResolution> {
  const client = requireClient()
  const login = input.talentLogin.trim().toLowerCase()
  if (!login) throw new Error('Falta el login del talento.')

  const { data: auth } = await client.auth.getUser()
  const actor = await currentActorMeta()
  const talentId = await resolveTalentId(client, login, input.talentId)
  const payload = {
    organization_id: DEFAULT_ORG_ID,
    talent_login: login,
    talent_id: talentId,
    resolved_at: new Date().toISOString(),
    resolved_by: auth.user?.id ?? null,
    resolved_by_login: actor.actorLogin ?? null,
  }

  await clearDesignGapIgnore(client, login)

  const { data, error } = await client
    .from('design_gap_resolutions')
    .upsert(payload, { onConflict: 'organization_id,talent_login' })
    .select(SELECT)
    .single()

  if (error) throw new Error(formatSupabaseError(error))
  if (!data) throw new Error('No se recibió confirmación al guardar la resolución.')

  const row = mapRow(data as ResolutionRow)
  await logActivity(
    'design_gap',
    'resolved',
    {
      talentLogin: login,
      displayName: input.displayName ?? login,
    },
    row.id,
  )
  return row
}

export async function unmarkDesignGapResolved(
  talentLogin: string,
  displayName?: string,
): Promise<void> {
  const client = requireClient()
  const login = talentLogin.trim().toLowerCase()
  if (!login) throw new Error('Falta el login del talento.')

  const { data: existing } = await client
    .from('design_gap_resolutions')
    .select('id')
    .eq('organization_id', DEFAULT_ORG_ID)
    .eq('talent_login', login)
    .maybeSingle()

  const { error } = await client
    .from('design_gap_resolutions')
    .delete()
    .eq('organization_id', DEFAULT_ORG_ID)
    .eq('talent_login', login)

  if (error) throw new Error(formatSupabaseError(error))

  await logActivity(
    'design_gap',
    'unresolved',
    {
      talentLogin: login,
      displayName: displayName ?? login,
    },
    existing?.id ? String(existing.id) : null,
  )
}

export type DesignGapIgnore = {
  id: string
  talentLogin: string
  talentId?: string
  ignoredAt: string
  ignoredByLogin?: string
  notes: string
}

type IgnoreRow = {
  id: string
  talent_login: string
  talent_id: string | null
  ignored_at: string
  ignored_by_login: string | null
  notes: string
}

const IGNORE_SELECT = 'id,talent_login,talent_id,ignored_at,ignored_by_login,notes'

function mapIgnoreRow(row: IgnoreRow): DesignGapIgnore {
  return {
    id: row.id,
    talentLogin: row.talent_login,
    talentId: row.talent_id ?? undefined,
    ignoredAt: row.ignored_at,
    ignoredByLogin: row.ignored_by_login ?? undefined,
    notes: row.notes ?? '',
  }
}

export function ignoreLoginSet(rows: DesignGapIgnore[]): Set<string> {
  return new Set(rows.map((r) => r.talentLogin.toLowerCase()))
}

export async function listDesignGapIgnores(): Promise<DesignGapIgnore[]> {
  if (!isTauri || !supabase) return []
  const { data, error } = await supabase
    .from('design_gap_ignores')
    .select(IGNORE_SELECT)
    .eq('organization_id', DEFAULT_ORG_ID)
    .order('ignored_at', { ascending: false })
  if (error) throw new Error(formatSupabaseError(error))
  if (!data) return []
  return (data as IgnoreRow[]).map(mapIgnoreRow)
}

async function clearDesignGapResolution(client: SupabaseClient<Database>, login: string) {
  await client
    .from('design_gap_resolutions')
    .delete()
    .eq('organization_id', DEFAULT_ORG_ID)
    .eq('talent_login', login)
}

async function clearDesignGapIgnore(client: SupabaseClient<Database>, login: string) {
  await client
    .from('design_gap_ignores')
    .delete()
    .eq('organization_id', DEFAULT_ORG_ID)
    .eq('talent_login', login)
}

export async function markDesignGapIgnored(input: {
  talentLogin: string
  talentId?: string
  displayName?: string
}): Promise<DesignGapIgnore> {
  const client = requireClient()
  const login = input.talentLogin.trim().toLowerCase()
  if (!login) throw new Error('Falta el login del talento.')

  const { data: auth } = await client.auth.getUser()
  const actor = await currentActorMeta()
  const talentId = await resolveTalentId(client, login, input.talentId)
  const payload = {
    organization_id: DEFAULT_ORG_ID,
    talent_login: login,
    talent_id: talentId,
    ignored_at: new Date().toISOString(),
    ignored_by: auth.user?.id ?? null,
    ignored_by_login: actor.actorLogin ?? null,
  }

  await clearDesignGapResolution(client, login)

  const { data, error } = await client
    .from('design_gap_ignores')
    .upsert(payload, { onConflict: 'organization_id,talent_login' })
    .select(IGNORE_SELECT)
    .single()

  if (error) throw new Error(formatSupabaseError(error))
  if (!data) throw new Error('No se recibió confirmación al guardar el ignore.')

  const row = mapIgnoreRow(data as IgnoreRow)
  await logActivity(
    'design_gap',
    'ignored',
    {
      talentLogin: login,
      displayName: input.displayName ?? login,
    },
    row.id,
  )
  return row
}

export async function unmarkDesignGapIgnored(
  talentLogin: string,
  displayName?: string,
): Promise<void> {
  const client = requireClient()
  const login = talentLogin.trim().toLowerCase()
  if (!login) throw new Error('Falta el login del talento.')

  const { data: existing } = await client
    .from('design_gap_ignores')
    .select('id')
    .eq('organization_id', DEFAULT_ORG_ID)
    .eq('talent_login', login)
    .maybeSingle()

  const { error } = await client
    .from('design_gap_ignores')
    .delete()
    .eq('organization_id', DEFAULT_ORG_ID)
    .eq('talent_login', login)

  if (error) throw new Error(formatSupabaseError(error))

  await logActivity(
    'design_gap',
    'unignored',
    {
      talentLogin: login,
      displayName: displayName ?? login,
    },
    existing?.id ? String(existing.id) : null,
  )
}
