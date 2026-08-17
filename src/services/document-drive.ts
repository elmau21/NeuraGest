import { supabase } from '@/services/supabase'
import { DEFAULT_ORG_ID } from '@/services/org'
import { logActivity } from '@/services/activity-log'
import { formatDriveSize } from '@/services/creative-drive'

export const DOCUMENT_DRIVE_CATEGORIES = ['Contratos', 'Directivas', 'Extras'] as const
export type DocumentDriveCategory = (typeof DOCUMENT_DRIVE_CATEGORIES)[number]

/** Categoría interna para carpetas raíz personalizadas y su contenido. */
export const ROOT_CUSTOM_CATEGORY = 'Root' as const
export type DocumentDriveStorageCategory = DocumentDriveCategory | typeof ROOT_CUSTOM_CATEGORY

export const CONTRACTS_BUCKET = 'contratos'
export const ORG_DOCUMENTS_BUCKET = 'org-documents'

export type DocumentDriveItemKind = 'folder' | 'file'

export type DocumentDriveItem = {
  id: string
  parentId: string | null
  category: DocumentDriveStorageCategory
  title: string
  path: string
  kind: DocumentDriveItemKind
  fileName?: string
  mimeType?: string
  sizeBytes?: number
  storageBucket?: string
  storagePath?: string
  createdBy?: string
  createdAt: string
  updatedAt: string
  url?: string
  isLocal?: boolean
  localUrl?: string
  talentLogin?: string
  isRootCustom?: boolean
}

type DocumentRow = {
  id: string
  parent_id: string | null
  category: string
  title: string
  path: string
  kind: string
  file_name: string | null
  mime_type: string | null
  size_bytes: number | null
  storage_bucket: string | null
  storage_path: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  is_root_custom: boolean | null
}

const DRIVE_SELECT =
  'id,parent_id,category,title,path,kind,file_name,mime_type,size_bytes,storage_bucket,storage_path,created_by,created_at,updated_at,is_root_custom'

function requireClient() {
  if (!supabase) throw new Error('No hay conexión con el almacenamiento en la nube.')
  return supabase
}

function bucketForCategory(category: DocumentDriveStorageCategory): string {
  return category === 'Contratos' ? CONTRACTS_BUCKET : ORG_DOCUMENTS_BUCKET
}

function joinPath(parentPath: string, name: string): string {
  const base = parentPath === '/' ? '' : parentPath.replace(/\/+$/, '')
  return `${base}/${name}`.replace(/\/+/g, '/') || `/${name}`
}

function mapRow(row: DocumentRow, url?: string): DocumentDriveItem {
  return {
    id: row.id,
    parentId: row.parent_id,
    category: row.category as DocumentDriveStorageCategory,
    title: row.title,
    path: row.path,
    kind: row.kind === 'folder' ? 'folder' : 'file',
    fileName: row.file_name ?? undefined,
    mimeType: row.mime_type ?? undefined,
    sizeBytes: row.size_bytes ?? undefined,
    storageBucket: row.storage_bucket ?? undefined,
    storagePath: row.storage_path ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    url,
    isRootCustom: row.is_root_custom ?? undefined,
  }
}

export { formatDriveSize }

export async function listRootCustomFolders(): Promise<DocumentDriveItem[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('documents')
    .select(DRIVE_SELECT)
    .eq('organization_id', DEFAULT_ORG_ID)
    .eq('category', ROOT_CUSTOM_CATEGORY)
    .eq('kind', 'folder')
    .eq('is_root_custom', true)
    .is('parent_id', null)
    .is('deleted_at', null)
    .order('title', { ascending: true })
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as DocumentRow[]).map((row) => mapRow(row))
}

export async function listDocumentDriveItems(
  category: DocumentDriveStorageCategory,
  parentId: string | null,
): Promise<DocumentDriveItem[]> {
  const client = requireClient()
  let query = client
    .from('documents')
    .select(DRIVE_SELECT)
    .eq('organization_id', DEFAULT_ORG_ID)
    .eq('category', category)
    .not('kind', 'is', null)
    .is('deleted_at', null)
    .order('kind', { ascending: true })
    .order('title', { ascending: true })

  query = parentId == null ? query.is('parent_id', null) : query.eq('parent_id', parentId)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as unknown as DocumentRow[]
  return Promise.all(rows.map(async (row) => {
    if (row.kind === 'file' && row.storage_path && row.storage_bucket) {
      const { data: signed, error: signError } = await client.storage
        .from(row.storage_bucket)
        .createSignedUrl(row.storage_path, 3600)
      if (signError || !signed?.signedUrl) {
        console.warn('[document-drive] signed URL failed', row.storage_bucket, row.storage_path, signError?.message)
        return mapRow(row)
      }
      return mapRow(row, signed.signedUrl)
    }
    return mapRow(row)
  }))
}

export async function getDocumentDriveItem(id: string): Promise<DocumentDriveItem | null> {
  const client = requireClient()
  const { data, error } = await client
    .from('documents')
    .select(DRIVE_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const row = data as unknown as DocumentRow
  if (row.kind === 'file' && row.storage_path && row.storage_bucket) {
    const { data: signed, error: signError } = await client.storage
      .from(row.storage_bucket)
      .createSignedUrl(row.storage_path, 3600)
    if (signError || !signed?.signedUrl) {
      console.warn('[document-drive] signed URL failed', row.storage_bucket, row.storage_path, signError?.message)
      return mapRow(row)
    }
    return mapRow(row, signed.signedUrl)
  }
  return mapRow(row)
}

export async function createDocumentDriveFolder(
  name: string,
  category: DocumentDriveStorageCategory,
  parentId: string | null,
  parentPath: string,
): Promise<DocumentDriveItem> {
  const client = requireClient()
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Escribe un nombre para la carpeta.')
  if (isReservedRootFolderName(trimmed)) {
    throw new Error('Ese nombre está reservado para una categoría del sistema.')
  }
  const path = joinPath(parentPath, trimmed)
  const { data, error } = await client
    .from('documents')
    .insert({
      organization_id: DEFAULT_ORG_ID,
      parent_id: parentId,
      category,
      title: trimmed,
      path,
      kind: 'folder',
      is_root_custom: false,
    })
    .select(DRIVE_SELECT)
    .single()
  if (error) {
    if (error.code === '23505') throw new Error('Ya existe una carpeta o archivo con ese nombre aquí.')
    throw new Error(error.message)
  }
  await logDocumentDriveActivity('created_folder', trimmed, category, data.id)
  return mapRow(data as unknown as DocumentRow)
}

export async function createRootCustomFolder(name: string): Promise<DocumentDriveItem> {
  const client = requireClient()
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Escribe un nombre para la carpeta.')
  if (isReservedRootFolderName(trimmed)) {
    throw new Error('Ese nombre está reservado para una categoría del sistema.')
  }
  const path = joinPath('/', trimmed)
  const { data, error } = await client
    .from('documents')
    .insert({
      organization_id: DEFAULT_ORG_ID,
      parent_id: null,
      category: ROOT_CUSTOM_CATEGORY,
      title: trimmed,
      path,
      kind: 'folder',
      is_root_custom: true,
    })
    .select(DRIVE_SELECT)
    .single()
  if (error) {
    if (error.code === '23505') throw new Error('Ya existe una carpeta con ese nombre en la raíz.')
    throw new Error(error.message)
  }
  await logDocumentDriveActivity('created_folder', trimmed, ROOT_CUSTOM_CATEGORY, data.id)
  return mapRow(data as unknown as DocumentRow)
}

export async function uploadDocumentDriveFile(
  file: File,
  category: DocumentDriveStorageCategory,
  parentId: string | null,
  parentPath: string,
): Promise<DocumentDriveItem> {
  const client = requireClient()
  const id = crypto.randomUUID()
  const bucket = bucketForCategory(category)
  const storagePath = category === 'Contratos'
    ? `${DEFAULT_ORG_ID}/${id}/${file.name}`
    : `${DEFAULT_ORG_ID}/${id}/${file.name}`
  const path = joinPath(parentPath, file.name)
  const title = file.name.replace(/\.[^.]+$/, '').replaceAll('_', ' ').trim() || file.name

  const { error: uploadError } = await client.storage
    .from(bucket)
    .upload(storagePath, file, {
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    })
  if (uploadError) throw new Error(uploadError.message)

  const { data, error } = await client
    .from('documents')
    .insert({
      id,
      organization_id: DEFAULT_ORG_ID,
      parent_id: parentId,
      category,
      title,
      file_name: file.name,
      path,
      kind: 'file',
      mime_type: file.type || null,
      size_bytes: file.size,
      storage_bucket: bucket,
      storage_path: storagePath,
    })
    .select(DRIVE_SELECT)
    .single()

  if (error) {
    await client.storage.from(bucket).remove([storagePath])
    if (error.code === '23505') throw new Error('Ya existe un archivo con ese nombre aquí.')
    throw new Error(error.message)
  }

  const { data: signed, error: signError } = await client.storage.from(bucket).createSignedUrl(storagePath, 3600)
  if (signError || !signed?.signedUrl) {
    console.warn('[document-drive] signed URL failed after upload', bucket, storagePath, signError?.message)
  }
  await logDocumentDriveActivity('uploaded', file.name, category, id)
  return mapRow(data as unknown as DocumentRow, signed?.signedUrl)
}

export async function renameDocumentDriveItem(id: string, title: string): Promise<DocumentDriveItem> {
  const client = requireClient()
  const trimmed = title.trim()
  if (!trimmed) throw new Error('El nombre no puede estar vacío.')

  const current = await getDocumentDriveItem(id)
  if (!current) throw new Error('No se encontró el archivo o carpeta.')

  const parentPath = current.path.includes('/')
    ? current.path.slice(0, current.path.lastIndexOf('/')) || '/'
    : '/'
  const nextPath = joinPath(parentPath === '' ? '/' : parentPath, trimmed)

  const patch: { title: string; path: string; file_name?: string } = {
    title: trimmed,
    path: nextPath,
  }
  if (current.kind === 'file') {
    patch.file_name = trimmed.includes('.') ? trimmed : current.fileName
  }

  const { data, error } = await client
    .from('documents')
    .update(patch)
    .eq('id', id)
    .is('deleted_at', null)
    .select(DRIVE_SELECT)
    .single()
  if (error) {
    if (error.code === '23505') throw new Error('Ya existe otro elemento con ese nombre.')
    throw new Error(error.message)
  }
  await logDocumentDriveActivity('renamed', trimmed, current.category, id)
  return mapRow(data as unknown as DocumentRow, current.url)
}

export async function deleteDocumentDriveItem(id: string): Promise<void> {
  const client = requireClient()
  const current = await getDocumentDriveItem(id)
  if (!current) return

  if (current.kind === 'file' && current.storagePath && current.storageBucket) {
    await client.storage.from(current.storageBucket).remove([current.storagePath])
  }

  const { error } = await client
    .from('documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  await logDocumentDriveActivity('deleted', current.title, current.category, id)
}

export async function logDocumentDriveActivity(
  action: 'uploaded' | 'deleted' | 'renamed' | 'created_folder' | 'viewed' | 'downloaded',
  name: string,
  category: DocumentDriveStorageCategory,
  entityId?: string,
): Promise<void> {
  const entityType = category === 'Contratos' ? 'contract' : 'document'
  await logActivity(entityType, action, { title: name, fileName: name, category }, entityId ?? null)
}

export function isReservedRootFolderName(name: string): boolean {
  const normalized = name.trim().toLowerCase()
  return DOCUMENT_DRIVE_CATEGORIES.some((cat) => cat.toLowerCase() === normalized)
}

export function isCustomRootFolder(item: DocumentDriveItem): boolean {
  return item.kind === 'folder' && item.isRootCustom === true
}

export function isPdfItem(item: DocumentDriveItem): boolean {
  const name = item.fileName ?? item.title
  return item.mimeType === 'application/pdf' || /\.pdf$/i.test(name)
}

export function categoryRootPath(category: DocumentDriveCategory): string {
  return `/${category}`
}

export const ROOT_FOLDER_META: Record<DocumentDriveCategory, { label: string; hint: string }> = {
  Contratos: { label: 'Contratos', hint: 'Acuerdos y contratos de talento' },
  Directivas: { label: 'Directivas', hint: 'Políticas internas y normas' },
  Extras: { label: 'Extras', hint: 'Otros documentos del equipo' },
}
