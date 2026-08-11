import { supabase } from '@/services/supabase'
import { DEFAULT_ORG_ID } from '@/services/org'
import { isTauri } from '@/services/twitch'
import type { TwitchAssetKind } from '@/services/twitch-asset-rules'

export const CREATIVE_DRIVE_BUCKET = 'creative-drive'

export type DriveItemKind = 'folder' | 'file'

export type CreativeDriveItem = {
  id: string
  parentId: string | null
  name: string
  path: string
  kind: DriveItemKind
  mimeType?: string
  sizeBytes?: number
  storageBucket?: string
  storagePath?: string
  createdBy?: string
  createdAt: string
  updatedAt: string
  url?: string
  readyForTwitch?: boolean
  assetKind?: TwitchAssetKind
}

type DriveRow = {
  id: string
  parent_id: string | null
  name: string
  path: string
  kind: string
  mime_type: string | null
  size_bytes: number | null
  storage_bucket: string | null
  storage_path: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  ready_for_twitch?: boolean | null
  asset_kind?: string | null
}

const DRIVE_SELECT =
  'id,parent_id,name,path,kind,mime_type,size_bytes,storage_bucket,storage_path,created_by,created_at,updated_at,ready_for_twitch,asset_kind'

function requireClient() {
  if (!isTauri) throw new Error('Diseño gráfico requiere la app de escritorio.')
  if (!supabase) throw new Error('No hay conexión con el almacenamiento en la nube.')
  return supabase
}

function mapKind(raw?: string | null): TwitchAssetKind | undefined {
  if (!raw) return undefined
  if (['offline', 'banner', 'panel', 'overlay', 'thumbnail', 'other'].includes(raw)) {
    return raw as TwitchAssetKind
  }
  return undefined
}

function mapRow(row: DriveRow, url?: string): CreativeDriveItem {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    path: row.path,
    kind: row.kind === 'folder' ? 'folder' : 'file',
    mimeType: row.mime_type ?? undefined,
    sizeBytes: row.size_bytes ?? undefined,
    storageBucket: row.storage_bucket ?? undefined,
    storagePath: row.storage_path ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    url,
    readyForTwitch: Boolean(row.ready_for_twitch),
    assetKind: mapKind(row.asset_kind),
  }
}

function joinPath(parentPath: string, name: string): string {
  const base = parentPath === '/' ? '' : parentPath.replace(/\/+$/, '')
  return `${base}/${name}`.replace(/\/+/g, '/') || `/${name}`
}

export async function listDriveItems(parentId: string | null): Promise<CreativeDriveItem[]> {
  const client = requireClient()
  let query = client
    .from('creative_drive_items')
    .select(DRIVE_SELECT)
    .eq('organization_id', DEFAULT_ORG_ID)
    .is('deleted_at', null)
    .order('kind', { ascending: true })
    .order('name', { ascending: true })

  query = parentId == null ? query.is('parent_id', null) : query.eq('parent_id', parentId)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as unknown as DriveRow[]
  return Promise.all(rows.map(async (row) => {
    if (row.kind === 'file' && row.storage_path) {
      const signed = await client.storage
        .from(CREATIVE_DRIVE_BUCKET)
        .createSignedUrl(row.storage_path, 3600)
      return mapRow(row, signed.data?.signedUrl)
    }
    return mapRow(row)
  }))
}

/** Listado plano (sin URLs firmadas) para huecos / briefs. */
export async function listAllDriveItems(): Promise<CreativeDriveItem[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('creative_drive_items')
    .select(DRIVE_SELECT)
    .eq('organization_id', DEFAULT_ORG_ID)
    .is('deleted_at', null)
    .order('path', { ascending: true })
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as DriveRow[]).map((row) => mapRow(row))
}

export async function getDriveItem(id: string): Promise<CreativeDriveItem | null> {
  const client = requireClient()
  const { data, error } = await client
    .from('creative_drive_items')
    .select(DRIVE_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapRow(data as unknown as DriveRow)
}

/** Cadena de ancestros desde la raíz hasta el ítem (para deep-link). */
export async function getDriveBreadcrumbs(folderId: string): Promise<CreativeDriveItem[]> {
  const chain: CreativeDriveItem[] = []
  let currentId: string | null = folderId
  const guard = new Set<string>()
  while (currentId) {
    if (guard.has(currentId)) break
    guard.add(currentId)
    const item = await getDriveItem(currentId)
    if (!item) break
    chain.unshift(item)
    currentId = item.parentId
  }
  return chain
}

export async function createDriveFolder(name: string, parentId: string | null, parentPath = '/'): Promise<CreativeDriveItem> {
  const client = requireClient()
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Escribe un nombre para la carpeta.')
  const path = joinPath(parentPath, trimmed)
  const { data, error } = await client
    .from('creative_drive_items')
    .insert({
      organization_id: DEFAULT_ORG_ID,
      parent_id: parentId,
      name: trimmed,
      path,
      kind: 'folder',
    })
    .select(DRIVE_SELECT)
    .single()
  if (error) {
    if (error.code === '23505') throw new Error('Ya existe una carpeta o archivo con ese nombre aquí.')
    throw new Error(error.message)
  }
  return mapRow(data as unknown as DriveRow)
}

export async function uploadDriveFile(
  file: File,
  parentId: string | null,
  parentPath = '/',
  opts?: { assetKind?: TwitchAssetKind; readyForTwitch?: boolean },
): Promise<CreativeDriveItem> {
  const client = requireClient()
  const id = crypto.randomUUID()
  const storagePath = `${DEFAULT_ORG_ID}/${id}/${file.name}`
  const path = joinPath(parentPath, file.name)

  const { error: uploadError } = await client.storage
    .from(CREATIVE_DRIVE_BUCKET)
    .upload(storagePath, file, {
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    })
  if (uploadError) throw new Error(uploadError.message)

  const { data, error } = await client
    .from('creative_drive_items')
    .insert({
      id,
      organization_id: DEFAULT_ORG_ID,
      parent_id: parentId,
      name: file.name,
      path,
      kind: 'file',
      mime_type: file.type || null,
      size_bytes: file.size,
      storage_bucket: CREATIVE_DRIVE_BUCKET,
      storage_path: storagePath,
      asset_kind: opts?.assetKind ?? null,
      ready_for_twitch: opts?.readyForTwitch ?? false,
    })
    .select(DRIVE_SELECT)
    .single()

  if (error) {
    await client.storage.from(CREATIVE_DRIVE_BUCKET).remove([storagePath])
    if (error.code === '23505') throw new Error('Ya existe un archivo con ese nombre aquí.')
    throw new Error(error.message)
  }

  const signed = await client.storage.from(CREATIVE_DRIVE_BUCKET).createSignedUrl(storagePath, 3600)
  return mapRow(data as unknown as DriveRow, signed.data?.signedUrl)
}

export async function renameDriveItem(id: string, name: string): Promise<CreativeDriveItem> {
  const client = requireClient()
  const trimmed = name.trim()
  if (!trimmed) throw new Error('El nombre no puede estar vacío.')

  const current = await getDriveItem(id)
  if (!current) throw new Error('No se encontró el archivo o carpeta.')

  const parentPath = current.path.includes('/')
    ? current.path.slice(0, current.path.lastIndexOf('/')) || '/'
    : '/'
  const nextPath = joinPath(parentPath === '' ? '/' : parentPath, trimmed)

  const { data, error } = await client
    .from('creative_drive_items')
    .update({ name: trimmed, path: nextPath })
    .eq('id', id)
    .is('deleted_at', null)
    .select(DRIVE_SELECT)
    .single()
  if (error) {
    if (error.code === '23505') throw new Error('Ya existe otro elemento con ese nombre.')
    throw new Error(error.message)
  }
  return mapRow(data as unknown as DriveRow, current.url)
}

export async function setDriveReadyForTwitch(
  id: string,
  ready: boolean,
  assetKind?: TwitchAssetKind | null,
): Promise<CreativeDriveItem> {
  const client = requireClient()
  const patch: Record<string, unknown> = { ready_for_twitch: ready }
  if (assetKind !== undefined) patch.asset_kind = assetKind
  const { data, error } = await client
    .from('creative_drive_items')
    .update(patch)
    .eq('id', id)
    .eq('kind', 'file')
    .is('deleted_at', null)
    .select(DRIVE_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapRow(data as unknown as DriveRow)
}

export async function setDriveAssetKind(id: string, assetKind: TwitchAssetKind | null): Promise<CreativeDriveItem> {
  const client = requireClient()
  const { data, error } = await client
    .from('creative_drive_items')
    .update({ asset_kind: assetKind })
    .eq('id', id)
    .eq('kind', 'file')
    .is('deleted_at', null)
    .select(DRIVE_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapRow(data as unknown as DriveRow)
}

/** Soft-delete en metadata; borra el objeto de Storage si es archivo. */
export async function deleteDriveItem(id: string, hard = false): Promise<void> {
  const client = requireClient()
  const current = await getDriveItem(id)
  if (!current) return

  if (hard && current.kind === 'file' && current.storagePath) {
    await client.storage.from(CREATIVE_DRIVE_BUCKET).remove([current.storagePath])
  }

  if (hard) {
    const { error } = await client.from('creative_drive_items').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return
  }

  const { error } = await client
    .from('creative_drive_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export function formatDriveSize(bytes?: number): string {
  if (bytes == null || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Busca carpeta raíz del talento por login o display name. */
export function findTalentRootFolder(
  items: CreativeDriveItem[],
  login: string,
  displayName?: string,
): CreativeDriveItem | undefined {
  const roots = items.filter((i) => i.kind === 'folder' && i.parentId == null)
  const loginLower = login.toLowerCase()
  const byLogin = roots.find((f) => f.name.toLowerCase() === loginLower)
  if (byLogin) return byLogin
  if (displayName) {
    const dn = displayName.toLowerCase()
    const byName = roots.find((f) => f.name.toLowerCase() === dn)
    if (byName) return byName
  }
  return roots.find((f) => f.name.toLowerCase().includes(loginLower))
}
