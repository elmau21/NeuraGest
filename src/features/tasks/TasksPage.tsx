import { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { Plus } from '@/components/icons'
import { DismissibleHint } from '@/components/DismissibleHint'
import { useTasksStore } from '@/stores/tasks-store'
import { useAuthStore } from '@/stores/auth-store'
import { canMutate } from '@/services/permissions'
import type { TaskRecord } from '@/services/tasks'
import type { TaskStatus } from '@/types'
import { TaskDetailPanel } from '@/features/tasks/TaskDetailPanel'

const columns: { id: TaskStatus; title: string }[] = [
  { id: 'backlog', title: 'Pendiente' },
  { id: 'progress', title: 'En progreso' },
  { id: 'review', title: 'En revisión' },
  { id: 'done', title: 'Completado' },
]

function TaskCard({
  task,
  readonly,
  onOpen,
  onDelete,
}: {
  task: TaskRecord
  readonly: boolean
  onOpen: () => void
  onDelete: (id: string, title: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, opacity: isDragging ? 0.4 : 1 }}
      className="task-card"
      {...attributes}
      {...listeners}
      onClick={onOpen}
    >
      {!readonly && (
        <button
          type="button"
          className="task-card-delete secondary danger"
          title="Eliminar tarea"
          onClick={(event) => {
            event.stopPropagation()
            onDelete(task.id, task.title)
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          ×
        </button>
      )}
      <span className={`priority ${task.priority}`}>{task.priority}</span>
      <h4>{task.title}</h4>
      <p>{task.description}</p>
      <div className="task-meta"><span>{task.tags[0]}</span><span>{task.dueDate ?? 'Sin fecha'}</span></div>
    </div>
  )
}

function KanbanColumn({
  id,
  title,
  tasks,
  readonly,
  onOpen,
  onDelete,
}: {
  id: TaskStatus
  title: string
  tasks: TaskRecord[]
  readonly: boolean
  onOpen: (taskId: string) => void
  onDelete: (id: string, title: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <section className="kanban-column" data-column={id}>
      <div className="column-head"><span>{title}</span><b>{tasks.length}</b></div>
      <div ref={setNodeRef} className={`drop-zone ${isOver ? 'is-over' : ''}`}>
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} readonly={readonly} onOpen={() => onOpen(task.id)} onDelete={onDelete} />
        ))}
        {tasks.length === 0 && <p className="column-empty">Sin tareas</p>}
      </div>
    </section>
  )
}

function KanbanView({
  tasks,
  readonly,
  onOpen,
  onDelete,
}: {
  tasks: TaskRecord[]
  readonly: boolean
  onOpen: (id: string) => void
  onDelete: (id: string, title: string) => void
}) {
  const move = useTasksStore((s) => s.move)
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const onDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id))
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    if (readonly || !over) return
    const overId = String(over.id)
    const column = columns.find((item) => item.id === overId)?.id
      ?? tasks.find((task) => task.id === overId)?.status
    if (column) void move(String(active.id), column)
  }

  const activeTask = tasks.find((task) => task.id === activeId)

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="board">
        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
            id={column.id}
            title={column.title}
            tasks={tasks.filter((task) => task.status === column.id)}
            readonly={readonly}
            onOpen={onOpen}
            onDelete={onDelete}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? (
          <div className="task-card task-card-overlay">
            <span className={`priority ${activeTask.priority}`}>{activeTask.priority}</span>
            <h4>{activeTask.title}</h4>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function ListView({
  tasks,
  readonly,
  onOpen,
  onDelete,
}: {
  tasks: TaskRecord[]
  readonly: boolean
  onOpen: (id: string) => void
  onDelete: (id: string, title: string) => void
}) {
  return (
    <div className="card task-list-view">
      <div className="task-list-head"><span>Título</span><span>Estado</span><span>Prioridad</span><span>Vence</span><span /></div>
      {tasks.map((task) => (
        <div key={task.id} className="task-list-row">
          <button type="button" className="task-list-main" onClick={() => onOpen(task.id)}>
            <span><b>{task.title}</b><small>{task.description}</small></span>
            <span>{task.status}</span>
            <span className={`priority ${task.priority}`}>{task.priority}</span>
            <span>{task.dueDate ?? '—'}</span>
          </button>
          {!readonly && (
            <button
              type="button"
              className="secondary danger task-list-delete"
              title="Eliminar tarea"
              onClick={() => onDelete(task.id, task.title)}
            >
              ×
            </button>
          )}
        </div>
      ))}
      {tasks.length === 0 && <p className="empty-state">No hay tareas todavía.</p>}
    </div>
  )
}

function TimelineView({ tasks, onOpen }: { tasks: TaskRecord[]; onOpen: (id: string) => void }) {
  const dated = [...tasks].sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
  return (
    <div className="card timeline-view">
      {dated.map((task) => (
        <button key={task.id} className="timeline-row" onClick={() => onOpen(task.id)}>
          <div className="timeline-dot" data-status={task.status} />
          <div><b>{task.dueDate ?? 'Sin fecha'}</b><span>{task.title}</span><small>{task.status} · {task.priority}</small></div>
        </button>
      ))}
      {dated.length === 0 && <p className="empty-state">Agrega tareas con fecha para ver el timeline.</p>}
    </div>
  )
}

function SprintView({ tasks, onOpen }: { tasks: TaskRecord[]; onOpen: (id: string) => void }) {
  const active = tasks.filter((task) => task.status !== 'done')
  const done = tasks.filter((task) => task.status === 'done')
  const total = tasks.length || 1
  const progress = Math.round((done.length / total) * 100)
  return (
    <div className="sprint-layout">
      <div className="card sprint-summary">
        <h3>Sprint actual</h3>
        <strong>{progress}%</strong>
        <p>{done.length} completadas · {active.length} activas</p>
        <div className="sprint-bar"><span style={{ width: `${progress}%` }} /></div>
      </div>
      <div className="card">
        <h3>Activas</h3>
        {active.map((task) => <button key={task.id} className="sprint-item" onClick={() => onOpen(task.id)}>{task.title}</button>)}
      </div>
      <div className="card">
        <h3>Completadas</h3>
        {done.map((task) => <button key={task.id} className="sprint-item done" onClick={() => onOpen(task.id)}>{task.title}</button>)}
      </div>
    </div>
  )
}

export function TasksPage() {
  const tasks = useTasksStore((s) => s.tasks)
  const view = useTasksStore((s) => s.view)
  const loading = useTasksStore((s) => s.loading)
  const selectedId = useTasksStore((s) => s.selectedId)
  const load = useTasksStore((s) => s.load)
  const setView = useTasksStore((s) => s.setView)
  const add = useTasksStore((s) => s.add)
  const select = useTasksStore((s) => s.select)
  const remove = useTasksStore((s) => s.remove)
  const roles = useAuthStore((s) => s.roles)
  const session = useAuthStore((s) => s.session)
  const readonly = !canMutate(roles, session?.login)
  const [actionError, setActionError] = useState<string | null>(null)

  const deleteTaskWithConfirm = async (id: string, title: string) => {
    if (readonly) return
    if (!window.confirm(`¿Eliminar la tarea «${title}»? Esta acción no se puede deshacer.`)) return
    setActionError(null)
    const result = await remove(id)
    if (!result.ok) setActionError(result.error)
  }

  useEffect(() => { void load() }, [load])

  const tabs = useMemo(() => ([
    ['kanban', 'Kanban'],
    ['list', 'Lista'],
    ['timeline', 'Timeline'],
    ['sprint', 'Sprint'],
  ] as const), [])

  return <>
    <div className="page-title">
      <div><h1>Trabajo</h1><p>Operaciones, campañas y entregables en un solo lugar.</p></div>
      <button className="primary" disabled={readonly || loading} onClick={() => void add()} title={readonly ? 'Solo lectura (staff)' : undefined}>
        <Plus size={16}/>Nueva tarea
      </button>
    </div>
    {readonly && <p className="integration-note staff-readonly-banner">Modo staff: puedes ver tareas pero no modificarlas.</p>}
    {actionError && <p className="integration-note staff-readonly-banner">{actionError}</p>}
    <div className="view-tabs">
      {tabs.map(([id, label]) => (
        <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>{label}</button>
      ))}
    </div>
    {loading && tasks.length === 0 ? <p className="empty-state is-loading">Cargando tareas…</p> : null}
    {view === 'kanban' && !readonly ? (
      <DismissibleHint storageKey="ng-hint-kanban-drag">
        Arrastra las tarjetas entre columnas para cambiar el estado.
      </DismissibleHint>
    ) : null}
    {view === 'kanban' && <KanbanView tasks={tasks} readonly={readonly} onOpen={select} onDelete={(id, title) => void deleteTaskWithConfirm(id, title)} />}
    {view === 'list' && <ListView tasks={tasks} readonly={readonly} onOpen={select} onDelete={(id, title) => void deleteTaskWithConfirm(id, title)} />}
    {view === 'timeline' && <TimelineView tasks={tasks} onOpen={select} />}
    {view === 'sprint' && <SprintView tasks={tasks} onOpen={select} />}
    {selectedId && <TaskDetailPanel taskId={selectedId} readonly={readonly} onClose={() => select(null)} />}
  </>
}
