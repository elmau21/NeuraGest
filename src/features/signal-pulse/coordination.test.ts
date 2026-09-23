import { describe, expect, it } from 'vitest'
import type { StreamEvent } from '@/services/metrics'
import {
  buildRaidItems,
  buildSharedChatSessions,
  filterCoordinationEvents,
  matchesTalentFilter,
} from './coordination'

function ev(
  partial: Partial<StreamEvent> & Pick<StreamEvent, 'id' | 'login' | 'eventType' | 'occurredAt'>,
): StreamEvent {
  return {
    streamId: null,
    categoryName: null,
    title: null,
    payload: null,
    ...partial,
  }
}

describe('coordination', () => {
  const now = new Date('2026-09-23T12:00:00Z')

  it('filtra solo raids/shared chat en la ventana', () => {
    const rows = [
      ev({
        id: 1,
        login: 'arikyu_',
        eventType: 'channel.raid',
        occurredAt: '2026-09-23T11:00:00Z',
        payload: { fromLogin: 'ally', toLogin: 'arikyu_', viewers: 40 },
      }),
      ev({
        id: 2,
        login: 'arikyu_',
        eventType: 'stream.online',
        occurredAt: '2026-09-23T11:30:00Z',
      }),
      ev({
        id: 3,
        login: 'nosomevt',
        eventType: 'channel.raid',
        occurredAt: '2026-09-20T11:00:00Z',
      }),
    ]
    const filtered = filterCoordinationEvents(rows, 24, now)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe(1)
  })

  it('arma raids from→to con viewers', () => {
    const raids = buildRaidItems(
      [
        ev({
          id: 10,
          login: 'arikyu_',
          eventType: 'channel.raid',
          occurredAt: '2026-09-23T11:55:00Z',
          payload: {
            fromLogin: 'ally',
            fromName: 'Ally',
            toLogin: 'arikyu_',
            toName: 'Arikyu',
            viewers: 120,
          },
        }),
      ],
      now,
    )
    expect(raids).toHaveLength(1)
    expect(raids[0].fromLogin).toBe('ally')
    expect(raids[0].toLogin).toBe('arikyu_')
    expect(raids[0].viewers).toBe(120)
    expect(raids[0].recent).toBe(true)
  })

  it('agrupa shared chat y marca en curso hasta end', () => {
    const sessions = buildSharedChatSessions([
      ev({
        id: 1,
        login: 'arikyu_',
        eventType: 'channel.shared_chat.begin',
        streamId: 'sess-1',
        occurredAt: '2026-09-23T10:00:00Z',
        payload: {
          sessionId: 'sess-1',
          hostLogin: 'arikyu_',
          participants: [
            { login: 'arikyu_', name: 'Arikyu' },
            { login: 'guest', name: 'Guest' },
          ],
        },
      }),
      ev({
        id: 2,
        login: 'arikyu_',
        eventType: 'channel.shared_chat.update',
        streamId: 'sess-1',
        occurredAt: '2026-09-23T10:30:00Z',
        payload: {
          sessionId: 'sess-1',
          hostLogin: 'arikyu_',
          participants: [
            { login: 'arikyu_', name: 'Arikyu' },
            { login: 'guest', name: 'Guest' },
            { login: 'third', name: 'Third' },
          ],
        },
      }),
    ])
    expect(sessions).toHaveLength(1)
    expect(sessions[0].active).toBe(true)
    expect(sessions[0].participantLogins).toEqual(['arikyu_', 'guest', 'third'])

    const closed = buildSharedChatSessions([
      ...[
        ev({
          id: 1,
          login: 'arikyu_',
          eventType: 'channel.shared_chat.begin',
          occurredAt: '2026-09-23T10:00:00Z',
          payload: { sessionId: 'sess-1', hostLogin: 'arikyu_' },
        }),
        ev({
          id: 3,
          login: 'arikyu_',
          eventType: 'channel.shared_chat.end',
          occurredAt: '2026-09-23T11:00:00Z',
          payload: { sessionId: 'sess-1', hostLogin: 'arikyu_' },
        }),
      ],
    ])
    expect(closed[0].active).toBe(false)
    expect(closed[0].status).toBe('end')
  })

  it('filtra por talento en raid y shared chat', () => {
    const raid = buildRaidItems([
      ev({
        id: 1,
        login: 'arikyu_',
        eventType: 'channel.raid',
        occurredAt: '2026-09-23T11:00:00Z',
        payload: { fromLogin: 'ally', toLogin: 'arikyu_', viewers: 1 },
      }),
    ])[0]
    expect(matchesTalentFilter(raid, 'arikyu_')).toBe(true)
    expect(matchesTalentFilter(raid, 'nosomevt')).toBe(false)
  })
})
