import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '@/services/twitch'

export type HelixProfile = {
  id: string
  name: string
  clientId: string
  hasSecret: boolean
}

export type BackfillResult = {
  metricsSnapshots: number
  clipsPersisted: number
  days: number
  note: string
}

export async function backfillMetricsClips(days = 30): Promise<BackfillResult> {
  if (!isTauri) throw new Error('El relleno de datos requiere la app de escritorio.')
  return invoke<BackfillResult>('backfill_metrics_clips', { days })
}

export async function listHelixProfiles(): Promise<HelixProfile[]> {
  if (!isTauri) return []
  return invoke<HelixProfile[]>('list_helix_profiles')
}

export async function getActiveHelixProfile(): Promise<HelixProfile | null> {
  if (!isTauri) return null
  return invoke<HelixProfile | null>('get_active_helix_profile')
}

export async function saveHelixProfile(input: {
  id?: string
  name: string
  clientId: string
  clientSecret?: string
}): Promise<HelixProfile> {
  if (!isTauri) throw new Error('Los perfiles de Twitch requieren la app de escritorio.')
  return invoke<HelixProfile>('save_helix_profile', {
    id: input.id,
    name: input.name,
    clientId: input.clientId,
    clientSecret: input.clientSecret,
  })
}

export async function deleteHelixProfile(id: string): Promise<void> {
  if (!isTauri) return
  await invoke('delete_helix_profile', { id })
}

export async function setActiveHelixProfile(id: string): Promise<void> {
  if (!isTauri) return
  await invoke('set_active_helix_profile', { id })
}
