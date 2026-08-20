import { describe, expect, it } from 'vitest'
import {
  buildControlInbox,
  buildOpsAlerts,
  collectDueTasks,
  collectTodayNlEvents,
  collectUncoveredLives,
} from './control-center-inbox'
import type { TaskRecord } from '@/services/tasks'
import type { Talent } from '@/types'
import type { TalentManagerRecord } from '@/services/agency'
import type { NlEvent } from '@/services/neuraleague/types'

const now = new Date('2026-08-13T15:00:00')

function task(partial: Partial<TaskRecord> & { id: string; title: string }): TaskRecord {
  return {
    description: '',
    status: 'progress',
    priority: 'medium',
    assignee: 'Equipo',
    assignees: [],
    tags: [],
    category: 'General',
    estimate: 1,
    position: 0,
    ...partial,
  }
}

function talent(partial: Partial<Talent> & { id: string; login: string }): Talent {
  return {
    displayName: partial.login,
    avatar: '',
    title: '',
    category: '',
    description: '',
    createdAt: '2026-01-01',
    viewers: 0,
    followers: 0,
    isLive: false,
    ...partial,
  }
}

describe('collectDueTasks', () => {
  it('incluye vencidas y de hoy, excluye futuras y hechas', () => {
    const items = collectDueTasks(
      [
        task({ id: '1', title: 'Vencida', dueDate: '2026-08-10', priority: 'high' }),
        task({ id: '2', title: 'Hoy', dueDate: '2026-08-13' }),
        task({ id: '3', title: 'Mañana', dueDate: '2026-08-14' }),
        task({ id: '4', title: 'Hecha', dueDate: '2026-08-10', status: 'done' }),
      ],
      now,
    )
    expect(items.map((i) => i.title)).toEqual(['Vencida', 'Hoy'])
    expect(items[0].priority).toBe('urgent')
    expect(items[0].actions).toContain('mark_done')
  })
})

describe('collectUncoveredLives', () => {
  it('marca lives sin manager cuando hay asignaciones', () => {
    const talents = [
      talent({ id: 'a', login: 'alpha', displayName: 'Alpha', isLive: true }),
      talent({ id: 'b', login: 'beta', displayName: 'Beta', isLive: true }),
    ]
    const managers: TalentManagerRecord[] = [
      {
        id: 'm1',
        talentId: 'a',
        talentLogin: 'alpha',
        talentDisplayName: 'Alpha',
        managerAppUserId: 'u1',
        managerLogin: 'boss',
        assignedAt: '2026-01-01',
      },
    ]
    const items = collectUncoveredLives(talents, managers)
    expect(items).toHaveLength(1)
    expect(items[0].talentLogin).toBe('beta')
  })

  it('si no hay asignaciones, marca todos los lives', () => {
    const talents = [talent({ id: 'a', login: 'alpha', isLive: true })]
    expect(collectUncoveredLives(talents, [])).toHaveLength(1)
  })
})

describe('collectTodayNlEvents', () => {
  it('filtra eventos del día local', () => {
    const events: NlEvent[] = [
      {
        id: 'e1',
        eventType: 'scrim',
        title: 'Scrim hoy',
        startsAt: '2026-08-13T18:00:00',
        status: 'scheduled',
        notes: '',
      },
      {
        id: 'e2',
        eventType: 'match',
        title: 'Mañana',
        startsAt: '2026-08-14T18:00:00',
        status: 'scheduled',
        notes: '',
      },
    ]
    expect(collectTodayNlEvents(events, now).map((i) => i.title)).toEqual(['Scrim hoy'])
  })
})

describe('buildControlInbox', () => {
  it('ordena por prioridad', () => {
    const inbox = buildControlInbox({
      tasks: [task({ id: '1', title: 'Media', dueDate: '2026-08-13', priority: 'low' })],
      talents: [talent({ id: 'a', login: 'alpha', isLive: true })],
      managers: [],
      briefs: [],
      tryouts: [],
      gaps: [],
      events: [],
      now,
    })
    expect(inbox[0].type).toBe('live_uncovered')
    expect(inbox[0].priority).toBe('urgent')
  })
})

describe('buildOpsAlerts', () => {
  it('alerta sync Twitch en error', () => {
    const alerts = buildOpsAlerts({
      helixStatus: 'error',
      talents: [],
      events: [],
      vods: [],
      now,
    })
    expect(alerts.some((a) => a.id === 'helix-error')).toBe(true)
  })

  it('alerta contrato por vencer en ventana', () => {
    const alerts = buildOpsAlerts({
      helixStatus: 'connected',
      talents: [],
      events: [],
      vods: [],
      contractEnds: [{ id: 'c1', title: 'Deal X', endsOn: '2026-08-20' }],
      now,
    })
    expect(alerts.some((a) => a.id === 'contract:c1')).toBe(true)
  })

  it('omite contratos sin fecha útil', () => {
    const alerts = buildOpsAlerts({
      helixStatus: 'connected',
      talents: [],
      events: [],
      vods: [],
      contractEnds: [],
      now,
    })
    expect(alerts.filter((a) => a.id.startsWith('contract:'))).toHaveLength(0)
  })
})
