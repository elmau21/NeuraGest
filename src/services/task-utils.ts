import type { Priority, TaskStatus } from '@/types'
import type { TaskRecord } from '@/services/tasks'

export type TaskTimeFilter = 'all' | 'overdue' | 'today' | 'week'

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: 'Pendiente',
  progress: 'En progreso',
  review: 'En revisión',
  done: 'Completada',
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Normal',
  low: 'Baja',
}

export const PRIORITY_EMOJI: Record<Priority, string> = {
  urgent: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🟢',
}

export const TASK_CATEGORIES = [
  'General',
  'Operaciones',
  'Diseño',
  'NeuraLeague',
  'CRM',
  'Talentos',
  'Calendario',
] as const

export type TaskCategory = (typeof TASK_CATEGORIES)[number]

function isoDate(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

export function isOpenTask(task: TaskRecord): boolean {
  return task.status !== 'done'
}

export function isOverdueTask(task: TaskRecord, now = new Date()): boolean {
  if (!isOpenTask(task) || !task.dueDate) return false
  return task.dueDate < isoDate(now)
}

export function isDueTodayTask(task: TaskRecord, now = new Date()): boolean {
  if (!isOpenTask(task) || !task.dueDate) return false
  return task.dueDate === isoDate(now)
}

export function isDueThisWeekTask(task: TaskRecord, now = new Date()): boolean {
  if (!isOpenTask(task) || !task.dueDate) return false
  const today = isoDate(now)
  if (task.dueDate < today) return false
  const end = new Date(now)
  end.setDate(end.getDate() + 7)
  return task.dueDate <= isoDate(end)
}

export function isDueSoonTask(task: TaskRecord, now = new Date()): boolean {
  if (!isOpenTask(task) || !task.dueDate) return false
  const today = isoDate(now)
  if (task.dueDate <= today) return false
  const end = new Date(now)
  end.setDate(end.getDate() + 3)
  return task.dueDate <= isoDate(end)
}

export function filterTasksByTime(tasks: TaskRecord[], filter: TaskTimeFilter, now = new Date()): TaskRecord[] {
  switch (filter) {
    case 'overdue':
      return tasks.filter((t) => isOverdueTask(t, now))
    case 'today':
      return tasks.filter((t) => isDueTodayTask(t, now))
    case 'week':
      return tasks.filter((t) => isDueThisWeekTask(t, now))
    case 'all':
    default:
      return tasks
  }
}

export function pendingTasks(tasks: TaskRecord[]): TaskRecord[] {
  return tasks.filter((t) => t.status === 'backlog' || t.status === 'progress')
}

export function overdueTasks(tasks: TaskRecord[], now = new Date()): TaskRecord[] {
  return tasks.filter((t) => isOverdueTask(t, now))
}

export function dueSoonTasks(tasks: TaskRecord[], now = new Date()): TaskRecord[] {
  return tasks.filter((t) => isDueSoonTask(t, now))
}

export function recentlyCompletedTasks(tasks: TaskRecord[], limit = 8): TaskRecord[] {
  return tasks
    .filter((t) => t.status === 'done')
    .sort((a, b) => (b.updatedAt ?? b.createdAt ?? '').localeCompare(a.updatedAt ?? a.createdAt ?? ''))
    .slice(0, limit)
}

export function taskSummaryCounts(tasks: TaskRecord[], now = new Date()) {
  const open = tasks.filter(isOpenTask)
  return {
    pending: pendingTasks(tasks).length,
    overdue: overdueTasks(tasks, now).length,
    dueSoon: dueSoonTasks(tasks, now).length,
    completedRecent: recentlyCompletedTasks(tasks).length,
    open: open.length,
    total: tasks.length,
  }
}

export function formatDueLabel(dueDate?: string, now = new Date()): string {
  if (!dueDate) return 'Sin fecha'
  const today = isoDate(now)
  if (dueDate < today) return `Atrasada · ${dueDate}`
  if (dueDate === today) return 'Vence hoy'
  return dueDate
}
