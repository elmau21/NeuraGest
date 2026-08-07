import { useCallback, useEffect, useState } from 'react'
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core'
import { ExternalLink, LayoutGrid, List, Plus, RefreshCw } from 'lucide-react'
import {
  CONTENT_TYPE_LABELS,
  deletePipelineItem,
  listDbTalents,
  listPipelineItems,
  PIPELINE_COLUMNS,
  savePipelineItem,
  updatePipelineStatus,
  type ContentType,
  type DbTalent,
  type PipelineItem,
  type PipelineStatus,
} from '@/services/agency'
import { isTauri } from '@/services/twitch'

function AgencyGate({ children }: { children: React.ReactNode }) {
  if (!isTauri) {
    return (
      <div className="card agency-gate">
        <p>Ejecuta NeuraGest con la app de escritorio para usar este módulo con sincronización en la nube.</p>
      </div>
    )
  }
  return <>{children}</>
}

function PipelineCard({ item, onEdit }: { item: PipelineItem; onEdit: (item: PipelineItem) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id })
  return (
    <div
      ref={setNodeRef}
      className="task-card agency-card"
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.55 : 1,
      }}
      {...listeners}
      {...attributes}
      onDoubleClick={() => onEdit(item)}
    >
      <span className="agency-badge">{CONTENT_TYPE_LABELS[item.contentType]}</span>
      <h4>{item.title}</h4>
      {item.description && <p>{item.description}</p>}
      <div className="task-meta">
        <span>{item.talentLogin ? `@${item.talentLogin}` : 'General'}</span>
        {item.url && (
          <a href={item.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  )
}

function PipelineColumn({
  id,
  title,
  items,
  onEdit,
}: {
  id: PipelineStatus
  title: string
  items: PipelineItem[]
  onEdit: (item: PipelineItem) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <section className="kanban-column" data-column={id}>
      <div className="column-head"><span>{title}</span><b>{items.length}</b></div>
      <div ref={setNodeRef} className={`drop-zone ${isOver ? 'is-over' : ''}`}>
        {items.map((item) => <PipelineCard key={item.id} item={item} onEdit={onEdit} />)}
        {items.length === 0 && <p className="column-empty">Sin contenido</p>}
      </div>
    </section>
  )
}

export function PipelinePage() {
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [items, setItems] = useState<PipelineItem[]>([])
  const [talents, setTalents] = useState<DbTalent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [draft, setDraft] = useState<Partial<PipelineItem> & { title: string }>({
    title: '',
    status: 'idea',
    contentType: 'clip',
  })

  const reload = useCallback(async () => {
    if (!isTauri) return
    setLoading(true)
    setError(null)
    try {
      const [pipeline, dbTalents] = await Promise.all([listPipelineItems(), listDbTalents()])
      setItems(pipeline)
      setTalents(dbTalents)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || !PIPELINE_COLUMNS.some((c) => c.id === over.id)) return
    const status = over.id as PipelineStatus
    const item = items.find((i) => i.id === active.id)
    if (!item || item.status === status) return
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, status } : i))
    try {
      await updatePipelineStatus(String(active.id), status)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      void reload()
    }
  }

  const openNew = () => {
    setDraft({ title: '', status: 'idea', contentType: 'clip', description: '', url: '' })
    setEditorOpen(true)
  }

  const openEdit = (item: PipelineItem) => {
    setDraft(item)
    setEditorOpen(true)
  }

  const save = async () => {
    if (!draft.title.trim()) return
    try {
      const saved = await savePipelineItem({
        id: draft.id,
        talentId: draft.talentId,
        title: draft.title.trim(),
        description: draft.description,
        status: (draft.status ?? 'idea') as PipelineStatus,
        contentType: (draft.contentType ?? 'clip') as ContentType,
        url: draft.url,
      })
      setItems((prev) => {
        const exists = prev.some((i) => i.id === saved.id)
        return exists ? prev.map((i) => i.id === saved.id ? saved : i) : [...prev, saved]
      })
      setEditorOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const remove = async () => {
    if (!draft.id) return
    try {
      await deletePipelineItem(draft.id)
      setItems((prev) => prev.filter((i) => i.id !== draft.id))
      setEditorOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <AgencyGate>
      <div className="page-title">
        <div>
          <h1>Pipeline de contenido</h1>
          <p>Ideas, edición y publicación de clips, VODs y highlights.</p>
        </div>
        <div className="page-actions">
          <button className="secondary" disabled={loading} onClick={() => void reload()}>
            <RefreshCw size={16} />{loading ? 'Cargando…' : 'Actualizar'}
          </button>
          <button className="primary" onClick={openNew}><Plus size={16} />Nuevo ítem</button>
        </div>
      </div>

      <div className="view-tabs">
        <button className={view === 'kanban' ? 'active' : ''} onClick={() => setView('kanban')}>
          <LayoutGrid size={14} /> Kanban
        </button>
        <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
          <List size={14} /> Lista
        </button>
      </div>

      {error && <p className="integration-note">{error}</p>}

      {view === 'kanban' ? (
        <DndContext onDragEnd={onDragEnd}>
          <div className="board agency-board">
            {PIPELINE_COLUMNS.map((column) => (
              <PipelineColumn
                key={column.id}
                id={column.id}
                title={column.title}
                items={items.filter((i) => i.status === column.id)}
                onEdit={openEdit}
              />
            ))}
          </div>
        </DndContext>
      ) : (
        <div className="card">
          <div className="agency-list">
            {items.map((item) => (
              <button key={item.id} className="agency-list-row" onClick={() => openEdit(item)}>
                <span className={`agency-status ${item.status}`}>{PIPELINE_COLUMNS.find((c) => c.id === item.status)?.title}</span>
                <b>{item.title}</b>
                <span>{CONTENT_TYPE_LABELS[item.contentType]}</span>
                <span>{item.talentLogin ? `@${item.talentLogin}` : '—'}</span>
                {item.url && <ExternalLink size={14} />}
              </button>
            ))}
            {!loading && items.length === 0 && <p className="empty-state">No hay ítems en el pipeline.</p>}
          </div>
        </div>
      )}

      {editorOpen && (
        <div className="modal-backdrop" onClick={() => setEditorOpen(false)}>
          <div className="agency-modal card" onClick={(e) => e.stopPropagation()}>
            <h3>{draft.id ? 'Editar ítem' : 'Nuevo ítem'}</h3>
            <label>Título<input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
            <label>Descripción<textarea value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} /></label>
            <div className="agency-form-row">
              <label>Estado
                <select value={draft.status ?? 'idea'} onChange={(e) => setDraft({ ...draft, status: e.target.value as PipelineStatus })}>
                  {PIPELINE_COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </label>
              <label>Tipo
                <select value={draft.contentType ?? 'clip'} onChange={(e) => setDraft({ ...draft, contentType: e.target.value as ContentType })}>
                  {Object.entries(CONTENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
            </div>
            <label>Talento
              <select value={draft.talentId ?? ''} onChange={(e) => setDraft({ ...draft, talentId: e.target.value || undefined })}>
                <option value="">General</option>
                {talents.map((t) => <option key={t.id} value={t.id}>{t.displayName} (@{t.login})</option>)}
              </select>
            </label>
            <label>URL<input value={draft.url ?? ''} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://..." /></label>
            <div className="agency-modal-actions">
              {draft.id && <button className="secondary danger" onClick={() => void remove()}>Eliminar</button>}
              <button className="secondary" onClick={() => setEditorOpen(false)}>Cancelar</button>
              <button className="primary" onClick={() => void save()}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </AgencyGate>
  )
}
