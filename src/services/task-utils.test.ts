import { describe, expect, it } from 'vitest'
import type { TaskRecord } from '@/services/tasks'
import {
  filterTasksByTime,
  isDueTodayTask,
  isOverdueTask,
  overdueTasks,
  pendingTasks,
  recentlyCompletedTasks,
  taskSummaryCounts,
} from '@/services/task-utils'

const now = new Date('2026-08-13T15:00:00')

function task(partial: Partial<TaskRecord> & { id: string; title: string }): TaskRecord {
  return {
    description: '',
    status: 'progress',
    priority: 'medium',
    assignee: 'Equipo',
    assignees: [],
    tags: [],
    estimate: 1,
    position: 0,
    category: 'General',
    ...partial,
  }
}

describe('task-utils', () => {
  describe('isOverdueTask', () => {
    it('marca vencidas abiertas', () => {
      expect(isOverdueTask(task({ id: '1', title: 'X', dueDate: '2026-08-10' }), now)).toBe(true)
      expect(isOverdueTask(task({ id: '2', title: 'Y', dueDate: '2026-08-14' }), now)).toBe(false)
    })

    it('ignora completadas', () => {
      expect(
        isOverdueTask(task({ id: '3', title: 'Z', dueDate: '2026-08-10', status: 'done' }), now),
      ).toBe(false)
    })
  })

  describe('isDueTodayTask', () => {
    it('detecta vencimiento hoy', () => {
      expect(isDueTodayTask(task({ id: '1', title: 'Hoy', dueDate: '2026-08-13' }), now)).toBe(true)
      expect(isDueTodayTask(task({ id: '2', title: 'Mañana', dueDate: '2026-08-14' }), now)).toBe(false)
    })
  })

  describe('filterTasksByTime', () => {
    const tasks = [
      task({ id: '1', title: 'Vencida', dueDate: '2026-08-10' }),
      task({ id: '2', title: 'Hoy', dueDate: '2026-08-13' }),
      task({ id: '3', title: 'Semana', dueDate: '2026-08-16' }),
      task({ id: '4', title: 'Lejos', dueDate: '2026-08-25' }),
    ]

    it('filtra atrasadas', () => {
      expect(filterTasksByTime(tasks, 'overdue', now).map((t) => t.id)).toEqual(['1'])
    })

    it('filtra hoy', () => {
      expect(filterTasksByTime(tasks, 'today', now).map((t) => t.id)).toEqual(['2'])
    })

    it('filtra semana (incluye hoy y futuro cercano)', () => {
      const ids = filterTasksByTime(tasks, 'week', now).map((t) => t.id)
      expect(ids).toContain('2')
      expect(ids).toContain('3')
      expect(ids).not.toContain('1')
    })
  })

  describe('taskSummaryCounts', () => {
    it('resume pendientes, atrasadas y completadas', () => {
      const tasks = [
        task({ id: '1', title: 'P1', status: 'backlog' }),
        task({ id: '2', title: 'P2', status: 'progress', dueDate: '2026-08-10' }),
        task({ id: '3', title: 'Pronto', dueDate: '2026-08-15' }),
        task({ id: '4', title: 'Hecha', status: 'done', updatedAt: '2026-08-13T10:00:00Z' }),
      ]
      const counts = taskSummaryCounts(tasks, now)
      expect(counts.pending).toBe(3)
      expect(counts.overdue).toBe(1)
      expect(counts.completedRecent).toBe(1)
    })
  })

  describe('pendingTasks / overdueTasks / recentlyCompletedTasks', () => {
    it('agrupa listas del panel', () => {
      const tasks = [
        task({ id: '1', title: 'Backlog', status: 'backlog' }),
        task({ id: '2', title: 'Late', dueDate: '2026-08-01' }),
        task({ id: '3', title: 'Done', status: 'done', updatedAt: '2026-08-12T12:00:00Z' }),
      ]
      expect(pendingTasks(tasks)).toHaveLength(2)
      expect(overdueTasks(tasks, now)).toHaveLength(1)
      expect(recentlyCompletedTasks(tasks)).toHaveLength(1)
    })
  })
})
