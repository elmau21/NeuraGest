import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  LayoutGrid,
  List,
  MessageSquare,
  Plus,
  UserRound,
} from '@/components/icons'
import { TaskDetailPanel } from '@/features/tasks/TaskDetailPanel'
import {
  addComment,
  assignTask,
  createTask,
  fetchTasks,
  moveTaskStatus,
  type TaskRecord,
} from '@/services/tasks'
import {
  filterTasksByTime,
  formatDueLabel,
  isOpenTask,
  overdueTasks,
  pendingTasks,
  PRIORITY_EMOJI,
  PRIORITY_LABELS,
  recentlyCompletedTasks,
  TASK_CATEGORIES,
  TASK_STATUS_LABELS,
  taskSummaryCounts,
  type TaskTimeFilter,
} from '@/services/task-utils'
import { fetchAuditActivity } from '@/services/audit'
import type { ActivityItem } from '@/services/activity'
import { formatActivityLabel } from '@/services/activity-format'
import { listAppUsers, type AppUserRecord } from '@/services/app-users'
import { canMutate } from '@/services/permissions'
import { useAuthStore } from '@/stores/auth-store'
import { toastError, toastSuccess } from '@/stores/toast-store'
import { isTauri } from '@/services/twitch'
import type { Priority, TaskStatus } from '@/types'

export type AssigneeOption = { userId: string; label: string }

function assigneeOptionsFromAppUsers(users: AppUserRecord[]): AssigneeOption[] {
  return users
    .filter((u) => u.authUserId)
    .map((u) => ({
      userId: u.authUserId!,
      label: u.displayName ? `${u.displayName} · @${u.twitchLogin}` : `@${u.twitchLogin}`,
    }))
}

const STATUS_COLUMNS: { id: TaskStatus; title: string }[] = [
  { id: 'backlog', title: 'Pendiente' },
  { id: 'progress', title: 'En progreso' },
  { id: 'review', title: 'En revisión' },
  { id: 'done', title: 'Completada' },
]

const TIME_FILTERS: { id: TaskTimeFilter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'overdue', label: 'Atrasadas' },
  { id: 'today', label: 'Hoy' },
  { id: 'week', label: 'Esta semana' },
]

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'ahora'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  return new Date(iso).toLocaleDateString('es-MX')
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className={`at-stat ${tone ?? ''}`.trim()}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function TaskQuickCard({
  task,
  readonly,
  users,
  onOpen,
  onDone,
  onAssign,
  onComment,
}: {
  task: TaskRecord
  readonly: boolean
  users: AssigneeOption[]
  onOpen: () => void
  onDone: () => void
  onAssign: (userId: string) => void
  onComment: (body: string) => void
}) {
  const [commentOpen, setCommentOpen] = useState(false)
  const [commentDraft, setCommentDraft] = useState('')
  const overdue = formatDueLabel(task.dueDate).startsWith('Atrasada')

  return (
    <article className={`at-task-card ${overdue ? 'overdue' : ''}`}>
      <button type="button" className="at-task-main" onClick={onOpen}>
        <div className="at-task-badges">
          <span className={`at-priority prio-${task.priority}`}>
            {PRIORITY_EMOJI[task.priority]} {PRIORITY_LABELS[task.priority]}
          </span>
          <span className={`at-status status-${task.status}`}>{TASK_STATUS_LABELS[task.status]}</span>
        </div>
        <h4>{task.title}</h4>
        {task.description ? <p>{task.description}</p> : null}
        <div className="at-task-meta">
          <span><UserRound size={12} /> {task.assignee}</span>
          <span>{formatDueLabel(task.dueDate)}</span>
          <span>{task.category}</span>
        </div>
      </button>
      {!readonly ? (
        <div className="at-task-actions">
          {task.status !== 'done' ? (
            <button type="button" className="at-action-btn" onClick={onDone} title="Marcar hecha">
              <Check size={13} /> Hecha
            </button>
          ) : null}
          <button type="button" className="at-action-btn" onClick={() => setCommentOpen((v) => !v)}>
            <MessageSquare size={13} /> Comentar
          </button>
          <label className="at-assign">
            <span>Responsable</span>
            <select
              value={task.assigneeId ?? ''}
              onChange={(e) => onAssign(e.target.value)}
            >
              <option value="">Sin asignar</option>
              {users.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      {commentOpen && !readonly ? (
        <div className="at-inline-comment">
          <input
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
            placeholder="Escribe un comentario…"
          />
          <button
            type="button"
            className="primary"
            disabled={!commentDraft.trim()}
            onClick={() => {
              onComment(commentDraft.trim())
              setCommentDraft('')
              setCommentOpen(false)
            }}
          >
            Enviar
          </button>
        </div>
      ) : null}
    </article>
  )
}

function CreateTaskModal({
  open,
  users,
  onClose,
  onCreated,
}: {
  open: boolean
  users: AssigneeOption[]
  onClose: () => void
  onCreated: (task: TaskRecord) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [dueDate, setDueDate] = useState('')
  const [category, setCategory] = useState<string>('General')
  const [assigneeId, setAssigneeId] = useState('')
  const [saving, setSaving] = useState(false)

  if (!open) return null

  const submit = async () => {
    if (!title.trim()) {
      toastError('Escribe un nombre para la tarea.')
      return
    }
    setSaving(true)
    try {
      const created = await createTask({
        title: title.trim(),
        description: description.trim(),
        priority,
        dueDate: dueDate || undefined,
        category,
        assigneeId: assigneeId || undefined,
        status: 'backlog',
      })
      if (!created) {
        toastError('No se pudo crear la tarea.')
        return
      }
      toastSuccess('Tarea creada.')
      onCreated(created)
      setTitle('')
      setDescription('')
      setPriority('medium')
      setDueDate('')
      setCategory('General')
      setAssigneeId('')
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="at-create-modal card" onClick={(e) => e.stopPropagation()}>
        <h3>Nueva tarea</h3>
        <p className="at-create-hint">Formulario corto — solo lo esencial.</p>
        <label>
          Nombre
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Revisar brief de @talento" autoFocus />
        </label>
        <label>
          Descripción
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Detalle opcional…" />
        </label>
        <div className="at-create-row">
          <label>
            Prioridad
            <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              <option value="urgent">🔴 Urgente</option>
              <option value="high">🟠 Alta</option>
              <option value="medium">🟡 Normal</option>
              <option value="low">🟢 Baja</option>
            </select>
          </label>
          <label>
            Vence
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
        </div>
        <div className="at-create-row">
          <label>
            Categoría
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {TASK_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Responsable
            <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Sin asignar</option>
              {users.map((u) => (
                <option key={u.userId} value={u.userId}>{u.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="at-create-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="primary" disabled={saving} onClick={() => void submit()}>
            {saving ? 'Guardando…' : 'Crear tarea'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function AssistantTasksPage() {
  const roles = useAuthStore((s) => s.roles)
  const readonly = !canMutate(roles)
  const [searchParams, setSearchParams] = useSearchParams()
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [assigneeOptions, setAssigneeOptions] = useState<AssigneeOption[]>([])
  const [loading, setLoading] = useState(true)
  const [timeFilter, setTimeFilter] = useState<TaskTimeFilter>('all')
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [createOpen, setCreateOpen] = useState(false)
  const selectedId = searchParams.get('task')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [taskRows, auditRows, userRows] = await Promise.all([
        fetchTasks(),
        fetchAuditActivity('tasks', 10),
        isTauri ? listAppUsers().catch(() => [] as AppUserRecord[]) : Promise.resolve([] as AppUserRecord[]),
      ])
      setTasks(taskRows)
      setActivity(auditRows)
      setAssigneeOptions(assigneeOptionsFromAppUsers(userRows))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const counts = useMemo(() => taskSummaryCounts(tasks), [tasks])
  const filtered = useMemo(() => filterTasksByTime(tasks.filter(isOpenTask), timeFilter), [tasks, timeFilter])
  const pending = useMemo(() => pendingTasks(tasks), [tasks])
  const overdue = useMemo(() => overdueTasks(tasks), [tasks])
  const completedRecent = useMemo(() => recentlyCompletedTasks(tasks, 6), [tasks])

  const openTask = (id: string) => setSearchParams({ task: id })
  const closeTask = () => setSearchParams({})

  const markDone = async (id: string) => {
    const ok = await moveTaskStatus(id, 'done')
    if (!ok) {
      toastError('No se pudo marcar como hecha.')
      return
    }
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'done' } : t)))
    toastSuccess('Tarea completada.')
  }

  const handleAssign = async (taskId: string, userId: string) => {
    const user = assigneeOptions.find((u) => u.userId === userId)
    const ok = await assignTask(taskId, userId || null, user?.label)
    if (!ok) {
      toastError('No se pudo cambiar el responsable.')
      return
    }
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, assigneeId: userId || undefined, assignee: user?.label ?? 'Sin asignar' }
          : t,
      ),
    )
    toastSuccess('Responsable actualizado.')
  }

  const handleComment = async (taskId: string, body: string) => {
    const created = await addComment(taskId, body)
    if (!created) {
      toastError('No se pudo guardar el comentario.')
      return
    }
    toastSuccess('Comentario agregado.')
  }

  return (
    <div className="assistant-tasks">
      <div className="page-title">
        <div>
          <Link to="/control" className="at-back"><ArrowLeft size={14} /> Centro de control</Link>
          <h1>Panel de tareas</h1>
          <p>Todo lo que necesitas hacer hoy, en un solo lugar — sin tecnicismos.</p>
        </div>
        {!readonly ? (
          <button type="button" className="primary" onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> Nueva tarea
          </button>
        ) : null}
      </div>

      <div className="at-summary">
        <SummaryCard label="Pendientes" value={counts.pending} />
        <SummaryCard label="Atrasadas" value={counts.overdue} tone="warn" />
        <SummaryCard label="Vencen pronto" value={counts.dueSoon} tone="soon" />
        <SummaryCard label="Completadas recientes" value={counts.completedRecent} tone="ok" />
      </div>

      <div className="at-toolbar card">
        <div className="at-chips">
          {TIME_FILTERS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={timeFilter === chip.id ? 'active' : ''}
              onClick={() => setTimeFilter(chip.id)}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <div className="at-view-toggle">
          <button type="button" className={view === 'kanban' ? 'active' : ''} onClick={() => setView('kanban')}>
            <LayoutGrid size={14} /> Tablero
          </button>
          <button type="button" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
            <List size={14} /> Lista
          </button>
        </div>
      </div>

      {loading ? (
        <p className="empty-state">Cargando tareas…</p>
      ) : view === 'kanban' ? (
        <div className="at-kanban">
          {STATUS_COLUMNS.map((col) => {
            const colTasks = filtered.filter((t) => t.status === col.id)
            return (
              <section key={col.id} className="at-kanban-col">
                <header><span>{col.title}</span><b>{colTasks.length}</b></header>
                <div className="at-kanban-body">
                  {colTasks.map((task) => (
                    <TaskQuickCard
                      key={task.id}
                      task={task}
                      readonly={readonly}
                      users={assigneeOptions}
                      onOpen={() => openTask(task.id)}
                      onDone={() => void markDone(task.id)}
                      onAssign={(userId) => void handleAssign(task.id, userId)}
                      onComment={(body) => void handleComment(task.id, body)}
                    />
                  ))}
                  {colTasks.length === 0 ? (
                    <p className="at-empty-col">Nada aquí por ahora.</p>
                  ) : null}
                </div>
              </section>
            )
          })}
        </div>
      ) : (
        <div className="card at-list">
          {filtered.length === 0 ? (
            <p className="empty-state">No hay tareas con este filtro. ¡Buen trabajo!</p>
          ) : (
            filtered.map((task) => (
              <TaskQuickCard
                key={task.id}
                task={task}
                readonly={readonly}
                users={assigneeOptions}
                onOpen={() => openTask(task.id)}
                onDone={() => void markDone(task.id)}
                onAssign={(userId) => void handleAssign(task.id, userId)}
                onComment={(body) => void handleComment(task.id, body)}
              />
            ))
          )}
        </div>
      )}

      <div className="at-widgets cc-grid">
        <section className="card cc-section">
          <div className="cc-section-head">
            <div className="cc-section-title">
              <List size={16} />
              <div><h3>Pendientes</h3><p>Lo que falta por empezar o terminar.</p></div>
            </div>
          </div>
          <div className="cc-section-body">
            {pending.length === 0 ? (
              <p className="empty-state cc-empty">Sin pendientes. ¡Excelente!</p>
            ) : (
              pending.slice(0, 5).map((t) => (
                <button key={t.id} type="button" className="at-widget-row" onClick={() => openTask(t.id)}>
                  <b>{t.title}</b>
                  <span>{TASK_STATUS_LABELS[t.status]} · {formatDueLabel(t.dueDate)}</span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="card cc-section">
          <div className="cc-section-head">
            <div className="cc-section-title">
              <Check size={16} />
              <div><h3>Atrasadas</h3><p>Tareas que ya pasaron su fecha límite.</p></div>
            </div>
          </div>
          <div className="cc-section-body">
            {overdue.length === 0 ? (
              <p className="empty-state cc-empty">Nada atrasado. Sigue así.</p>
            ) : (
              overdue.slice(0, 5).map((t) => (
                <button key={t.id} type="button" className="at-widget-row warn" onClick={() => openTask(t.id)}>
                  <b>{t.title}</b>
                  <span>{formatDueLabel(t.dueDate)} · {t.assignee}</span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="card cc-section">
          <div className="cc-section-head">
            <div className="cc-section-title">
              <Check size={16} />
              <div><h3>Completadas recientes</h3><p>Lo que el equipo ya cerró.</p></div>
            </div>
          </div>
          <div className="cc-section-body">
            {completedRecent.length === 0 ? (
              <p className="empty-state cc-empty">Aún no hay tareas completadas.</p>
            ) : (
              completedRecent.map((t) => (
                <button key={t.id} type="button" className="at-widget-row ok" onClick={() => openTask(t.id)}>
                  <b>{t.title}</b>
                  <span>{t.assignee}</span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="card cc-section">
          <div className="cc-section-head">
            <div className="cc-section-title">
              <CalendarDays size={16} />
              <div><h3>Calendario</h3><p>Eventos y fechas del equipo.</p></div>
            </div>
            <Link to="/calendario" className="cc-inline-link">Abrir calendario</Link>
          </div>
          <div className="cc-section-body">
            <p className="at-cal-hint">Revisa streams, scrims y fechas importantes en el calendario general.</p>
            <Link to="/calendario" className="cc-shortcut">
              <CalendarDays size={14} /> Ver calendario completo
            </Link>
          </div>
        </section>

        <section className="card cc-section">
          <div className="cc-section-head">
            <div className="cc-section-title">
              <MessageSquare size={16} />
              <div><h3>Últimas acciones</h3><p>Historial reciente de tareas.</p></div>
            </div>
            <Link to="/auditoria" className="cc-inline-link">Ver auditoría</Link>
          </div>
          <div className="cc-section-body">
            {activity.length === 0 ? (
              <p className="empty-state cc-empty">Sin movimientos recientes.</p>
            ) : (
              <ul className="at-activity">
                {activity.map((item) => (
                  <li key={item.id}>
                    <span>{formatActivityLabel(item.entityType, item.action, item.metadata, item.actorName)}</span>
                    <em>{relativeTime(item.createdAt)}</em>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="card cc-section">
          <div className="cc-section-head">
            <div className="cc-section-title">
              <UserRound size={16} />
              <div><h3>Resumen de actividad</h3><p>Vista rápida del tablero.</p></div>
            </div>
          </div>
          <div className="cc-section-body at-resumen">
            <p><strong>{counts.open}</strong> tareas abiertas de {counts.total} en total.</p>
            <p><strong>{counts.overdue}</strong> requieren atención inmediata.</p>
            <p><strong>{counts.dueSoon}</strong> vencen en los próximos días.</p>
            <Link to="/control" className="cc-inline-link">Volver al centro de control</Link>
          </div>
        </section>
      </div>

      {selectedId ? (
        <TaskDetailPanel taskId={selectedId} readonly={readonly} onClose={closeTask} />
      ) : null}

      <CreateTaskModal
        open={createOpen}
        users={assigneeOptions}
        onClose={() => setCreateOpen(false)}
        onCreated={(task) => setTasks((prev) => [...prev, task])}
      />
    </div>
  )
}
