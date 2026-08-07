import { beforeEach, describe, expect, it } from 'vitest'
import type { WorkTask } from '@/types'
import { useAppStore } from './app-store'

const sampleTasks: WorkTask[] = [
  { id: 't1', title: 'Tarea de prueba', description: '', status: 'backlog', priority: 'medium', assignee: 'Sin asignar', tags: [], estimate: 1 },
]

describe('app store offline-first', () => {
  beforeEach(() => useAppStore.setState({ tasks: structuredClone(sampleTasks) }))

  it('precarga los diez canales Twitch obligatorios', () => {
    const talents = useAppStore.getState().talents
    expect(talents.map((talent) => talent.login)).toEqual([
      'arikyu_', 'nosomevt', 'kumitacui', 'ryonikku', 'suimivt',
      'tesitoazul', 'shisuvr', 'bhikoruvt', 'ashitakaseiren', 'cold__vt',
    ])
    expect(talents.find((talent) => talent.login === 'nosomevt')?.displayName).toBe('Nosome')
  })

  it('mueve una tarea entre columnas', () => {
    const id = useAppStore.getState().tasks[0].id
    useAppStore.getState().moveTask(id, 'done')
    expect(useAppStore.getState().tasks.find((task) => task.id === id)?.status).toBe('done')
  })

  it('agrega tareas locales', () => {
    const before = useAppStore.getState().tasks.length
    useAppStore.getState().addTask({ id: 'new', title: 'Nueva', description: '', status: 'backlog', priority: 'medium', assignee: 'Ana', tags: [], estimate: 1 })
    expect(useAppStore.getState().tasks).toHaveLength(before + 1)
  })
})
