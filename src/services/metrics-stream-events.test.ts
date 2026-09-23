import { describe, expect, it } from 'vitest'
import { mapStreamEvent } from '@/services/metrics'

describe('mapStreamEvent', () => {
  it('mapea camelCase desde Tauri', () => {
    const mapped = mapStreamEvent({
      id: 1,
      login: 'alice',
      eventType: 'stream.online',
      streamId: 's1',
      categoryName: 'Just Chatting',
      title: 'Hola',
      occurredAt: '2026-09-23T00:00:00Z',
    })
    expect(mapped).toEqual({
      id: 1,
      login: 'alice',
      eventType: 'stream.online',
      streamId: 's1',
      categoryName: 'Just Chatting',
      title: 'Hola',
      payload: null,
      occurredAt: '2026-09-23T00:00:00Z',
    })
  })

  it('conserva payload de raid/shared chat', () => {
    const mapped = mapStreamEvent({
      id: 4,
      login: 'arikyu_',
      eventType: 'channel.raid',
      occurredAt: '2026-09-23T01:00:00Z',
      payload: { fromLogin: 'ally', toLogin: 'arikyu_', viewers: 50 },
    })
    expect(mapped?.payload).toEqual({ fromLogin: 'ally', toLogin: 'arikyu_', viewers: 50 })
  })

  it('normaliza snake_case crudo de Supabase (causa raíz pantalla negra)', () => {
    const mapped = mapStreamEvent({
      id: 2,
      login: 'bob',
      event_type: 'stream.offline',
      stream_id: null,
      category_name: null,
      title: null,
      occurred_at: '2026-09-22T12:00:00Z',
    })
    expect(mapped?.occurredAt).toBe('2026-09-22T12:00:00Z')
    expect(mapped?.eventType).toBe('stream.offline')
    expect(mapped?.login).toBe('bob')
  })

  it('descarta filas sin occurredAt (evita crash localeCompare)', () => {
    expect(
      mapStreamEvent({
        id: 3,
        login: 'carol',
        eventType: 'channel.follow',
      }),
    ).toBeNull()
  })
})
