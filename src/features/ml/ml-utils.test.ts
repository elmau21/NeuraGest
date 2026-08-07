import { describe, expect, it } from 'vitest'
import type { MetricSnapshot, StreamEvent } from '@/services/metrics'
import type { PipelineItem } from '@/services/agency'
import {
  analyzeCategoryTypical,
  computeInactivityRisk,
  computeMaForecast,
  computeSnapshotStats,
  detectAnomalies,
  findOptimalSchedule,
  getViewerSeries,
  kMeansCluster,
  MIN_FORECAST_SAMPLES,
  scoreHighlightEnhanced,
} from './ml-utils'

function snap(
  login: string,
  viewers: number,
  capturedAt: string,
  isLive = true,
  category = 'Just Chatting',
): MetricSnapshot {
  return {
    id: 1,
    talentId: login,
    login,
    viewers,
    isLive,
    category,
    followers: 1000,
    capturedAt,
  }
}

const displayNames = { alice: 'Alice', bob: 'Bob', carol: 'Carol', dave: 'Dave' }

describe('detectAnomalies', () => {
  it('detecta picos con z-score alto', () => {
    const base = Array.from({ length: 10 }, (_, i) =>
      snap('alice', 100 + (i % 3), `2026-08-01T${String(10 + i).padStart(2, '0')}:00:00Z`),
    )
    base.push(snap('alice', 500, '2026-08-01T22:00:00Z'))

    const anomalies = detectAnomalies(base, displayNames, 2)
    expect(anomalies.length).toBeGreaterThan(0)
    expect(anomalies[0].login).toBe('alice')
    expect(anomalies[0].direction).toBe('spike')
    expect(Math.abs(anomalies[0].zScore)).toBeGreaterThanOrEqual(2)
  })

  it('ignora talentos con pocos snapshots live', () => {
    const rows = [
      snap('bob', 50, '2026-08-01T10:00:00Z'),
      snap('bob', 200, '2026-08-01T11:00:00Z'),
    ]
    expect(detectAnomalies(rows, displayNames)).toHaveLength(0)
  })
})

describe('kMeansCluster', () => {
  it('agrupa talentos en clusters', () => {
    const rows: MetricSnapshot[] = []
    for (let i = 0; i < 8; i += 1) {
      rows.push(snap('alice', 200 + i * 5, `2026-08-0${1 + (i % 3)}T${10 + i}:00:00Z`))
      rows.push(snap('bob', 30 + i, `2026-08-0${1 + (i % 3)}T${12 + i}:00:00Z`))
      rows.push(snap('carol', 120 + i * 2, `2026-08-0${1 + (i % 3)}T${14 + i}:00:00Z`))
      rows.push(snap('dave', 40 + i, `2026-08-0${1 + (i % 3)}T${16 + i}:00:00Z`))
    }

    const clusters = kMeansCluster(rows, displayNames, 4)
    expect(clusters.length).toBeGreaterThan(0)
    expect(clusters.some((c) => c.logins.includes('alice'))).toBe(true)
    expect(clusters.reduce((s, c) => s + c.logins.length, 0)).toBe(4)
  })
})

describe('computeInactivityRisk', () => {
  it('asigna riesgo alto tras días sin stream', () => {
    const oldDate = new Date(Date.now() - 10 * 86_400_000).toISOString()
    const rows = Array.from({ length: 8 }, (_, i) =>
      snap('alice', 80 + i, `2026-07-${String(20 + i).padStart(2, '0')}T18:00:00Z`),
    )
    const events: StreamEvent[] = [{
      id: 1,
      login: 'alice',
      eventType: 'stream.online',
      streamId: 's1',
      categoryName: 'Just Chatting',
      title: 'Live',
      occurredAt: oldDate,
    }]

    const risks = computeInactivityRisk(rows, events, displayNames)
    const alice = risks.find((r) => r.login === 'alice')
    expect(alice).toBeDefined()
    expect(alice!.riskScore).toBeGreaterThanOrEqual(40)
    expect(['alto', 'crítico']).toContain(alice!.riskLevel)
  })
})

describe('analyzeCategoryTypical', () => {
  it('marca categoría atípica cuando difiere de la dominante', () => {
    const rows = [
      ...Array.from({ length: 6 }, (_, i) =>
        snap('alice', 100, `2026-08-01T${10 + i}:00:00Z`, true, 'Just Chatting'),
      ),
      snap('alice', 100, '2026-08-01T20:00:00Z', true, 'Valorant'),
    ]

    const insights = analyzeCategoryTypical(rows, displayNames, { alice: 'Valorant' })
    const alice = insights.find((c) => c.login === 'alice')
    expect(alice?.typicalCategory).toBe('Just Chatting')
    expect(alice?.isAtypical).toBe(true)
  })
})

describe('findOptimalSchedule', () => {
  it('devuelve franjas con mayor avg viewers', () => {
    const rows = [
      ...Array.from({ length: 4 }, () => snap('alice', 200, '2026-08-04T20:00:00Z')),
      ...Array.from({ length: 4 }, () => snap('alice', 50, '2026-08-05T08:00:00Z')),
    ]
    const slots = findOptimalSchedule(rows, displayNames, 1)
    expect(slots.length).toBeGreaterThan(0)
    expect(slots[0].avgViewers).toBeGreaterThanOrEqual(slots[slots.length - 1]?.avgViewers ?? 0)
  })
})

describe('computeMaForecast', () => {
  it('proyecta viewers futuros con media móvil', () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      snap('alice', 100 + i * 10, `2026-08-01T${String(10 + i).padStart(2, '0')}:00:00Z`),
    )
    const { historical, projected } = computeMaForecast(rows, 'alice', 3)
    expect(historical.length).toBe(10)
    expect(projected).toHaveLength(3)
    expect(projected.every((v) => v >= 0)).toBe(true)
  })

  it('usa snapshots con viewers aunque isLive sea false', () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      snap('alice', 50 + i * 5, `2026-08-01T${String(10 + i).padStart(2, '0')}:00:00Z`, false),
    )
    const { historical } = computeMaForecast(rows, 'alice', 3, 5, 'viewers')
    expect(historical.length).toBe(10)
  })
})

describe('getViewerSeries', () => {
  it('incluye puntos con viewers>0 aunque no estén live', () => {
    const rows = [
      snap('alice', 120, '2026-08-01T10:00:00Z', false),
      snap('alice', 0, '2026-08-01T11:00:00Z', false),
      snap('alice', 80, '2026-08-01T12:00:00Z', false),
    ]
    expect(getViewerSeries(rows, 'alice', 'viewers')).toHaveLength(2)
    expect(getViewerSeries(rows, 'alice', 'live')).toHaveLength(0)
  })
})

describe('computeSnapshotStats', () => {
  it('cuenta talentos entrenables con viewers>0', () => {
    const rows = Array.from({ length: MIN_FORECAST_SAMPLES }, (_, i) =>
      snap('alice', 100 + i, `2026-08-01T${String(10 + i).padStart(2, '0')}:00:00Z`, false),
    )
    const stats = computeSnapshotStats(rows, ['alice'], MIN_FORECAST_SAMPLES, 'viewers')
    expect(stats.withViewers).toBe(MIN_FORECAST_SAMPLES)
    expect(stats.live).toBe(0)
    expect(stats.trainableLogins).toBe(1)
    expect(stats.perLogin.alice.trainable).toBe(true)
  })
})

describe('scoreHighlightEnhanced', () => {
  it('aumenta score con pico anómalo y cluster top', () => {
    const item: PipelineItem = {
      id: 'h1',
      title: 'Clip épico',
      contentType: 'clip',
      status: 'idea',
      talentLogin: 'alice',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      position: 0,
    }
    const snapshots = Array.from({ length: 8 }, (_, i) =>
      snap('alice', 150, `2026-08-01T${10 + i}:00:00Z`),
    )
    const anomalies = [{
      login: 'alice',
      displayName: 'Alice',
      capturedAt: snapshots[0].capturedAt,
      viewers: 400,
      zScore: 3.2,
      severity: 'high' as const,
      direction: 'spike' as const,
    }]
    const clusters = [{
      clusterId: 0,
      label: 'Top performers',
      logins: ['alice'],
      centroid: { avgViewers: 200, liveRate: 0.8, streamDays: 5 },
    }]

    const scored = scoreHighlightEnhanced(item, snapshots, [], anomalies, clusters)
    expect(scored.score).toBeGreaterThan(50)
    expect(scored.mlBoost).toBeGreaterThan(0)
  })
})
