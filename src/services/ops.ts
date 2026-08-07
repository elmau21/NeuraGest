import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '@/services/twitch'

export type BrandRestrictionKind = 'exclusivity' | 'blackout'
export type CommissionStatus = 'forecast' | 'accrued' | 'paid'

export type ClipRecord = {
  id: string
  talentId: string
  talentLogin?: string
  twitchClipId: string
  title?: string
  url?: string
  thumbnailUrl?: string
  viewCount: number
  publishedAt?: string
}

export type BrandRestriction = {
  id: string
  talentId: string
  talentLogin?: string
  kind: BrandRestrictionKind
  brandName: string
  blockedCategories: string[]
  startsAt?: string
  endsAt?: string
  notes?: string
}

export type CommissionEntry = {
  id: string
  dealId?: string
  talentId?: string
  talentLogin?: string
  label: string
  periodMonth: string
  grossAmount: number
  agencyRatePct: number
  agencyAmount: number
  talentAmount: number
  status: CommissionStatus
  notes?: string
}

export type CalendarEventOps = {
  id: string
  title: string
  eventType: string
  startsAt: string
  endsAt: string
  talentId?: string
  talentLogin?: string
}

function requireTauri() {
  if (!isTauri) throw new Error('Este módulo requiere la app de escritorio con sesión de Twitch.')
}

export async function listClips(limit = 50): Promise<ClipRecord[]> {
  requireTauri()
  return invoke<ClipRecord[]>('list_clips', { limit })
}

export async function listBrandRestrictions(): Promise<BrandRestriction[]> {
  requireTauri()
  return invoke<BrandRestriction[]>('list_brand_restrictions')
}

export async function saveBrandRestriction(input: {
  id?: string
  talentId: string
  kind: BrandRestrictionKind
  brandName: string
  blockedCategories?: string[]
  startsAt?: string
  endsAt?: string
  notes?: string
}): Promise<BrandRestriction> {
  requireTauri()
  return invoke<BrandRestriction>('save_brand_restriction', {
    id: input.id ?? null,
    talentId: input.talentId,
    kind: input.kind,
    brandName: input.brandName,
    blockedCategories: input.blockedCategories ?? [],
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    notes: input.notes ?? null,
  })
}

export async function deleteBrandRestriction(id: string): Promise<void> {
  requireTauri()
  return invoke('delete_brand_restriction', { id })
}

export async function listCommissionEntries(month?: string): Promise<CommissionEntry[]> {
  requireTauri()
  return invoke<CommissionEntry[]>('list_commission_entries', { month: month ?? null })
}

export async function saveCommissionEntry(input: {
  id?: string
  dealId?: string
  talentId?: string
  label: string
  periodMonth: string
  grossAmount: number
  agencyRatePct: number
  status: CommissionStatus
  notes?: string
}): Promise<CommissionEntry> {
  requireTauri()
  return invoke<CommissionEntry>('save_commission_entry', {
    id: input.id ?? null,
    dealId: input.dealId ?? null,
    talentId: input.talentId ?? null,
    label: input.label,
    periodMonth: input.periodMonth,
    grossAmount: input.grossAmount,
    agencyRatePct: input.agencyRatePct,
    status: input.status,
    notes: input.notes ?? null,
  })
}

export async function deleteCommissionEntry(id: string): Promise<void> {
  requireTauri()
  return invoke('delete_commission_entry', { id })
}

export async function listCalendarEventsOps(): Promise<CalendarEventOps[]> {
  requireTauri()
  return invoke<CalendarEventOps[]>('list_calendar_events_ops')
}

export const RESTRICTION_KIND_LABELS: Record<BrandRestrictionKind, string> = {
  exclusivity: 'Exclusividad',
  blackout: 'Blackout',
}

export const COMMISSION_STATUS_LABELS: Record<CommissionStatus, string> = {
  forecast: 'Forecast',
  accrued: 'Devengado',
  paid: 'Pagado',
}
