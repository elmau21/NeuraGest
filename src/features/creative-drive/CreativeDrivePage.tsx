import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import JSZip from 'jszip'
import {
  BadgeCheck,
  Download,
  File as FileIcon,
  Folder,
  FolderPlus,
  Pencil,
  RefreshCw,
  Trash2,
  Upload,
} from '@/components/icons'
import {
  createDriveFolder,
  deleteDriveItem,
  formatDriveSize,
  getDriveBreadcrumbs,
  listDriveItems,
  renameDriveItem,
  setDriveAssetKind,
  setDriveReadyForTwitch,
  uploadDriveFile,
  validateCreativeDriveUpload,
  type CreativeDriveItem,
} from '@/services/creative-drive'
import {
  CHANNEL_ASSET_SPECS,
  isTwitchReadyCandidate,
  TWITCH_RULES_BLURB,
  type TwitchAssetKind,
} from '@/services/twitch-asset-rules'
import { listAppUsers } from '@/services/app-users'
import { isTauri } from '@/services/twitch'
import { canMutateDesign } from '@/services/permissions'
import { useAuthStore } from '@/stores/auth-store'
import { toastError, toastSuccess } from '@/stores/toast-store'

type Crumb = { id: string | null; name: string; path: string }

const FADE_MS = 180

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function buildZipFileName(folderName: string): string {
  const safe = folderName
    .trim()
    .replace(/[^\w\-áéíóúüñÁÉÍÓÚÜÑ]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'Archivos'
  const d = new Date()
  const stamp = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('')
  return `${safe}-${stamp}.zip`
}

async function filesToZip(files: File[], zipName: string): Promise<File> {
  const zip = new JSZip()
  const used = new Map<string, number>()
  for (const file of files) {
    const base = file.name || 'archivo'
    const n = used.get(base) ?? 0
    used.set(base, n + 1)
    const entry = n === 0 ? base : `${base.replace(/(\.[^.]+)?$/, `-${n}$1`)}`
    zip.file(entry, file)
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  return new File([blob], zipName, { type: 'application/zip' })
}

export function CreativeDrivePage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const roles = useAuthStore((s) => s.roles)
  const session = useAuthStore((s) => s.session)
  const readonly = !canMutateDesign(roles, session?.login)
  const fileRef = useRef<HTMLInputElement>(null)
  const isFirstLoad = useRef(true)
  const folderDeepLinkHandled = useRef(false)

  const [items, setItems] = useState<CreativeDriveItem[]>([])
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ id: null, name: 'Archivos', path: '/' }])
  const [loading, setLoading] = useState(true)
  const [contentFaded, setContentFaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploaderNames, setUploaderNames] = useState<Record<string, string>>({})
  const [folderOpen, setFolderOpen] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null)
  const [readyBusyId, setReadyBusyId] = useState<string | null>(null)

  const current = crumbs[crumbs.length - 1]

  const fetchItems = useCallback(async () => {
    const [rows, users] = await Promise.all([
      listDriveItems(current.id),
      listAppUsers().catch(() => []),
    ])
    setItems(rows)
    const names: Record<string, string> = {}
    for (const u of users) {
      names[u.id] = u.displayName?.trim() || (u.twitchLogin ? `@${u.twitchLogin}` : u.id.slice(0, 8))
    }
    setUploaderNames(names)
  }, [current.id])

  const reload = useCallback(async () => {
    if (!isTauri) return
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
    if (!isTauri) return
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
  }, [current.id, fetchItems])

  useEffect(() => {
    if (!isTauri || folderDeepLinkHandled.current) return
    const folderId = searchParams.get('folder')
    if (!folderId) return
    folderDeepLinkHandled.current = true
    void (async () => {
      try {
        const chain = await getDriveBreadcrumbs(folderId)
        if (chain.length === 0) return
        setCrumbs([
          { id: null, name: 'Archivos', path: '/' },
          ...chain.filter((c) => c.kind === 'folder').map((c) => ({
            id: c.id,
            name: c.name,
            path: c.path,
          })),
        ])
        setSearchParams({}, { replace: true })
      } catch {
        /* ignore deep-link failures */
      }
    })()
  }, [searchParams, setSearchParams])

  const folders = useMemo(() => items.filter((i) => i.kind === 'folder'), [items])
  const files = useMemo(() => items.filter((i) => i.kind === 'file'), [items])

  const openFolder = (item: CreativeDriveItem) => {
    setCrumbs((prev) => [...prev, { id: item.id, name: item.name, path: item.path }])
  }

  const goCrumb = (index: number) => {
    setCrumbs((prev) => prev.slice(0, index + 1))
  }

  const uploadList = async (list: File[], asZip: boolean) => {
    setBusy(true)
    setError(null)
    try {
      if (asZip) {
        const zipName = buildZipFileName(current.name)
        const zipFile = await filesToZip(list, zipName)
        const zipError = validateCreativeDriveUpload(zipFile)
        if (zipError) {
          setError(zipError)
          toastError(zipError)
          return
        }
        await uploadDriveFile(zipFile, current.id, current.path)
        toastSuccess('ZIP subido')
      } else {
        for (const file of list) {
          const uploadError = validateCreativeDriveUpload(file)
          if (uploadError) {
            setError(uploadError)
            toastError(uploadError)
            return
          }
          await uploadDriveFile(file, current.id, current.path)
        }
        toastSuccess(list.length === 1 ? 'Subido' : `${list.length} archivos subidos`)
      }
      await reload()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      toastError(asZip ? 'No se pudo crear o subir el ZIP' : 'No se pudo subir')
    } finally {
      setBusy(false)
    }
  }

  const onUploadFiles = (fileList: FileList | File[]) => {
    if (readonly) return
    const list = [...fileList]
    if (list.length === 0) return
    if (list.length === 1) {
      void uploadList(list, false)
      return
    }
    setPendingFiles(list)
  }

  const confirmZip = () => {
    if (!pendingFiles) return
    const list = pendingFiles
    setPendingFiles(null)
    void uploadList(list, true)
  }

  const confirmSeparate = () => {
    if (!pendingFiles) return
    const list = pendingFiles
    setPendingFiles(null)
    void uploadList(list, false)
  }

  const createFolder = async () => {
    if (readonly || !folderName.trim()) return
    setBusy(true)
    try {
      await createDriveFolder(folderName, current.id, current.path)
      setFolderOpen(false)
      setFolderName('')
      toastSuccess('Carpeta creada')
      await reload()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      toastError('No se pudo crear la carpeta')
    } finally {
      setBusy(false)
    }
  }

  const startRename = (item: CreativeDriveItem) => {
    setRenamingId(item.id)
    setRenameValue(item.name)
  }

  const commitRename = async () => {
    if (!renamingId || readonly) return
    setBusy(true)
    try {
      await renameDriveItem(renamingId, renameValue)
      setRenamingId(null)
      toastSuccess('Nombre actualizado')
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo renombrar')
    } finally {
      setBusy(false)
    }
  }

  const removeItem = async (item: CreativeDriveItem) => {
    if (readonly) return
    const label = item.kind === 'folder' ? 'carpeta' : 'archivo'
    const ok = window.confirm(
      `¿Eliminar ${label} «${item.name}»?\nSe quitará de la lista. Esta acción no se puede deshacer desde aquí.`,
    )
    if (!ok) return
    setBusy(true)
    try {
      await deleteDriveItem(item.id, item.kind === 'file')
      toastSuccess(item.kind === 'folder' ? 'Carpeta eliminada' : 'Archivo eliminado')
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo eliminar')
    } finally {
      setBusy(false)
    }
  }

  const toggleReady = async (item: CreativeDriveItem) => {
    if (readonly || item.kind !== 'file') return
    const next = !item.readyForTwitch
    if (next) {
      const check = isTwitchReadyCandidate({
        name: item.name,
        mimeType: item.mimeType,
        sizeBytes: item.sizeBytes,
        assetKind: item.assetKind,
      })
      if (!check.ok) {
        toastError(check.messages[0] ?? 'No cumple reglas prácticas para Twitch')
        return
      }
    }
    setReadyBusyId(item.id)
    try {
      await setDriveReadyForTwitch(item.id, next, item.assetKind ?? null)
      toastSuccess(next ? 'Marcado Listo para Twitch' : 'Marca quitada')
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo actualizar')
    } finally {
      setReadyBusyId(null)
    }
  }

  const changeAssetKind = async (item: CreativeDriveItem, kind: TwitchAssetKind | '') => {
    if (readonly) return
    setReadyBusyId(item.id)
    try {
      await setDriveAssetKind(item.id, kind === '' ? null : kind)
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo guardar el tipo')
    } finally {
      setReadyBusyId(null)
    }
  }

  if (!isTauri) {
    return (
      <div className="card agency-gate">
        <p>Diseño gráfico requiere la app de escritorio NeuraGest.</p>
      </div>
    )
  }

  const pendingCount = pendingFiles?.length ?? 0

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Diseño gráfico</h1>
          <p>Archivos creativos del equipo: carpetas, subidas y entregables listos para Twitch.</p>
        </div>
        <div className="page-actions">
          <button className="secondary" disabled={loading || busy} onClick={() => void reload()}>
            <RefreshCw size={16} />
          </button>
          <button
            className="secondary"
            disabled={readonly || busy}
            title={readonly ? 'Solo lectura' : undefined}
            onClick={() => setFolderOpen(true)}
          >
            <FolderPlus size={16} /> Carpeta nueva
          </button>
          <button
            className="primary"
            disabled={readonly || busy}
            title={readonly ? 'Solo lectura' : undefined}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={16} /> Subir
          </button>
          <input
            ref={fileRef}
            type="file"
            hidden
            multiple
            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif,application/pdf,application/zip,.zip,.png,.jpg,.jpeg,.webp,.svg,.pdf"
            onChange={(e) => {
              const next = e.target.files
              if (next) onUploadFiles(next)
              e.target.value = ''
            }}
          />
        </div>
      </div>

      {readonly && (
        <p className="integration-note staff-readonly-banner">
          Modo solo lectura: puedes ver y descargar, pero no subir ni borrar.
        </p>
      )}
      {error && <p className="integration-note">{error}</p>}
      <p className="dg-rules-note">{TWITCH_RULES_BLURB} · Cierra el flujo en Assets o Handoff.</p>

      <nav className="cd-breadcrumb" aria-label="Ruta de carpetas">
        {crumbs.map((crumb, index) => {
          const isCurrent = index === crumbs.length - 1
          const isRoot = index === 0
          return (
            <span key={`${crumb.id ?? 'root'}-${index}`} className="cd-crumb">
              {index > 0 && (
                <span className="cd-crumb-sep" aria-hidden>
                  /
                </span>
              )}
              <button
                type="button"
                className={[
                  isRoot ? 'is-root' : undefined,
                  isCurrent ? 'is-current' : undefined,
                ]
                  .filter(Boolean)
                  .join(' ') || undefined}
                onClick={() => goCrumb(index)}
                aria-current={isCurrent ? 'location' : undefined}
              >
                {crumb.name}
              </button>
            </span>
          )
        })}
      </nav>

      <div
        className={`card cd-dropzone${dragging ? ' is-dragging' : ''}`}
        onDragEnter={(e) => { e.preventDefault(); if (!readonly) setDragging(true) }}
        onDragOver={(e) => { e.preventDefault() }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (!readonly && e.dataTransfer.files.length) onUploadFiles(e.dataTransfer.files)
        }}
      >
        <div className={`cd-fade-surface${contentFaded ? ' is-faded' : ''}`}>
          {loading ? (
            <p className="empty-state">Cargando archivos…</p>
          ) : items.length === 0 ? (
            <div className="cd-empty">
              <Folder size={36} />
              <b>Esta carpeta está vacía</b>
              <span>
                {readonly
                  ? 'Cuando el equipo suba archivos creativos, aparecerán aquí.'
                  : 'Crea una carpeta o arrastra archivos aquí (PNG, SVG, JPG, PDF, ZIP…).'}
              </span>
              {!readonly && (
                <button className="primary" onClick={() => fileRef.current?.click()}>
                  <Upload size={16} /> Subir archivos
                </button>
              )}
            </div>
          ) : (
            <div className="cd-grid">
              {folders.map((item) => (
                <article key={item.id} className="cd-tile is-folder">
                  <button type="button" className="cd-tile-main" onClick={() => openFolder(item)} onDoubleClick={() => openFolder(item)}>
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
                      <b>{item.name}</b>
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
                <article key={item.id} className={`cd-tile${item.readyForTwitch ? ' is-twitch-ready' : ''}`}>
                  <div className="cd-tile-main">
                    {item.mimeType?.startsWith('image/') && item.url ? (
                      <img src={item.url} alt="" className="cd-thumb" />
                    ) : (
                      <FileIcon size={28} />
                    )}
                    {renamingId === item.id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => void commitRename()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void commitRename()
                          if (e.key === 'Escape') setRenamingId(null)
                        }}
                      />
                    ) : (
                      <b title={item.name}>{item.name}</b>
                    )}
                    <small>
                      {formatDriveSize(item.sizeBytes)}
                      {item.createdBy && uploaderNames[item.createdBy] ? ` · ${uploaderNames[item.createdBy]}` : ''}
                      {item.readyForTwitch ? ' · Listo para Twitch' : ''}
                    </small>
                    {!readonly && (
                      <select
                        className="cd-kind-select"
                        value={item.assetKind ?? ''}
                        disabled={readyBusyId === item.id}
                        aria-label="Tipo de asset"
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => void changeAssetKind(item, e.target.value as TwitchAssetKind | '')}
                      >
                        <option value="">Tipo…</option>
                        {CHANNEL_ASSET_SPECS.map((s) => (
                          <option key={s.kind} value={s.kind}>{s.label}</option>
                        ))}
                        <option value="other">Otro</option>
                      </select>
                    )}
                  </div>
                  <div className="cd-tile-actions">
                    {item.url && (
                      <a className="icon-btn" href={item.url} target="_blank" rel="noreferrer" title="Descargar" download={item.name}>
                        <Download size={14} />
                      </a>
                    )}
                    {!readonly && (
                      <>
                        <button
                          type="button"
                          className={`icon-btn${item.readyForTwitch ? ' is-active' : ''}`}
                          title={item.readyForTwitch ? 'Quitar Listo para Twitch' : 'Marcar Listo para Twitch'}
                          disabled={readyBusyId === item.id}
                          onClick={() => void toggleReady(item)}
                        >
                          <BadgeCheck size={14} />
                        </button>
                        <button type="button" className="icon-btn" title="Renombrar" onClick={() => startRename(item)}><Pencil size={14} /></button>
                        <button type="button" className="icon-btn" title="Eliminar" onClick={() => void removeItem(item)}><Trash2 size={14} /></button>
                      </>
                    )}
                  </div>
                  {item.readyForTwitch && (
                    <div className="cd-ready-footer">
                      <button type="button" className="secondary" onClick={() => navigate('/assets')}>Assets</button>
                      <button type="button" className="secondary" onClick={() => navigate('/handoff')}>Handoff</button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
        {dragging && !readonly && <div className="cd-drop-hint">Suelta para subir</div>}
      </div>

      {folderOpen && (
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
                placeholder="Overlays, thumbnails…"
              />
            </label>
            <div className="agency-modal-actions">
              <button className="secondary" onClick={() => setFolderOpen(false)}>Cancelar</button>
              <button className="primary" disabled={busy || !folderName.trim()} onClick={() => void createFolder()}>
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingFiles && (
        <div className="modal-backdrop" onClick={() => setPendingFiles(null)}>
          <div className="agency-modal card cd-zip-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="cd-zip-title">
            <h3 id="cd-zip-title">¿Comprimir {pendingCount} archivos en un ZIP?</h3>
            <p className="cd-zip-hint">
              Un solo ZIP es más fácil de compartir. También puedes subir cada archivo por separado.
            </p>
            <div className="agency-modal-actions cd-zip-actions">
              <button className="secondary" disabled={busy} onClick={confirmSeparate}>
                Subir por separado
              </button>
              <button className="primary" disabled={busy} onClick={confirmZip}>
                Comprimir en ZIP
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
