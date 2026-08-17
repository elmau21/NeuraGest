import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import {
  Cloud,
  Download,
  ExternalLink,
  File as FileIcon,
  Folder,
  FolderLock,
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
  categoryRootPath,
  createDocumentDriveFolder,
  deleteDocumentDriveItem,
  DOCUMENT_DRIVE_CATEGORIES,
  formatDriveSize,
  getDocumentDriveItem,
  isPdfItem,
  listDocumentDriveItems,
  logDocumentDriveActivity,
  renameDocumentDriveItem,
  ROOT_FOLDER_META,
  uploadDocumentDriveFile,
  type DocumentDriveCategory,
  type DocumentDriveItem,
} from '@/services/document-drive'
import { logContractActivity } from '@/services/audit'
import { listAppUsers } from '@/services/app-users'
import { canCreateDocumentDriveFolder, canMutate } from '@/services/permissions'
import { useAuthStore } from '@/stores/auth-store'
import { toastError, toastSuccess } from '@/stores/toast-store'

type Crumb =
  | { type: 'root'; name: string }
  | { type: 'category'; category: DocumentDriveCategory; name: string; path: string }
  | { type: 'folder'; category: DocumentDriveCategory; id: string; name: string; path: string }

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

export function DocumentDrive() {
  const roles = useAuthStore((s) => s.roles)
  const session = useAuthStore((s) => s.session)
  const readonly = !canMutate(roles, session?.login)
  const canCreateFolder = canCreateDocumentDriveFolder(roles, session?.login)
  const fileRef = useRef<HTMLInputElement>(null)
  const isFirstLoad = useRef(true)

  const [crumbs, setCrumbs] = useState<Crumb[]>([{ type: 'root', name: 'Archivos' }])
  const [items, setItems] = useState<DocumentDriveItem[]>([])
  const [localItems, setLocalItems] = useState<LocalContract[]>(localContracts)
  const [loading, setLoading] = useState(true)
  const [contentFaded, setContentFaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
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

  const current = crumbs[crumbs.length - 1]
  const inCategory = current.type !== 'root'
  const category = current.type === 'category' || current.type === 'folder' ? current.category : null
  const parentId = current.type === 'folder' ? current.id : null
  const parentPath = current.type === 'root' ? '/' : current.path

  const fetchItems = useCallback(async () => {
    if (!category) {
      setItems([])
      return
    }
    const [rows, users, remote] = await Promise.all([
      listDocumentDriveItems(category, parentId),
      listAppUsers().catch(() => []),
      category === 'Contratos' && parentId == null
        ? loadRemoteContractUrls().then(mergeLocalContracts)
        : Promise.resolve(localItems),
    ])
    setItems(rows)
    if (category === 'Contratos' && parentId == null) setLocalItems(remote)
    const names: Record<string, string> = {}
    for (const u of users) {
      names[u.id] = u.displayName?.trim() || (u.twitchLogin ? `@${u.twitchLogin}` : u.id.slice(0, 8))
    }
    setUploaderNames(names)
  }, [category, parentId])

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
    if (category !== 'Contratos' || parentId != null) return items
    const cloudNames = new Set(items.map((i) => (i.fileName ?? i.title).toLowerCase()))
    const locals = localItems
      .filter((c) => !cloudNames.has(c.fileName.toLowerCase()))
      .map(localToDriveItem)
    return [...items, ...locals].sort((a, b) => a.title.localeCompare(b.title, 'es'))
  }, [category, parentId, items, localItems])

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
    setPreview(null)
    setQuery('')
    setCrumbs([
      { type: 'root', name: 'Archivos' },
      { type: 'category', category: cat, name: ROOT_FOLDER_META[cat].label, path: categoryRootPath(cat) },
    ])
  }

  const openFolder = (item: DocumentDriveItem) => {
    if (!category) return
    setPreview(null)
    setCrumbs((prev) => [
      ...prev,
      { type: 'folder', category, id: item.id, name: item.title, path: item.path },
    ])
  }

  const goCrumb = (index: number) => {
    setPreview(null)
    setCrumbs((prev) => prev.slice(0, index + 1))
  }

  const selectFile = (item: DocumentDriveItem) => {
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
        if (target.isLocal && category === 'Contratos') {
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
        if (category) {
          void logDocumentDriveActivity('viewed', target.fileName ?? target.title, category, target.id)
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
    if (!category || readonly) return
    setBusy(true)
    setError(null)
    try {
      for (const file of list) {
        await uploadDocumentDriveFile(file, category, parentId, parentPath)
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
    if (readonly || !inCategory) return
    const list = [...fileList]
    if (list.length === 0) return
    void uploadList(list)
  }

  const createFolder = async () => {
    if (!canCreateFolder || !category || !folderName.trim()) return
    setBusy(true)
    try {
      await createDocumentDriveFolder(folderName, category, parentId, parentPath)
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
  const previewCategoryLabel = category ? ROOT_FOLDER_META[category].label : 'Documento'
  const showPdfSplit = Boolean(
    preview &&
    previewUrl &&
    (preview.kind === 'local' || isPdfItem(preview.item)),
  )

  useEffect(() => {
    setPreviewError(false)
  }, [previewUrl])

  const onPreviewIframeError = () => {
    setPreviewError(true)
    toastError('No se pudo cargar la vista previa del PDF')
  }

  const isSelected = (item: DocumentDriveItem) =>
    (preview?.kind === 'drive' && preview.item.id === item.id)
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
        {inCategory && (
          <label className="contract-search">
            <Search size={15} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={category === 'Contratos' ? 'Buscar contrato o talento…' : 'Buscar archivo…'}
            />
          </label>
        )}
        <div className="doc-drive-actions">
          <button className="secondary" disabled={loading || busy} onClick={() => void reload()} title="Actualizar">
            <RefreshCw size={16} />
          </button>
          {inCategory && (
            <>
              {canCreateFolder && (
                <button
                  className="secondary"
                  disabled={busy}
                  title="Nueva carpeta"
                  onClick={() => setFolderOpen(true)}
                >
                  <FolderPlus size={16} /> Nueva carpeta
                </button>
              )}
              <button
                className="primary"
                disabled={readonly || busy}
                title={readonly ? 'Solo lectura' : undefined}
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={16} /> Subir
              </button>
            </>
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
      <nav className="cd-breadcrumb" aria-label="Ruta de carpetas">
        {crumbs.map((crumb, index) => {
          const isCurrent = index === crumbs.length - 1
          return (
            <span key={`${crumb.type}-${index}`} className="cd-crumb">
              {index > 0 && <span className="cd-crumb-sep" aria-hidden>/</span>}
              <button
                type="button"
                className={[index === 0 ? 'is-root' : undefined, isCurrent ? 'is-current' : undefined].filter(Boolean).join(' ') || undefined}
                onClick={() => goCrumb(index)}
                aria-current={isCurrent ? 'location' : undefined}
              >
                {crumb.name}
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
                placeholder="Subcarpeta…"
              />
            </label>
            <div className="agency-modal-actions">
              <button className="secondary" onClick={() => setFolderOpen(false)}>Cancelar</button>
              <button className="primary" disabled={busy || !folderName.trim()} onClick={() => void createFolder()}>Crear</button>
            </div>
          </div>
        </div>
  ) : null

  const driveAlerts = (
    <>
      {readonly && inCategory && (
        <p className="integration-note staff-readonly-banner">Modo solo lectura: puedes ver y descargar, pero no subir ni borrar.</p>
      )}
      {error && <p className="integration-note">{error}</p>}
    </>
  )

  const renderSplitList = () => {
    if (loading) return <p className="empty-state">Cargando…</p>
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
        </div>
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
          <button
            key={item.id}
            type="button"
            className={isSelected(item) ? 'selected' : undefined}
            onClick={() => selectFile(item)}
          >
            <span className="pdf-icon">PDF</span>
            <span>
              <b title={item.title}>{item.title}</b>
              <small>{fileMeta(item)}</small>
            </span>
          </button>
        ))}
      </>
    )
  }

  const renderGridContent = () => {
    if (loading) return <p className="empty-state">Cargando…</p>
    if (current.type === 'root') {
      return (
        <div className="cd-grid">
          {DOCUMENT_DRIVE_CATEGORIES.map((cat) => (
            <article key={cat} className="cd-tile is-folder">
              <button type="button" className="cd-tile-main" onClick={() => openCategory(cat)}>
                {cat === 'Contratos' ? <FolderLock size={28} /> : <Folder size={28} />}
                <b>{ROOT_FOLDER_META[cat].label}</b>
                <small>{ROOT_FOLDER_META[cat].hint}</small>
              </button>
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
          <article key={item.id} className="cd-tile is-folder">
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
            className={`cd-tile${isSelected(item) ? ' is-selected' : ''}`}
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
    onDragEnter: (e: DragEvent) => { e.preventDefault(); if (!readonly && inCategory) setDragging(true) },
    onDragOver: (e: DragEvent) => e.preventDefault(),
    onDragLeave: () => setDragging(false),
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      setDragging(false)
      if (!readonly && inCategory && e.dataTransfer.files.length) onUploadFiles(e.dataTransfer.files)
    },
  }

  const drivePanel = (
    <>
      {driveToolbar}
      {driveAlerts}
      {driveBreadcrumb}

      <div
        className={`card cd-dropzone doc-drive-zone${inCategory ? ' doc-drive-full' : ''}${dragging ? ' is-dragging' : ''}`}
        {...dropHandlers}
      >
        <div className={`doc-drive-scroll cd-fade-surface${contentFaded ? ' is-faded' : ''}`}>
          {renderGridContent()}
        </div>
        {dragging && !readonly && inCategory && <div className="cd-drop-hint">Suelta para subir</div>}
      </div>

      {folderModal}
    </>
  )

  if (showPdfSplit) {
    return (
      <div className="contracts-layout doc-drive-split">
        <div className="card contracts-panel doc-drive-panel">
          {driveToolbar}
          {driveAlerts}
          {driveBreadcrumb}
          {!loading && filteredItems.length > 0 && (
            <p className="contracts-count">{filteredItems.length} {filteredItems.length === 1 ? 'elemento' : 'elementos'}</p>
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
                } else if (preview?.kind === 'drive' && category) {
                  void logDocumentDriveActivity('downloaded', preview.item.fileName ?? preview.item.title, category, preview.item.id)
                }
              }}
            >
              <Download size={15} />Descargar
            </a>
          </div>
          {previewError ? (
            <div className="contract-empty">
              <FileIcon size={28} />
              <span>No se pudo cargar la vista previa.</span>
              <a className="secondary" href={previewUrl!} target="_blank" rel="noreferrer">
                <ExternalLink size={14} /> Abrir en navegador
              </a>
            </div>
          ) : (
            <iframe
              src={previewUrl!}
              title={`Vista previa de ${previewTitle}`}
              onError={onPreviewIframeError}
            />
          )}
        </div>
      </div>
    )
  }

  return drivePanel
}

export function documentDriveFileCount(): number {
  return localContracts.length
}
