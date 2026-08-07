import { invoke } from '@tauri-apps/api/core'
import { supabase } from '@/services/supabase'
import { DEFAULT_ORG_ID } from '@/services/org'
import { isTauri } from '@/services/twitch'

export const ASSETS_BUCKET = 'agency-assets'

export type AgencyAsset = {
  id: string
  title: string
  description?: string
  storageBucket?: string
  storagePath?: string
  fileName?: string
  mimeType?: string
  sizeBytes?: number
  tags: string[]
  externalUrl?: string
  talentId?: string
  talentLogin?: string
  dealId?: string
  taskId?: string
  url?: string
  createdAt: string
}

function requireTauri() {
  if (!isTauri) throw new Error('Este módulo requiere la app de escritorio con sesión de Twitch.')
}

export async function listAgencyAssets(tag?: string): Promise<AgencyAsset[]> {
  requireTauri()
  return invoke<AgencyAsset[]>('list_agency_assets', { tag: tag ?? null })
}

export async function saveAgencyAssetMeta(input: {
  id?: string
  title: string
  description?: string
  storageBucket?: string
  storagePath?: string
  fileName?: string
  mimeType?: string
  sizeBytes?: number
  tags?: string[]
  externalUrl?: string
  talentId?: string
  dealId?: string
  taskId?: string
}): Promise<AgencyAsset> {
  requireTauri()
  return invoke<AgencyAsset>('save_agency_asset', {
    id: input.id ?? null,
    title: input.title,
    description: input.description ?? null,
    storageBucket: input.storageBucket ?? null,
    storagePath: input.storagePath ?? null,
    fileName: input.fileName ?? null,
    mimeType: input.mimeType ?? null,
    sizeBytes: input.sizeBytes ?? null,
    tags: input.tags ?? [],
    externalUrl: input.externalUrl ?? null,
    talentId: input.talentId ?? null,
    dealId: input.dealId ?? null,
    taskId: input.taskId ?? null,
  })
}

export async function deleteAgencyAsset(id: string): Promise<void> {
  requireTauri()
  return invoke('delete_agency_asset', { id })
}

export async function uploadAgencyAssetFile(file: File, meta: {
  title: string
  description?: string
  tags?: string[]
  talentId?: string
  dealId?: string
  taskId?: string
}): Promise<AgencyAsset | null> {
  if (!supabase) return null
  const path = `${DEFAULT_ORG_ID}/${Date.now()}-${file.name}`
  const { error: uploadError } = await supabase.storage.from(ASSETS_BUCKET).upload(path, file, { upsert: false })
  if (uploadError) throw new Error(uploadError.message)
  return saveAgencyAssetMeta({
    title: meta.title,
    description: meta.description,
    storageBucket: ASSETS_BUCKET,
    storagePath: path,
    fileName: file.name,
    mimeType: file.type || undefined,
    sizeBytes: file.size,
    tags: meta.tags ?? [],
    talentId: meta.talentId,
    dealId: meta.dealId,
    taskId: meta.taskId,
  })
}

export async function createLinkAsset(input: {
  title: string
  externalUrl: string
  description?: string
  tags?: string[]
  talentId?: string
  dealId?: string
  taskId?: string
}): Promise<AgencyAsset> {
  return saveAgencyAssetMeta(input)
}

export async function signedAssetUrl(storagePath: string): Promise<string | undefined> {
  if (!supabase) return undefined
  const { data } = await supabase.storage.from(ASSETS_BUCKET).createSignedUrl(storagePath, 3600)
  return data?.signedUrl
}

export const COMMON_ASSET_TAGS = ['overlay', 'logo', 'brief', 'contrato', 'marca', 'obs', 'thumbnail', 'video'] as const
