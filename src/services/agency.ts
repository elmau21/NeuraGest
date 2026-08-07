import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '@/services/twitch'

export type TalentManagerRecord = {
  id: string
  talentId: string
  talentLogin: string
  talentDisplayName: string
  managerAppUserId: string
  managerLogin: string
  managerDisplayName?: string
  assignedAt: string
}

export type PipelineStatus = 'idea' | 'editing' | 'published'
export type ContentType = 'clip' | 'vod' | 'highlight'

export type PipelineItem = {
  id: string
  talentId?: string
  talentLogin?: string
  title: string
  description?: string
  status: PipelineStatus
  contentType: ContentType
  url?: string
  position: number
  createdAt: string
  updatedAt: string
}

export type SponsorshipStatus = 'lead' | 'negotiating' | 'active' | 'completed' | 'cancelled'

export type SponsorshipDeal = {
  id: string
  brandName: string
  talentId?: string
  talentLogin?: string
  dealValue?: number
  currency: string
  deliverables?: string
  startDate?: string
  endDate?: string
  progressPercent: number
  status: SponsorshipStatus
  taskId?: string
  calendarEventId?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export type OnboardingItem = {
  id: string
  talentId: string
  talentLogin: string
  title: string
  description?: string
  position: number
  completed: boolean
  completedAt?: string
}

export type DbTalent = {
  id: string
  login: string
  displayName: string
  avatarUrl?: string
}

function requireTauri() {
  if (!isTauri) throw new Error('Este módulo requiere la app de escritorio con sesión de Twitch.')
}

export async function listTalentManagers(): Promise<TalentManagerRecord[]> {
  requireTauri()
  return invoke<TalentManagerRecord[]>('list_talent_managers')
}

export async function assignTalentManager(talentId: string, managerAppUserId: string): Promise<TalentManagerRecord> {
  requireTauri()
  return invoke<TalentManagerRecord>('assign_talent_manager', { talentId, managerAppUserId })
}

export async function removeTalentManager(id: string): Promise<void> {
  requireTauri()
  return invoke('remove_talent_manager', { id })
}

export async function listPipelineItems(): Promise<PipelineItem[]> {
  requireTauri()
  return invoke<PipelineItem[]>('list_pipeline_items')
}

export async function savePipelineItem(input: {
  id?: string
  talentId?: string
  title: string
  description?: string
  status: PipelineStatus
  contentType: ContentType
  url?: string
  position?: number
}): Promise<PipelineItem> {
  requireTauri()
  return invoke<PipelineItem>('save_pipeline_item', {
    id: input.id ?? null,
    talentId: input.talentId ?? null,
    title: input.title,
    description: input.description ?? null,
    status: input.status,
    contentType: input.contentType,
    url: input.url ?? null,
    position: input.position ?? null,
  })
}

export async function updatePipelineStatus(id: string, status: PipelineStatus): Promise<PipelineItem> {
  requireTauri()
  return invoke<PipelineItem>('update_pipeline_status', { id, status })
}

export async function deletePipelineItem(id: string): Promise<void> {
  requireTauri()
  return invoke('delete_pipeline_item', { id })
}

export async function listSponsorshipDeals(): Promise<SponsorshipDeal[]> {
  requireTauri()
  return invoke<SponsorshipDeal[]>('list_sponsorship_deals')
}

export async function saveSponsorshipDeal(input: {
  id?: string
  brandName: string
  talentId?: string
  dealValue?: number
  currency?: string
  deliverables?: string
  startDate?: string
  endDate?: string
  progressPercent: number
  status: SponsorshipStatus
  taskId?: string
  calendarEventId?: string
  notes?: string
}): Promise<SponsorshipDeal> {
  requireTauri()
  return invoke<SponsorshipDeal>('save_sponsorship_deal', {
    id: input.id ?? null,
    brandName: input.brandName,
    talentId: input.talentId ?? null,
    dealValue: input.dealValue ?? null,
    currency: input.currency ?? null,
    deliverables: input.deliverables ?? null,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    progressPercent: input.progressPercent,
    status: input.status,
    taskId: input.taskId ?? null,
    calendarEventId: input.calendarEventId ?? null,
    notes: input.notes ?? null,
  })
}

export async function deleteSponsorshipDeal(id: string): Promise<void> {
  requireTauri()
  return invoke('delete_sponsorship_deal', { id })
}

export async function listOnboardingItems(talentId?: string): Promise<OnboardingItem[]> {
  requireTauri()
  return invoke<OnboardingItem[]>('list_onboarding_items', { talentId: talentId ?? null })
}

export async function seedTalentOnboarding(talentId: string): Promise<OnboardingItem[]> {
  requireTauri()
  return invoke<OnboardingItem[]>('seed_talent_onboarding', { talentId })
}

export async function toggleOnboardingItem(id: string, completed: boolean): Promise<OnboardingItem> {
  requireTauri()
  return invoke<OnboardingItem>('toggle_onboarding_item', { id, completed })
}

export async function listDbTalents(): Promise<DbTalent[]> {
  requireTauri()
  const rows = await invoke<Array<{ id: string; login: string; display_name: string; avatar_url?: string }>>('list_db_talents')
  return rows.map((row) => ({
    id: row.id,
    login: row.login,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
  }))
}

export function onboardingProgress(items: OnboardingItem[]): number {
  if (items.length === 0) return 0
  const done = items.filter((item) => item.completed).length
  return Math.round((done / items.length) * 100)
}

export const PIPELINE_COLUMNS: { id: PipelineStatus; title: string }[] = [
  { id: 'idea', title: 'Idea' },
  { id: 'editing', title: 'Editando' },
  { id: 'published', title: 'Publicado' },
]

export const SPONSORSHIP_STATUS_LABELS: Record<SponsorshipStatus, string> = {
  lead: 'Prospecto',
  negotiating: 'Negociación',
  active: 'Activo',
  completed: 'Cerrado',
  cancelled: 'Cancelado',
}

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  clip: 'Clip',
  vod: 'VOD',
  highlight: 'Highlight',
}
