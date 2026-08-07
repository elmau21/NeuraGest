import { beforeEach, describe, expect, it } from 'vitest'
import type { MetricSnapshot } from '@/services/metrics'
import {
  buildForecast,
  clearStoredModels,
  computeMae,
  computeR2,
  getStoredModels,
  trainAllModels,
  trainForecastModel,
} from './ml-forecast'

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

function buildSeries(login: string, count: number, base = 100): MetricSnapshot[] {
  return Array.from({ length: count }, (_, i) =>
    snap(login, base + i * 8 + (i % 3) * 5, `2026-08-01T${String(8 + (i % 12)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00Z`),
  )
}

describe('ml-forecast métricas', () => {
  it('calcula R² y MAE correctamente', () => {
    const actual = [10, 20, 30, 40]
    const predicted = [12, 18, 32, 38]
    expect(computeR2(actual, predicted)).toBeGreaterThan(0.9)
    expect(computeMae(actual, predicted)).toBe(2)
  })
})

describe('buildForecast', () => {
  beforeEach(() => {
    void clearStoredModels()
  })

  it('usa fallback MA sin modelo entrenado', () => {
    const rows = buildSeries('alice', 10)
    const forecast = buildForecast(rows, 'alice', 4)
    expect(forecast.modelType).toBe('ma-fallback')
    expect(forecast.projected).toHaveLength(4)
    expect(forecast.projected.every((p) => p.naive >= 0)).toBe(true)
  })

  it('entrena y cachea modelo con hold-out metrics', async () => {
    const rows = buildSeries('alice', 12)
    const meta = await trainForecastModel(rows, 'alice', false)
    expect(meta).not.toBeNull()
    expect(meta!.holdOutMae).toBeGreaterThanOrEqual(0)
    expect(meta!.holdOutR2).toBeDefined()
    expect(getStoredModels().alice).toBeDefined()
  })

  it('usa modelo cacheado para pronóstico TF.js', async () => {
    const rows = buildSeries('bob', 12, 80)
    await trainForecastModel(rows, 'bob', false)
    const forecast = buildForecast(rows, 'bob', 3)
    expect(forecast.modelType).toBe('tfjs')
    expect(forecast.holdOutR2).toBeDefined()
    expect(forecast.projected.every((p) => typeof p.tf === 'number' || typeof p.seq === 'number')).toBe(true)
  })

  it('retorna null si hay pocos snapshots', async () => {
    const rows = buildSeries('carol', 5)
    const meta = await trainForecastModel(rows, 'carol', false)
    expect(meta).toBeNull()
  })

  it('trainAllModels reporta omitidos y entrenados', async () => {
    const rows = [...buildSeries('alice', 12), ...buildSeries('eve', 3)]
    const result = await trainAllModels(rows, ['alice', 'eve'], { useTfjs: false, seriesMode: 'viewers' })
    expect(result.models.length).toBe(1)
    expect(result.models[0].login).toBe('alice')
    expect(result.skipped.some((s) => s.login === 'eve')).toBe(true)
  })
})
