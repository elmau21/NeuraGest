import { supabase } from '@/services/supabase'
import { DEFAULT_ORG_ID } from '@/services/org'

export type OpsCoverage = {
  id: string
  coverageDate: string
  userId?: string
  login: string
  displayName: string
  notes: string
  updatedAt: string
}

export type OpsDayNote = {
  id: string
  noteDate: string
  body: string
  updatedBy?: string
  updatedByLogin?: string
  updatedAt: string
}

function todayLocalIso(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function opsTodayDate(now = new Date()): string {
  return todayLocalIso(now)
}

function mapCoverage(row: Record<string, unknown>): OpsCoverage {
  return {
    id: String(row.id),
    coverageDate: String(row.coverage_date).slice(0, 10),
    userId: row.user_id ? String(row.user_id) : undefined,
    login: String(row.login ?? ''),
    displayName: String(row.display_name ?? ''),
    notes: String(row.notes ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  }
}

function mapNote(row: Record<string, unknown>): OpsDayNote {
  return {
    id: String(row.id),
    noteDate: String(row.note_date).slice(0, 10),
    body: String(row.body ?? ''),
    updatedBy: row.updated_by ? String(row.updated_by) : undefined,
    updatedByLogin: row.updated_by_login ? String(row.updated_by_login) : undefined,
    updatedAt: String(row.updated_at ?? ''),
  }
}

export async function fetchOpsCoverage(date = opsTodayDate()): Promise<OpsCoverage | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('ops_coverage')
    .select('id,coverage_date,user_id,login,display_name,notes,updated_at')
    .eq('organization_id', DEFAULT_ORG_ID)
    .eq('coverage_date', date)
    .maybeSingle()
  if (error || !data) return null
  return mapCoverage(data as Record<string, unknown>)
}

export async function claimOpsCoverage(input: {
  login: string
  displayName: string
  notes?: string
  date?: string
}): Promise<OpsCoverage | null> {
  if (!supabase) return null
  const date = input.date ?? opsTodayDate()
  const { data: auth } = await supabase.auth.getUser()
  const payload = {
    organization_id: DEFAULT_ORG_ID,
    coverage_date: date,
    user_id: auth.user?.id ?? null,
    login: input.login.trim().toLowerCase(),
    display_name: input.displayName.trim() || input.login,
    notes: input.notes ?? '',
  }
  const { data, error } = await supabase
    .from('ops_coverage')
    .upsert(payload, { onConflict: 'organization_id,coverage_date' })
    .select('id,coverage_date,user_id,login,display_name,notes,updated_at')
    .single()
  if (error || !data) return null
  return mapCoverage(data as Record<string, unknown>)
}

export async function handoffOpsCoverage(input: {
  login: string
  displayName: string
  notes?: string
  date?: string
}): Promise<OpsCoverage | null> {
  return claimOpsCoverage(input)
}

export async function clearOpsCoverage(date = opsTodayDate()): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('ops_coverage')
    .delete()
    .eq('organization_id', DEFAULT_ORG_ID)
    .eq('coverage_date', date)
  return !error
}

export async function fetchOpsDayNote(date = opsTodayDate()): Promise<OpsDayNote | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('ops_day_notes')
    .select('id,note_date,body,updated_by,updated_by_login,updated_at')
    .eq('organization_id', DEFAULT_ORG_ID)
    .eq('note_date', date)
    .maybeSingle()
  if (error || !data) return null
  return mapNote(data as Record<string, unknown>)
}

export async function saveOpsDayNote(input: {
  body: string
  login?: string
  date?: string
}): Promise<OpsDayNote | null> {
  if (!supabase) return null
  const date = input.date ?? opsTodayDate()
  const { data: auth } = await supabase.auth.getUser()
  const payload = {
    organization_id: DEFAULT_ORG_ID,
    note_date: date,
    body: input.body,
    updated_by: auth.user?.id ?? null,
    updated_by_login: input.login ?? null,
  }
  const { data, error } = await supabase
    .from('ops_day_notes')
    .upsert(payload, { onConflict: 'organization_id,note_date' })
    .select('id,note_date,body,updated_by,updated_by_login,updated_at')
    .single()
  if (error || !data) return null
  return mapNote(data as Record<string, unknown>)
}
