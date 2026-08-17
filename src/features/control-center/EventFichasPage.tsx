import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  Megaphone,
  Plus,
  Trash2,
} from '@/components/icons'
import {
  APROBACION_LABELS,
  createEventFicha,
  deleteEventFicha,
  ESTADO_LABELS,
  fetchEventFicha,
  listEventFichas,
  updateEventFicha,
  type DirectivaAprobacion,
  type EventFicha,
  type EventFichaEstado,
  type EventFichaInput,
} from '@/services/ops-event-fichas'
import { canMutate } from '@/services/permissions'
import { useAuthStore } from '@/stores/auth-store'
import { toastError, toastSuccess } from '@/stores/toast-store'

const ESTADOS: EventFichaEstado[] = ['idea', 'planificacion', 'produccion', 'publicado', 'cerrado']
const APROBACIONES: DirectivaAprobacion[] = ['si', 'no', 'pendiente']

function formatDate(iso?: string): string {
  if (!iso) return 'Sin fecha'
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'ahora'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  return new Date(iso).toLocaleDateString('es-MX')
}

function emptyForm(): EventFichaInput {
  return {
    nombre: '',
    objetivo: '',
    fecha: '',
    responsable: '',
    participantes: '',
    contenidoNecesario: '',
    promocion: '',
    recursos: '',
    aprobacionDirectiva: 'pendiente',
    estado: 'idea',
  }
}

function formFromFicha(ficha: EventFicha): EventFichaInput {
  return {
    nombre: ficha.nombre,
    objetivo: ficha.objetivo,
    fecha: ficha.fecha ?? '',
    responsable: ficha.responsable,
    participantes: ficha.participantes,
    contenidoNecesario: ficha.contenidoNecesario,
    promocion: ficha.promocion,
    recursos: ficha.recursos,
    aprobacionDirectiva: ficha.aprobacionDirectiva,
    estado: ficha.estado,
  }
}

function FichaForm({
  draft,
  readonly,
  saving,
  onChange,
  onSave,
  onCancel,
  onDelete,
  authorLine,
}: {
  draft: EventFichaInput
  readonly: boolean
  saving: boolean
  onChange: (next: EventFichaInput) => void
  onSave: () => void
  onCancel: () => void
  onDelete?: () => void
  authorLine?: string | null
}) {
  const set = <K extends keyof EventFichaInput>(key: K, value: EventFichaInput[K]) => {
    onChange({ ...draft, [key]: value })
  }

  return (
    <div className="ef-form card">
      <div className="ef-form-head">
        <div>
          <h3>{readonly ? 'Detalle de la ficha' : draft.nombre.trim() ? draft.nombre : 'Nueva mini-ficha'}</h3>
          <p>Toda campaña o evento debe tener una mini-ficha operativa.</p>
        </div>
        {authorLine ? <span className="ef-author">{authorLine}</span> : null}
      </div>

      <div className="ef-fields">
        <label>
          Nombre
          <input
            value={draft.nombre}
            onChange={(e) => set('nombre', e.target.value)}
            placeholder="Ej. Stream especial de verano"
            disabled={readonly}
          />
        </label>
        <label>
          Objetivo
          <textarea
            value={draft.objetivo ?? ''}
            onChange={(e) => set('objetivo', e.target.value)}
            rows={2}
            placeholder="¿Qué queremos lograr?"
            disabled={readonly}
          />
        </label>
        <div className="ef-form-row">
          <label>
            Fecha
            <input
              type="date"
              value={draft.fecha ?? ''}
              onChange={(e) => set('fecha', e.target.value)}
              disabled={readonly}
            />
          </label>
          <label>
            Responsable
            <input
              value={draft.responsable ?? ''}
              onChange={(e) => set('responsable', e.target.value)}
              placeholder="Quién coordina"
              disabled={readonly}
            />
          </label>
        </div>
        <label>
          Participantes
          <input
            value={draft.participantes ?? ''}
            onChange={(e) => set('participantes', e.target.value)}
            placeholder="Talentos, invitados, equipos…"
            disabled={readonly}
          />
        </label>
        <label>
          Contenido necesario
          <textarea
            value={draft.contenidoNecesario ?? ''}
            onChange={(e) => set('contenidoNecesario', e.target.value)}
            rows={2}
            placeholder="Piezas, formatos, entregables…"
            disabled={readonly}
          />
        </label>
        <label>
          Promoción
          <textarea
            value={draft.promocion ?? ''}
            onChange={(e) => set('promocion', e.target.value)}
            rows={2}
            placeholder="Redes, avisos, calendario…"
            disabled={readonly}
          />
        </label>
        <label>
          Recursos
          <textarea
            value={draft.recursos ?? ''}
            onChange={(e) => set('recursos', e.target.value)}
            rows={2}
            placeholder="Presupuesto, herramientas, apoyo…"
            disabled={readonly}
          />
        </label>
        <div className="ef-form-row">
          <label>
            Aprobación de la directiva
            <select
              value={draft.aprobacionDirectiva ?? 'pendiente'}
              onChange={(e) => set('aprobacionDirectiva', e.target.value as DirectivaAprobacion)}
              disabled={readonly}
            >
              {APROBACIONES.map((v) => (
                <option key={v} value={v}>{APROBACION_LABELS[v]}</option>
              ))}
            </select>
          </label>
          <label>
            Estado
            <select
              value={draft.estado ?? 'idea'}
              onChange={(e) => set('estado', e.target.value as EventFichaEstado)}
              disabled={readonly}
            >
              {ESTADOS.map((v) => (
                <option key={v} value={v}>{ESTADO_LABELS[v]}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="ef-form-actions">
        {!readonly ? (
          <>
            {onDelete ? (
              <button type="button" className="danger secondary" onClick={onDelete} disabled={saving}>
                <Trash2 size={14} /> Eliminar
              </button>
            ) : (
              <span />
            )}
            <div className="ef-form-actions-right">
              <button type="button" className="secondary" onClick={onCancel} disabled={saving}>
                Cancelar
              </button>
              <button type="button" className="primary" onClick={onSave} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar ficha'}
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="secondary" onClick={onCancel}>
            Cerrar
          </button>
        )}
      </div>
    </div>
  )
}

export function EventFichasPage() {
  const roles = useAuthStore((s) => s.roles)
  const readonly = !canMutate(roles)
  const [searchParams, setSearchParams] = useSearchParams()
  const [fichas, setFichas] = useState<EventFicha[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<EventFichaInput>(emptyForm())
  const [editingId, setEditingId] = useState<string | null>(null)

  const selectedId = searchParams.get('ficha')
  const isNew = searchParams.get('nueva') === '1'
  const panelOpen = Boolean(selectedId || isNew)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setFichas(await listEventFichas())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (isNew) {
      setEditingId(null)
      setDraft(emptyForm())
      return
    }
    if (!selectedId) {
      setEditingId(null)
      return
    }
    void fetchEventFicha(selectedId).then((row) => {
      if (!row) {
        toastError('No se encontró esa ficha.')
        setSearchParams({})
        return
      }
      setEditingId(row.id)
      setDraft(formFromFicha(row))
    })
  }, [isNew, selectedId, setSearchParams])

  const selected = useMemo(
    () => (selectedId ? fichas.find((f) => f.id === selectedId) ?? null : null),
    [fichas, selectedId],
  )

  const authorLine = useMemo(() => {
    const login = selected?.createdByLogin ?? selected?.updatedByLogin
    if (!login) return null
    const updated = selected?.updatedByLogin && selected.updatedByLogin !== selected.createdByLogin
    if (updated && selected?.updatedByLogin) {
      return `Registrado por @${selected.createdByLogin ?? login} · Actualizado por @${selected.updatedByLogin}`
    }
    return `Registrado por @${login}`
  }, [selected])

  const openNew = () => setSearchParams({ nueva: '1' })
  const openFicha = (id: string) => setSearchParams({ ficha: id })
  const closePanel = () => setSearchParams({})

  const handleSave = async () => {
    if (!draft.nombre.trim()) {
      toastError('Escribe un nombre para la campaña o evento.')
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        const updated = await updateEventFicha(editingId, draft)
        if (!updated) {
          toastError('No se pudo guardar la ficha.')
          return
        }
        setFichas((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
        setDraft(formFromFicha(updated))
        toastSuccess('Ficha actualizada.')
      } else {
        const created = await createEventFicha(draft)
        if (!created) {
          toastError('No se pudo crear la ficha.')
          return
        }
        setFichas((prev) => [created, ...prev])
        setEditingId(created.id)
        setSearchParams({ ficha: created.id })
        setDraft(formFromFicha(created))
        toastSuccess('Ficha guardada.')
      }
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Error al guardar.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editingId) return
    if (!window.confirm('¿Eliminar esta mini-ficha?')) return
    setSaving(true)
    try {
      const ok = await deleteEventFicha(editingId, draft.nombre)
      if (!ok) {
        toastError('No se pudo eliminar la ficha.')
        return
      }
      setFichas((prev) => prev.filter((f) => f.id !== editingId))
      toastSuccess('Ficha eliminada.')
      closePanel()
    } finally {
      setSaving(false)
    }
  }

  const counts = useMemo(() => {
    const byEstado = Object.fromEntries(ESTADOS.map((e) => [e, 0])) as Record<EventFichaEstado, number>
    for (const f of fichas) byEstado[f.estado] += 1
    return byEstado
  }, [fichas])

  return (
    <div className="event-fichas">
      <div className="page-title">
        <div>
          <Link to="/control" className="at-back">
            <ArrowLeft size={14} /> Centro de control
          </Link>
          <h1>Contenido, eventos y comunicación</h1>
          <p>Mini-fichas operativas para campañas y eventos — simple y claro.</p>
        </div>
        {!readonly ? (
          <button type="button" className="primary" onClick={openNew}>
            <Plus size={15} /> Nueva ficha
          </button>
        ) : null}
      </div>

      <div className="ef-summary">
        {ESTADOS.map((estado) => (
          <div key={estado} className={`at-stat ef-stat-${estado}`}>
            <span>{ESTADO_LABELS[estado]}</span>
            <strong>{counts[estado]}</strong>
          </div>
        ))}
      </div>

      <div className={`ef-layout ${panelOpen ? 'with-panel' : ''}`}>
        <section className="card ef-list-card">
          <div className="ef-list-head">
            <h2><Megaphone size={16} /> Fichas guardadas</h2>
            <span>{fichas.length} en total</span>
          </div>
          {loading ? (
            <p className="ef-empty">Cargando fichas…</p>
          ) : fichas.length === 0 ? (
            <p className="ef-empty">
              {readonly
                ? 'Aún no hay mini-fichas registradas.'
                : 'Crea la primera mini-ficha con el botón «Nueva ficha».'}
            </p>
          ) : (
            <ul className="ef-list">
              {fichas.map((ficha) => (
                <li key={ficha.id}>
                  <button
                    type="button"
                    className={`ef-list-item ${selectedId === ficha.id ? 'active' : ''}`}
                    onClick={() => openFicha(ficha.id)}
                  >
                    <div className="ef-list-top">
                      <strong>{ficha.nombre}</strong>
                      <span className={`ef-pill estado-${ficha.estado}`}>{ESTADO_LABELS[ficha.estado]}</span>
                    </div>
                    <p>{ficha.objetivo || 'Sin objetivo escrito.'}</p>
                    <div className="ef-list-meta">
                      <span><CalendarDays size={12} /> {formatDate(ficha.fecha)}</span>
                      <span className={`ef-pill aprob-${ficha.aprobacionDirectiva}`}>
                        Directiva: {APROBACION_LABELS[ficha.aprobacionDirectiva]}
                      </span>
                      {ficha.createdByLogin ? (
                        <span><FileText size={12} /> @{ficha.createdByLogin}</span>
                      ) : null}
                      <span>{relativeTime(ficha.updatedAt)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {panelOpen ? (
          <FichaForm
            draft={draft}
            readonly={readonly}
            saving={saving}
            onChange={setDraft}
            onSave={() => void handleSave()}
            onCancel={closePanel}
            onDelete={editingId && !readonly ? () => void handleDelete() : undefined}
            authorLine={authorLine}
          />
        ) : null}
      </div>
    </div>
  )
}
