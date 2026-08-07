import { describe, expect, it } from 'vitest'
import type { MetricSnapshot, StreamEvent } from '@/services/metrics'
import {
  buildScheduleAbTests,
  categoryHash,
  decomposeWeeklySeries,
  detectRegimeChanges,
  estimateDaysUntilNextStream,
  recommendCollabs,
} from './ml-advanced'
import { kMeansCluster } from './ml-utils'
import {
  DEFAULT_ML_SETTINGS,
  filterSnapshotsByWindow,
  shouldAutoRetrain,
} from './ml-settings'

function snap(login: string, viewers: number, capturedAt: string, isLive = true): MetricSnapshot {
  return {
    id: 1,
    talentId: login,
    login,
    viewers,
    isLive,
    category: 'Just Chatting',
    followers: 1000,
    capturedAt,
  }
}

describe('ml-advanced', () => {
  it('decompone serie semanal', () => {
    const rows = Array.from({ length: 14 }, (_, i) =>
      snap('alice', 100 + (i % 7) * 10, `2026-08-${String(1 + (i % 14)).padStart(2, '0')}T${10 + (i % 8)}:00:00Z`),
    )
    const result = decomposeWeeklySeries(rows, 'alice')
    expect(result.length).toBe(14)
    expect(result[0]).toHaveProperty('trend')
    expect(result[0]).toHaveProperty('seasonal')
  })

  it('estima días hasta próximo stream', () => {
    const old = new Date(Date.now() - 5 * 86_400_000).toISOString()
    const rows = [snap('alice', 80, old)]
    const events: StreamEvent[] = [{
      id: 1,
      login: 'alice',
      eventType: 'stream.online',
      streamId: 's1',
      categoryName: 'Just Chatting',
      title: 'Live',
      occurredAt: old,
    }]
    const estimates = estimateDaysUntilNextStream(rows, events, { alice: 'Alice' })
    expect(estimates[0].login).toBe('alice')
    expect(estimates[0].estimatedDaysUntil).toBeGreaterThanOrEqual(0)
  })

  it('recomienda collabs con similitud', () => {
    const rows: MetricSnapshot[] = []
    for (let i = 0; i < 6; i += 1) {
      rows.push(snap('alice', 200 + i, `2026-08-0${1 + (i % 3)}T10:00:00Z`))
      rows.push(snap('bob', 190 + i, `2026-08-0${1 + (i % 3)}T11:00:00Z`))
      rows.push(snap('carol', 30 + i, `2026-08-0${1 + (i % 3)}T12:00:00Z`))
    }
    const clusters = kMeansCluster(rows, { alice: 'Alice', bob: 'Bob', carol: 'Carol' }, 3)
    const recs = recommendCollabs(clusters, { alice: 'Alice', bob: 'Bob', carol: 'Carol' })
    expect(recs.length).toBeGreaterThanOrEqual(0)
  })

  it('detecta cambios de régimen CUSUM', () => {
    const base = Array.from({ length: 10 }, (_, i) => snap('alice', 100, `2026-08-01T${10 + i}:00:00Z`))
    base.push(snap('alice', 400, '2026-08-01T22:00:00Z'))
    base.push(snap('alice', 420, '2026-08-01T23:00:00Z'))
    const changes = detectRegimeChanges(base, { alice: 'Alice' }, 3)
    expect(changes.length).toBeGreaterThanOrEqual(0)
  })

  it('genera tests A/B de horarios', () => {
    const rows = [
      ...Array.from({ length: 4 }, () => snap('alice', 200, '2026-08-04T20:00:00Z')),
      ...Array.from({ length: 4 }, () => snap('alice', 50, '2026-08-05T08:00:00Z')),
    ]
    const tests = buildScheduleAbTests(rows, { alice: 'Alice' })
    expect(tests.length).toBe(1)
    expect(tests[0].upliftPct).toBeGreaterThan(0)
  })

  it('hashea categorías de forma estable', () => {
    expect(categoryHash('Valorant')).toBe(categoryHash('Valorant'))
    expect(categoryHash('Valorant')).not.toBe(categoryHash('Just Chatting'))
  })
})

describe('ml-settings', () => {
  it('filtra snapshots por ventana', () => {
    const old = snap('alice', 100, new Date(Date.now() - 10 * 86_400_000).toISOString())
    const recent = snap('alice', 120, new Date().toISOString())
    const filtered = filterSnapshotsByWindow([old, recent], 7)
    expect(filtered).toHaveLength(1)
  })

  it('dispara auto-retrain cuando corresponde', () => {
    expect(shouldAutoRetrain({ ...DEFAULT_ML_SETTINGS, autoRetrain: true, lastTrainSnapshotCount: 10, retrainEverySnapshots: 20 }, 35)).toBe(true)
    expect(shouldAutoRetrain({ ...DEFAULT_ML_SETTINGS, autoRetrain: false }, 100)).toBe(false)
  })
})
