import { create } from 'zustand'
import {
  createTask,
  deleteTask,
  fetchTasks,
  moveTaskStatus,
  type TaskRecord,
  type TaskMutationResult,
} from '@/services/tasks'

type TasksState = {
  tasks: TaskRecord[]
  loading: boolean
  selectedId: string | null
  view: 'kanban' | 'list' | 'timeline' | 'sprint'
  load: () => Promise<void>
  select: (id: string | null) => void
  setView: (view: TasksState['view']) => void
  add: () => Promise<void>
  move: (id: string, status: TaskRecord['status']) => Promise<void>
  remove: (id: string) => Promise<TaskMutationResult>
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  loading: false,
  selectedId: null,
  view: 'kanban',
  load: async () => {
    set({ loading: true })
    try {
      set({ tasks: await fetchTasks() })
    } finally {
      set({ loading: false })
    }
  },
  select: (selectedId) => set({ selectedId }),
  setView: (view) => set({ view }),
  add: async () => {
    const created = await createTask({
      title: 'Nueva tarea',
      description: 'Describe el siguiente paso.',
      status: 'backlog',
      priority: 'medium',
      estimate: 1,
    })
    if (created) set({ tasks: [...get().tasks, created], selectedId: created.id })
  },
  move: async (id, status) => {
    set({ tasks: get().tasks.map((task) => task.id === id ? { ...task, status } : task) })
    await moveTaskStatus(id, status)
  },
  remove: async (id) => {
    const result = await deleteTask(id)
    if (result.ok) {
      set({
        tasks: get().tasks.filter((task) => task.id !== id),
        selectedId: get().selectedId === id ? null : get().selectedId,
      })
    }
    return result
  },
}))
