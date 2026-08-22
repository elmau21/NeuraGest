import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import {
  Cloud,
  Download,
  ExternalLink,
  File as FileIcon,
  Folder,
  FolderLock,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  UserRound,
} from '@/components/icons'
import {
  localContracts,
  loadRemoteContractUrls,
  mergeLocalContracts,
  type LocalContract,
} from '@/features/documents/contracts-data'
import {
  buildPdfPreviewSrc,
  probeDocumentPreview,
  type DocumentPreviewMode,
} from '@/features/documents/document-preview-utils'
import {
  categoryRootPath,
  createDocumentDriveFolder,
  createRootCustomFolder,
  deleteDocumentDriveItem,
  DOCUMENT_DRIVE_CATEGORIES,
  formatDriveSize,
  getDocumentDriveItem,
  isPdfItem,
  listDocumentDriveItems,
  listRootCustomFolders,
  logDocumentDriveActivity,
  renameDocumentDriveItem,
  ROOT_CUSTOM_CATEGORY,
  ROOT_FOLDER_META,
  uploadDocumentDriveFile,
  type DocumentDriveCategory,
  type DocumentDriveItem,
  type DocumentDriveStorageCategory,
} from '@/services/document-drive'
import { logContractActivity } from '@/services/audit'
import { listAppUsers } from '@/services/app-users'
import { canAccessContratos, canCreateDocumentDriveFolder, canMutate, getContratosDenial } from '@/services/permissions'
import { trackRecentDocument } from '@/services/offline-cache'
import { useAuthStore } from '@/stores/auth-store'
import { toastError, toastSuccess } from '@/stores/toast-store'
import { EmptyState } from '@/components/EmptyState'
import { PermissionGate } from '@/components/PermissionGate'
import { DismissibleHint } from '@/components/DismissibleHint'
import { RowActionMenu } from '@/components/RowActionMenu'

type Crumb =
  | { type: 'root'; name: string }
  | { type: 'category'; category: DocumentDriveCategory; name: string; path: string }
  | { type: 'customRoot'; id: string; name: string; path: string }
  | { type: 'folder'; category: DocumentDriveStorageCategory; id: string; name: string; path: string }

type PreviewTarget =
  | { kind: 'local'; contract: LocalContract }
  | { kind: 'drive'; item: DocumentDriveItem }

const FADE_MS = 180
const ACCEPT =
  'application/pdf,.pdf,application/msword,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,image/png,.png,image/jpeg,.jpg,.jpeg,image/webp,.webp,image/gif,.gif,text/plain,.txt'

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function localToDriveItem(contract: LocalContract): DocumentDriveItem {
  return {
    id: contract.id,
    parentId: null,
    category: 'Contratos',
    title: contract.title,
    path: `/Contratos/${contract.fileName}`,
    kind: 'file',
    fileName: contract.fileName,
    mimeType: 'application/pdf',
    createdAt: '',
    updatedAt: '',
    isLocal: true,
    localUrl: contract.localUrl,
    url: contract.remoteUrl ?? contract.localUrl,
    talentLogin: contract.talent?.login,
  }
}

async function crumbsForDriveItem(item: DocumentDriveItem): Promise<Crumb[]> {
  const ancestors: DocumentDriveItem[] = []
  let cursor: DocumentDriveItem | null = item
  while (cursor?.parentId) {
    const parent = await getDocumentDriveItem(cursor.parentId)
    if (!parent) break
    ancestors.unshift(parent)
    cursor = parent
  }

  const crumbs: Crumb[] = [{ type: 'root', name: 'Archivos' }]

  if (item.category === ROOT_CUSTOM_CATEGORY || item.isRootCustom) {
    const customRoot =
      ancestors.find((row) => row.isRootCustom || (row.category === ROOT_CUSTOM_CATEGORY && row.parentId == null))
      ?? (item.category === ROOT_CUSTOM_CATEGORY && item.parentId == null ? item : null)
    if (customRoot) {
      crumbs.push({ type: 'customRoot', id: customRoot.id, name: customRoot.title, path: customRoot.path })
      for (const folder of ancestors.filter((row) => row.id !== customRoot.id && row.kind === 'folder')) {
        crumbs.push({
          type: 'folder',
          category: ROOT_CUSTOM_CATEGORY,
          id: folder.id,
          name: folder.title,
          path: folder.path,
        })
      }
      if (item.kind === 'folder' && item.id !== customRoot.id) {
        crumbs.push({
          type: 'folder',
          category: ROOT_CUSTOM_CATEGORY,
          id: item.id,
          name: item.title,
          path: item.path,
        })
      }
    }
    return crumbs
  }

  const category = item.category as DocumentDriveCategory
  if (!DOCUMENT_DRIVE_CATEGORIES.includes(category)) return crumbs

  crumbs.push({
    type: 'category',
    category,
    name: ROOT_FOLDER_META[category].label,
    path: categoryRootPath(category),
  })
  for (const folder of ancestors.filter((row) => row.kind === 'folder')) {
    crumbs.push({ type: 'folder', category, id: folder.id, name: folder.title, path: folder.path })
  }
  if (item.kind === 'folder') {
    crumbs.push({ type: 'folder', category, id: item.id, name: item.title, path: item.path })
  }
  return crumbs
}

type DocumentDriveProps = {
  deepDoc?: string | null
  deepFolder?: string | null
  deepCategory?: string | null
  onDeepLinkHandled?: () => void
}

export function DocumentDrive({
  deepDoc = null,
  deepFolder = null,
  deepCategory = null,
  onDeepLinkHandled,
}: DocumentDriveProps) {
  const roles = useAuthStore((s) => s.roles)
  const session = useAuthStore((s) => s.session)
  const readonly = !canMutate(roles, session?.login)
  const canCreateFolder = canCreateDocumentDriveFolder(roles, session?.login)
  const canAccessContracts = canAccessContratos(roles, session?.login)
  const fileRef = useRef<HTMLInputElement>(null)
  const isFirstLoad = useRef(true)

  const [crumbs, setCrumbs] = useState<Crumb[]>([{ type: 'root', name: 'Archivos' }])
  const [items, setItems] = useState<DocumentDriveItem[]>([])
  const [rootCustomFolders, setRootCustomFolders] = useState<DocumentDriveItem[]>([])
  const [localItems, setLocalItems] = useState<LocalContract[]>([])
  const [loading, setLoading] = useState(true)
  const [contentFaded, setContentFaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contratosBlocked, setContratosBlocked] = useState(false)
  const [query, setQuery] = useState('')
  const [uploaderNames, setUploaderNames] = useState<Record<string, string>>({})
  const [folderOpen, setFolderOpen] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<PreviewTarget | null>(null)
  const [previewError, setPreviewError] = useState(false)
  const [previewMode, setPreviewMode] = useState<DocumentPreviewMode>('loading')
  const [previewHtml, setPreviewHtml] = useState('')
  const [highlightedId, setHighlightedId] = useState<string | null>(null)

  const current = crumbs[crumbs.length - 1]
  const atRoot = current.type === 'root'
  const inDrive = current.type !== 'root'
  const driveCategory: DocumentDriveStorageCategory | null =
    current.type === 'category'
      ? current.category
      : current.type === 'customRoot'
        ? ROOT_CUSTOM_CATEGORY
        : current.type === 'folder'
          ? current.category
          : null
  const parentId =
    current.type === 'folder' || current.type === 'customRoot' ? current.id : null
  const parentPath = current.type === 'root' ? '/' : current.path

  const visibleCategories = useMemo(
    () => DOCUMENT_DRIVE_CATEGORIES.filter((cat) => cat !== 'Contratos' || canAccessContracts),
    [canAccessContracts],
  )

  useEffect(() => {
    if (driveCategory === 'Contratos' && !canAccessContracts) {
      setContratosBlocked(true)
      setPreview(null)
      setQuery('')
      setCrumbs([{ type: 'root', name: 'Archivos' }])
    }
  }, [driveCategory, canAccessContracts])

  const fetchItems = useCallback(async () => {
    if (atRoot) {
      const [roots, users] = await Promise.all([
        listRootCustomFolders(),
        listAppUsers().catch(() => []),
      ])
      setRootCustomFolders(roots)
      setItems([])
      const names: Record<string, string> = {}
      for (const u of users) {
        names[u.id] = u.displayName?.trim() || (u.twitchLogin ? `@${u.twitchLogin}` : u.id.slice(0, 8))
      }
      setUploaderNames(names)
      return
    }
    if (!driveCategory) {
      setItems([])
      return
    }
    if (driveCategory === 'Contratos' && !canAccessContracts) {
      setItems([])
      setLocalItems([])
      return
    }
    const [rows, users, remote] = await Promise.all([
      listDocumentDriveItems(driveCategory, parentId),
      listAppUsers().catch(() => []),
      driveCategory === 'Contratos' && parentId == null
        ? loadRemoteContractUrls().then(mergeLocalContracts)
        : Promise.resolve(null),
    ])
    setItems(rows)
    if (remote) setLocalItems(remote)
    const names: Record<string, string> = {}
    for (const u of users) {
      names[u.id] = u.displayName?.trim() || (u.twitchLogin ? `@${u.twitchLogin}` : u.id.slice(0, 8))
    }
    setUploaderNames(names)
  }, [atRoot, driveCategory, parentId, canAccessContracts])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await fetchItems()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      setContentFaded(false)
    }
  }, [fetchItems])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const shouldFade = !isFirstLoad.current && !prefersReducedMotion()
      isFirstLoad.current = false
      if (shouldFade) {
        setContentFaded(true)
        await sleep(FADE_MS)
        if (cancelled) return
      } else {
        setLoading(true)
      }
      setError(null)
      try {
        await fetchItems()
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (cancelled) return
        setLoading(false)
        requestAnimationFrame(() => {
          if (!cancelled) setContentFaded(false)
        })
      }
    })()
    return () => { cancelled = true }
  }, [current, fetchItems])

  const mergedItems = useMemo(() => {
    if (driveCategory !== 'Contratos' || parentId != null) return items
    const cloudNames = new Set(items.map((i) => (i.fileName ?? i.title).toLowerCase()))
    const locals = localItems
      .filter((c) => !cloudNames.has(c.fileName.toLowerCase()))
      .map(localToDriveItem)
    return [...items, ...locals].sort((a, b) => a.title.localeCompare(b.title, 'es'))
  }, [driveCategory, parentId, items, localItems])

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return mergedItems
    return mergedItems.filter((item) =>
      `${item.title} ${item.fileName ?? ''} ${item.talentLogin ?? ''}`.toLowerCase().includes(q),
    )
  }, [mergedItems, query])

  const folders = useMemo(() => filteredItems.filter((i) => i.kind === 'folder'), [filteredItems])
  const files = useMemo(() => filteredItems.filter((i) => i.kind === 'file'), [filteredItems])

  const openCategory = (cat: DocumentDriveCategory) => {
    if (cat === 'Contratos' && !canAccessContracts) {
      setContratosBlocked(true)
      return
    }
    setContratosBlocked(false)
    setPreview(null)
    setQuery('')
    setCrumbs([
      { type: 'root', name: 'Archivos' },
      { type: 'category', category: cat, name: ROOT_FOLDER_META[cat].label, path: categoryRootPath(cat) },
    ])
  }

  const openCustomRootFolder = (item: DocumentDriveItem) => {
    setContratosBlocked(false)
    setPreview(null)
    setQuery('')
    setCrumbs([
      { type: 'root', name: 'Archivos' },
      { type: 'customRoot', id: item.id, name: item.title, path: item.path },
    ])
  }

  const openFolder = (item: DocumentDriveItem) => {
    if (!driveCategory) return
    trackRecentDocument({ id: item.id, title: item.title, path: item.path, category: driveCategory })
    setPreview(null)
    setCrumbs((prev) => [
      ...prev,
      { type: 'folder', category: driveCategory, id: item.id, name: item.title, path: item.path },
    ])
  }

  const goCrumb = (index: number) => {
    setPreview(null)
    setContratosBlocked(false)
    setCrumbs((prev) => prev.slice(0, index + 1))
  }

  const selectFile = (item: DocumentDriveItem) => {
    trackRecentDocument({ id: item.id, title: item.title, path: item.path, category: driveCategory ?? undefined })
    void (async () => {
      let target = item

      if (!item.isLocal && item.kind === 'file' && !item.url) {
        try {
          const fresh = await getDocumentDriveItem(item.id)
          if (fresh?.url) target = fresh
        } catch {
          /* fall through to error toast */
        }
      }

      if (isPdfItem(target)) {
        if (target.isLocal && driveCategory === 'Contratos') {
          const contract = localItems.find((c) => c.id === target.id)
          if (contract) {
            setPreviewError(false)
            setPreview({ kind: 'local', contract })
            void logContractActivity('viewed', contract.fileName, contract.talent?.login)
            return
          }
        }
        if (!target.url) {
          toastError('No se pudo obtener el enlace del PDF')
          return
        }
        setPreviewError(false)
        setPreview({ kind: 'drive', item: target })
        if (driveCategory) {
          void logDocumentDriveActivity('viewed', target.fileName ?? target.title, driveCategory, target.id)
        }
        return
      }

      if (target.url) {
        window.open(target.url, '_blank', 'noopener,noreferrer')
      } else {
        toastError('No se pudo abrir el archivo')
      }
    })()
  }

  const uploadList = async (list: File[]) => {
    if (!driveCategory || readonly) return
    setBusy(true)
    setError(null)
    try {
      for (const file of list) {
        await uploadDocumentDriveFile(file, driveCategory, parentId, parentPath)
      }
      toastSuccess(list.length === 1 ? 'Archivo subido' : `${list.length} archivos subidos`)
      await reload()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      toastError('No se pudo subir')
    } finally {
      setBusy(false)
    }
  }

  const onUploadFiles = (fileList: FileList | File[]) => {
    if (readonly || !inDrive) return
    const list = [...fileList]
    if (list.length === 0) return
    void uploadList(list)
  }

  const createFolder = async () => {
    if (!canCreateFolder || !folderName.trim()) return
    setBusy(true)
    try {
      if (atRoot) {
        await createRootCustomFolder(folderName)
      } else if (driveCategory) {
        await createDocumentDriveFolder(folderName, driveCategory, parentId, parentPath)
      } else {
        return
      }
      setFolderOpen(false)
      setFolderName('')
      toastSuccess('Carpeta creada')
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo crear la carpeta')
    } finally {
      setBusy(false)
    }
  }

  const startRename = (item: DocumentDriveItem) => {
    if (item.isLocal) return
    setRenamingId(item.id)
    setRenameValue(item.kind === 'folder' ? item.title : (item.fileName ?? item.title))
  }

  const commitRename = async () => {
    if (!renamingId || readonly) return
    setBusy(true)
    try {
      await renameDocumentDriveItem(renamingId, renameValue)
      setRenamingId(null)
      toastSuccess('Nombre actualizado')
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo renombrar')
    } finally {
      setBusy(false)
    }
  }

  const removeItem = async (item: DocumentDriveItem) => {
    if (readonly || item.isLocal) return
    const label = item.kind === 'folder' ? 'carpeta' : 'archivo'
    const ok = window.confirm(`¿Eliminar ${label} «${item.title}»?\nEsta acción no se puede deshacer.`)
    if (!ok) return
    setBusy(true)
    try {
      await deleteDocumentDriveItem(item.id)
      if (preview?.kind === 'drive' && preview.item.id === item.id) setPreview(null)
      toastSuccess(item.kind === 'folder' ? 'Carpeta eliminada' : 'Archivo eliminado')
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo eliminar')
    } finally {
      setBusy(false)
    }
  }

  const downloadItem = (item: DocumentDriveItem) => {
    void (async () => {
      let target = item
      if (!item.isLocal && !item.url) {
        try {
          const fresh = await getDocumentDriveItem(item.id)
          if (fresh) target = fresh
        } catch { /* ignore */ }
      }
      const url = target.isLocal ? target.localUrl : target.url
      if (!url) {
        toastError('No se pudo descargar el archivo')
        return
      }
      window.open(url, '_blank', 'noopener,noreferrer')
      if (driveCategory) {
        void logDocumentDriveActivity('downloaded', target.fileName ?? target.title, driveCategory, target.id)
      }
    })()
  }

  const renderFileActions = (item: DocumentDriveItem) => (
    <RowActionMenu
      actions={[
        { id: 'open', label: 'Abrir', onClick: () => selectFile(item) },
        { id: 'download', label: 'Descargar', onClick: () => downloadItem(item) },
        {
          id: 'delete',
          label: 'Eliminar',
          danger: true,
          hidden: readonly || item.isLocal,
          onClick: () => void removeItem(item),
        },
      ]}
    />
  )

  useEffect(() => {
    if (!deepDoc && !deepFolder && !deepCategory) return
    let cancelled = false
    void (async () => {
      try {
        if (
          deepCategory
          && DOCUMENT_DRIVE_CATEGORIES.includes(deepCategory as DocumentDriveCategory)
        ) {
          if (deepCategory === 'Contratos' && !canAccessContracts) return
          openCategory(deepCategory as DocumentDriveCategory)
          onDeepLinkHandled?.()
          return
        }
        const targetId = deepDoc ?? deepFolder
        if (!targetId) return
        const item = await getDocumentDriveItem(targetId)
        if (!item || cancelled) return
        const nextCrumbs = await crumbsForDriveItem(item)
        if (cancelled) return
        setCrumbs(nextCrumbs)
        setHighlightedId(item.id)
        if (item.kind === 'file') selectFile(item)
        onDeepLinkHandled?.()
      } catch {
        if (!cancelled) toastError('No se pudo abrir el archivo o carpeta del enlace')
      }
    })()
    return () => { cancelled = true }
  }, [deepDoc, deepFolder, deepCategory, canAccessContracts, onDeepLinkHandled])

  const previewUrl = preview
    ? preview.kind === 'local'
      ? preview.contract.remoteUrl ?? preview.contract.localUrl
      : preview.item.url
    : null
  const previewTitle = preview
    ? preview.kind === 'local' ? preview.contract.title : preview.item.title
    : ''
  const previewFileName = preview
    ? preview.kind === 'local' ? preview.contract.fileName : (preview.item.fileName ?? preview.item.title)
    : ''
  const previewCategoryLabel = (() => {
    if (driveCategory === ROOT_CUSTOM_CATEGORY) {
      const customCrumb = crumbs.find((c) => c.type === 'customRoot')
      return customCrumb?.name ?? 'Carpeta'
    }
    if (driveCategory) {
      return ROOT_FOLDER_META[driveCategory].label
    }
    return 'Documento'
  })()
  const inContratos = driveCategory === 'Contratos' && canAccessContracts && inDrive
  const showContractsLayout = inContratos
  const showPdfPreview = Boolean(
    preview &&
    previewUrl &&
    (preview.kind === 'local' || isPdfItem(preview.item)),
  )

  useEffect(() => {
    setPreviewError(false)
    setPreviewMode('loading')
    setPreviewHtml('')
    if (!previewUrl) return

    let cancelled = false
    void probeDocumentPreview(previewUrl, previewFileName).then((result) => {
      if (cancelled) return
      setPreviewMode(result.mode)
      if (result.mode === 'html' && result.html) setPreviewHtml(result.html)
    })

    return () => {
      cancelled = true
    }
  }, [previewUrl, previewFileName])

  const onPreviewIframeError = () => {
    setPreviewError(true)
    toastError('No se pudo cargar la vista previa del PDF')
  }

  const isSelected = (item: DocumentDriveItem) =>
    highlightedId === item.id
    || (preview?.kind === 'drive' && preview.item.id === item.id)
    || (preview?.kind === 'local' && preview.contract.id === item.id)

  const fileMeta = (item: DocumentDriveItem) => {
    if (item.isLocal) {
      const contract = localItems.find((c) => c.id === item.id)
      const inCloud = Boolean(contract?.remotePath)
      return (
        <>
          {item.talentLogin ? <><UserRound size={11} />@{item.talentLogin} · </> : null}
          <span className={inCloud ? 'storage-status remote' : 'storage-status local'}>
            {inCloud ? <><Cloud size={10} /> en la nube</> : <><HardDrive size={10} /> solo local</>}
          </span>
        </>
      )
    }
    return (
      <>
        {formatDriveSize(item.sizeBytes)}
        {item.createdBy && uploaderNames[item.createdBy] ? ` · ${uploaderNames[item.createdBy]}` : ''}
      </>
    )
  }

  const driveToolbar = (
      <div className="doc-drive-toolbar">
        {inDrive && (
          <div className="contract-search doc-drive-search" role="search">
            <Search size={15} aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={driveCategory === 'Contratos' ? 'Buscar contrato o talento…' : 'Buscar archivo…'}
              aria-label={driveCategory === 'Contratos' ? 'Buscar contrato o talento' : 'Buscar archivo'}
            />
          </div>
        )}
        <div className="doc-drive-actions">
          <button className="secondary ghost-btn" disabled={loading || busy} onClick={() => void reload()} title="Actualizar lista">
            <RefreshCw size={16} /> Actualizar
          </button>
          {canCreateFolder && (atRoot || inDrive) && (
            <button
              className="secondary"
              disabled={busy}
              title="Nueva carpeta"
              onClick={() => setFolderOpen(true)}
            >
              <FolderPlus size={16} /> Nueva carpeta
            </button>
          )}
          {inDrive && (
            <button
              className="primary"
              disabled={readonly || busy}
              title={readonly ? 'Solo lectura' : undefined}
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={16} /> Subir
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          hidden
          multiple
          accept={ACCEPT}
          onChange={(e) => {
            const next = e.target.files
            if (next) onUploadFiles(next)
            e.target.value = ''
          }}
        />
      </div>
  )

  const driveBreadcrumb = (
      <nav className="cd-breadcrumb" aria-label="Ubicación actual">
        {crumbs.map((crumb, index) => {
          const isCurrent = index === crumbs.length - 1
          const isRoot = index === 0
          return (
            <span key={`${crumb.type}-${index}`} className="cd-crumb">
              {index > 0 && <span className="cd-crumb-sep" aria-hidden>/</span>}
              <button
                type="button"
                className={[isRoot ? 'is-root' : undefined, isCurrent ? 'is-current' : undefined].filter(Boolean).join(' ') || undefined}
                onClick={() => goCrumb(index)}
                aria-current={isCurrent ? 'location' : undefined}
              >
                {isRoot ? <><FolderOpen size={13} aria-hidden /> {crumb.name}</> : crumb.name}
              </button>
            </span>
          )
        })}
      </nav>
  )

  const folderModal = folderOpen ? (
        <div className="modal-backdrop" onClick={() => setFolderOpen(false)}>
          <div className="agency-modal card" onClick={(e) => e.stopPropagation()}>
            <h3><FolderPlus size={16} /> Carpeta nueva</h3>
            <label>
              Nombre
              <input
                autoFocus
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void createFolder() }}
                placeholder={atRoot ? 'Carpeta en la raíz…' : 'Subcarpeta…'}
              />
            </label>
            <div className="agency-modal-actions">
              <button className="secondary" onClick={() => setFolderOpen(false)}>Cancelar</button>
              <button className="primary" disabled={busy || !folderName.trim()} onClick={() => void createFolder()}>Crear</button>
            </div>
          </div>
        </div>
  ) : null

  const rootFolderHint = canAccessContracts
    ? 'Directivas, Extras o Contratos'
    : 'Directivas o Extras'

  const driveAlerts = (
    <>
      {contratosBlocked && (
        <PermissionGate allowed={false} denial={getContratosDenial()}>
          <></>
        </PermissionGate>
      )}
      {canCreateFolder && current.type === 'root' && (
        <p className="integration-note">
          Abre {rootFolderHint} para crear subcarpetas y subir archivos. El botón «Nueva carpeta» aparece dentro de cada categoría.
        </p>
      )}
      {readonly && inDrive && (
        <p className="integration-note staff-readonly-banner">Modo solo lectura: puedes ver y descargar, pero no subir ni borrar.</p>
      )}
      {error && <p className="integration-note">{error}</p>}
    </>
  )

  const renderSplitList = () => {
    if (loading) {
      const label = driveCategory === 'Contratos' ? 'Cargando contratos…' : 'Cargando documentos…'
      return <p className="empty-state is-loading">{label}</p>
    }
    if (filteredItems.length === 0) {
      const isContratosRoot = driveCategory === 'Contratos' && parentId == null
      return (
        <EmptyState
          icon={isContratosRoot ? FolderLock : Folder}
          title={isContratosRoot ? 'Sin contratos' : 'Esta carpeta está vacía'}
          description={
            isContratosRoot
              ? 'No hay contratos que coincidan con la búsqueda o aún no se han cargado.'
              : canCreateFolder
                ? 'Crea una subcarpeta o arrastra archivos aquí.'
                : readonly
                  ? 'Cuando el equipo suba archivos, aparecerán aquí.'
                  : 'Arrastra archivos aquí o usa Subir.'
          }
        >
          {canCreateFolder ? (
            <button className="secondary" disabled={busy} onClick={() => setFolderOpen(true)}>
              <FolderPlus size={16} /> Nueva carpeta
            </button>
          ) : null}
          {!readonly ? (
            <button className="primary" onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> Subir archivo
            </button>
          ) : null}
        </EmptyState>
      )
    }
    return (
      <>
        {folders.map((item) => (
          <button
            key={item.id}
            type="button"
            className="is-folder"
            onClick={() => openFolder(item)}
          >
            <span><Folder size={18} /></span>
            <span>
              <b>{item.title}</b>
              <small>Carpeta{item.createdBy && uploaderNames[item.createdBy] ? ` · ${uploaderNames[item.createdBy]}` : ''}</small>
            </span>
          </button>
        ))}
        {files.map((item) => (
          <div
            key={item.id}
            className={`cd-file-row${isSelected(item) ? ' selected' : ''}`}
          >
            <button
              type="button"
              className="cd-file-row-main"
              onClick={() => selectFile(item)}
            >
              <span className="pdf-icon">PDF</span>
              <span>
                <b title={item.title}>{item.title}</b>
                <small>{fileMeta(item)}</small>
              </span>
            </button>
            {renderFileActions(item)}
          </div>
        ))}
      </>
    )
  }

  const renderGridContent = () => {
    if (loading) {
      const label = driveCategory === 'Contratos' ? 'Cargando contratos…' : 'Cargando documentos…'
      return <p className="empty-state is-loading">{label}</p>
    }
    if (current.type === 'root') {
      return (
        <div className="cd-grid">
          {visibleCategories.map((cat) => (
            <article key={cat} className="cd-tile glass-card is-folder">
              <button type="button" className="cd-tile-main" onClick={() => openCategory(cat)}>
                {cat === 'Contratos' ? <FolderLock size={28} /> : <Folder size={28} />}
                <b>{ROOT_FOLDER_META[cat].label}</b>
                <small>{ROOT_FOLDER_META[cat].hint}</small>
              </button>
            </article>
          ))}
          {rootCustomFolders.map((item) => (
            <article key={item.id} className="cd-tile glass-card is-folder">
              <button type="button" className="cd-tile-main" onClick={() => openCustomRootFolder(item)}>
                <Folder size={28} />
                {renamingId === item.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => void commitRename()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void commitRename()
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                  />
                ) : (
                  <b>{item.title}</b>
                )}
                <small>Carpeta{item.createdBy && uploaderNames[item.createdBy] ? ` · ${uploaderNames[item.createdBy]}` : ''}</small>
              </button>
              {canCreateFolder && (
                <div className="cd-tile-actions">
                  <button type="button" className="icon-btn" title="Renombrar" onClick={() => startRename(item)}><Pencil size={14} /></button>
                  <button type="button" className="icon-btn" title="Eliminar" onClick={() => void removeItem(item)}><Trash2 size={14} /></button>
                </div>
              )}
            </article>
          ))}
        </div>
      )
    }
    if (filteredItems.length === 0) {
      return (
        <div className="cd-empty">
          <Folder size={36} />
          <b>Esta carpeta está vacía</b>
          <span>
            {canCreateFolder
              ? 'Crea una subcarpeta o arrastra archivos aquí.'
              : readonly
                ? 'Cuando el equipo suba archivos, aparecerán aquí.'
                : 'Arrastra archivos aquí o usa Subir.'}
          </span>
          {canCreateFolder && (
            <button className="secondary" disabled={busy} onClick={() => setFolderOpen(true)}>
              <FolderPlus size={16} /> Nueva carpeta
            </button>
          )}
          {!readonly && (
            <button className="primary" onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> Subir archivos
            </button>
          )}
        </div>
      )
    }
    return (
      <div className="cd-grid">
        {folders.map((item) => (
          <article key={item.id} className="cd-tile glass-card is-folder">
            <button type="button" className="cd-tile-main" onClick={() => openFolder(item)}>
              <Folder size={28} />
              {renamingId === item.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => void commitRename()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void commitRename()
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                />
              ) : (
                <b>{item.title}</b>
              )}
              <small>Carpeta{item.createdBy && uploaderNames[item.createdBy] ? ` · ${uploaderNames[item.createdBy]}` : ''}</small>
            </button>
            {!readonly && (
              <div className="cd-tile-actions">
                <button type="button" className="icon-btn" title="Renombrar" onClick={() => startRename(item)}><Pencil size={14} /></button>
                <button type="button" className="icon-btn" title="Eliminar" onClick={() => void removeItem(item)}><Trash2 size={14} /></button>
              </div>
            )}
          </article>
        ))}
        {files.map((item) => (
          <article
            key={item.id}
            className={`cd-tile glass-card${isSelected(item) ? ' is-selected' : ''}`}
          >
            <button type="button" className="cd-tile-main" onClick={() => selectFile(item)}>
              {item.mimeType?.startsWith('image/') && item.url ? (
                <img src={item.url} alt="" className="cd-thumb" />
              ) : isPdfItem(item) ? (
                <span className="pdf-icon">PDF</span>
              ) : (
                <FileIcon size={28} />
              )}
              {renamingId === item.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => void commitRename()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void commitRename()
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                />
              ) : (
                <b title={item.title}>{item.title}</b>
              )}
              <small>{fileMeta(item)}</small>
            </button>
            <div className="cd-tile-actions">
              {item.url && (
                <a
                  className="icon-btn"
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  title="Descargar"
                  download={item.fileName ?? item.title}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download size={14} />
                </a>
              )}
              {!readonly && !item.isLocal && (
                <>
                  <button type="button" className="icon-btn" title="Renombrar" onClick={() => startRename(item)}><Pencil size={14} /></button>
                  <button type="button" className="icon-btn" title="Eliminar" onClick={() => void removeItem(item)}><Trash2 size={14} /></button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    )
  }

  const dropHandlers = {
    onDragEnter: (e: DragEvent) => { e.preventDefault(); if (!readonly && inDrive) setDragging(true) },
    onDragOver: (e: DragEvent) => e.preventDefault(),
    onDragLeave: () => setDragging(false),
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      setDragging(false)
      if (!readonly && inDrive && e.dataTransfer.files.length) onUploadFiles(e.dataTransfer.files)
    },
  }

  const drivePanel = (
    <>
      {driveToolbar}
      {driveAlerts}
      {driveBreadcrumb}

      <div
        className={`glass-card cd-dropzone doc-drive-zone${inDrive ? ' doc-drive-full' : ''}${dragging ? ' is-dragging' : ''}`}
        {...dropHandlers}
      >
        <div className={`doc-drive-scroll cd-fade-surface${contentFaded ? ' is-faded' : ''}`}>
          {renderGridContent()}
        </div>
        {dragging && !readonly && inDrive && <div className="cd-drop-hint">Suelta para subir</div>}
      </div>

      {folderModal}
    </>
  )

  if (showContractsLayout) {
    return (
      <div className="contracts-layout doc-drive-split">
        <div className="card contracts-panel doc-drive-panel">
          {driveToolbar}
          {driveAlerts}
          <DismissibleHint storageKey="ng-hint-doc-preview">
            Haz clic en una fila para ver la vista previa del PDF.
          </DismissibleHint>
          {driveBreadcrumb}
          {!loading && (
            <p className="contracts-count">
              {filteredItems.length} {filteredItems.length === 1 ? 'elemento' : 'elementos'}
            </p>
          )}
          <div
            className={`doc-drive-list-scroll doc-drive-scroll cd-fade-surface${contentFaded ? ' is-faded' : ''}${dragging ? ' is-dragging' : ''}`}
            {...dropHandlers}
          >
            <div className="contracts-list">
              {renderSplitList()}
            </div>
          </div>
          {folderModal}
        </div>
        <div className="card contract-viewer">
          {showPdfPreview ? (
            <>
              <div className="contract-viewer-head">
                <div>
                  <b>{previewTitle}</b>
                  <span>{previewFileName} · {previewCategoryLabel} / PDF</span>
                </div>
                <a href={previewUrl!} target="_blank" rel="noreferrer"><ExternalLink size={15} />Abrir</a>
                <a
                  href={previewUrl!}
                  download={previewFileName}
                  onClick={() => {
                    if (preview?.kind === 'local') {
                      void logContractActivity('downloaded', preview.contract.fileName, preview.contract.talent?.login)
                    } else if (preview?.kind === 'drive' && driveCategory) {
                      void logDocumentDriveActivity('downloaded', preview.item.fileName ?? preview.item.title, driveCategory, preview.item.id)
                    }
                  }}
                >
                  <Download size={15} />Descargar
                </a>
              </div>
              <div className="contract-viewer-body">
                {previewError ? (
                  <div className="contract-empty">
                    <FileIcon size={28} />
                    <span>No se pudo cargar la vista previa.</span>
                    <a className="secondary" href={previewUrl!} target="_blank" rel="noreferrer">
                      <ExternalLink size={14} /> Abrir en navegador
                    </a>
                  </div>
                ) : previewMode === 'html' && previewHtml ? (
                  <div className="doc-preview-html">
                    <div
                      className="doc-preview-html-inner"
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                  </div>
                ) : previewMode === 'loading' ? (
                  <div className="contract-empty doc-preview-loading">
                    <RefreshCw size={22} />
                    <span>Cargando vista previa…</span>
                  </div>
                ) : (
                  <iframe
                    className="doc-preview-frame"
                    src={buildPdfPreviewSrc(previewUrl!)}
                    title={`Vista previa de ${previewTitle}`}
                    onError={onPreviewIframeError}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="contract-viewer-body">
              <div className="contract-empty">
                <FileIcon size={28} />
                <span>Selecciona un contrato para ver la vista previa</span>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return <div className="doc-drive-page">{drivePanel}</div>
}

export function documentDriveFileCount(includeContracts = true): number {
  return includeContracts ? localContracts.length : 0
}
