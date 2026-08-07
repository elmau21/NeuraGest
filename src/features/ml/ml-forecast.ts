import type { MetricSnapshot } from '@/services/metrics'
import {
  categoryHash,
  computeFeatureImportance,
  RICH_FEATURE_NAMES,
} from './ml-advanced'
import {
  clearStoredModels as clearAllStoredModels,
  getStoredModelsSync,
  loadStoredModels,
  saveStoredModels,
} from './ml-storage'
import {
  computeMaForecast,
  getViewerSeries,
  MIN_FORECAST_SAMPLES,
  type ForecastSeriesMode,
} from './ml-utils'

export type ModelKind = 'dense' | 'seq-mlp'

export type TrainedModelMeta = {
  login: string
  inputSize: number
  hiddenSize: number
  w1: number[][]
  b1: number[]
  w2: number[]
  b2: number
  r2: number
  mae: number
  holdOutR2: number
  holdOutMae: number
  trainedAt: string
  sampleCount: number
  modelKind: ModelKind
  featureNames: string[]
  /** Segunda capa oculta (seq-mlp) serializada */
  w1b?: number[][]
  b1b?: number[]
}

export type ForecastPoint = {
  at: string
  viewers?: number
  ma?: number
  tf?: number
  seq?: number
  naive?: number
}

export type ForecastResult = {
  login: string
  historical: ForecastPoint[]
  projected: { period: number; ma: number; tf?: number; seq?: number; naive: number }[]
  modelType: 'tfjs' | 'ma-fallback'
  modelKind?: ModelKind
  r2?: number
  mae?: number
  holdOutR2?: number
  holdOutMae?: number
  trainedAt?: string
  featureImportance?: { feature: string; contribution: number }[]
  bestModel: 'ma' | 'tf' | 'seq' | 'naive'
}

export type TrainSkipReason = 'insufficient_samples' | 'insufficient_training_pairs'

export type TrainSkip = {
  login: string
  samples: number
  reason: TrainSkipReason
}

export type TrainAllResult = {
  models: TrainedModelMeta[]
  skipped: TrainSkip[]
  seriesMode: ForecastSeriesMode
}

const HIDDEN_UNITS = 8
const SEQ_HIDDEN = 16

export function computeR2(actual: number[], predicted: number[]): number {
  if (actual.length === 0) return 0
  const mean = actual.reduce((s, v) => s + v, 0) / actual.length
  const ssTot = actual.reduce((s, v) => s + (v - mean) ** 2, 0)
  const ssRes = actual.reduce((s, v, i) => s + (v - predicted[i]) ** 2, 0)
  return ssTot > 0 ? 1 - ssRes / ssTot : 0
}

export function computeMae(actual: number[], predicted: number[]): number {
  if (actual.length === 0) return 0
  return actual.reduce((s, v, i) => s + Math.abs(v - predicted[i]), 0) / actual.length
}

function relu(value: number): number {
  return Math.max(0, value)
}

function densePredict(
  w1: number[][],
  b1: number[],
  w2: number[],
  b2: number,
  x: number[],
  w1b?: number[][],
  b1b?: number[],
): number {
  let hidden = b1.map((bias, j) => {
    const sum = x.reduce((s, val, i) => s + val * (w1[i]?.[j] ?? 0), 0)
    return relu(sum + bias)
  })

  if (w1b && b1b) {
    hidden = b1b.map((bias, j) => {
      const sum = hidden.reduce((s, val, i) => s + val * (w1b[i]?.[j] ?? 0), 0)
      return relu(sum + bias)
    })
  }

  return hidden.reduce((s, h, j) => s + h * (w2[j] ?? 0), b2)
}

function splitTrainTest(x: number[][], y: number[], ratio = 0.8) {
  const splitIdx = Math.max(4, Math.floor(x.length * ratio))
  return {
    xTrain: x.slice(0, splitIdx),
    yTrain: y.slice(0, splitIdx),
    xTest: x.slice(splitIdx),
    yTest: y.slice(splitIdx),
  }
}

export function buildRichFeatureVector(
  rows: MetricSnapshot[],
  index: number,
  offset = 0,
): number[] {
  const t = (index + offset) / (rows.length + offset)
  const prev1 = rows[index - 1]?.viewers ?? 0
  const prev2 = rows[index - 2]?.viewers ?? prev1
  const prev3 = rows[index - 3]?.viewers ?? prev2
  const capturedAt = rows[index]?.capturedAt ?? new Date().toISOString()
  const date = new Date(capturedAt)
  const hour = date.getHours() / 24
  const dow = date.getDay() / 7
  const cat = categoryHash(rows[index]?.category ?? undefined)
  return [t, prev1 / 1000, prev2 / 1000, prev3 / 1000, hour, dow, cat]
}

function buildTrainingData(rows: MetricSnapshot[]): { x: number[][]; y: number[] } {
  const x: number[][] = []
  const y: number[] = []

  for (let i = 3; i < rows.length; i += 1) {
    x.push(buildRichFeatureVector(rows, i))
    y.push(rows[i].viewers)
  }

  return { x, y }
}

type TrainResult = {
  w1: number[][]
  b1: number[]
  w2: number[]
  b2: number
  r2: number
  mae: number
  holdOutR2: number
  holdOutMae: number
  modelKind: ModelKind
  w1b?: number[][]
  b1b?: number[]
}

async function trainWithTfjs(
  xTrain: number[][],
  yTrain: number[],
  xTest: number[][],
  yTest: number[],
  seqMode = false,
): Promise<TrainResult> {
  const tf = await import('@tensorflow/tfjs')
  const inputSize = xTrain[0].length
  const hidden1 = seqMode ? SEQ_HIDDEN : HIDDEN_UNITS

  const xs = tf.tensor2d(xTrain)
  const ys = tf.tensor2d(yTrain, [yTrain.length, 1])

  const model = tf.sequential()
  model.add(tf.layers.dense({ units: hidden1, activation: 'relu', inputShape: [inputSize] }))
  if (seqMode) {
    model.add(tf.layers.dense({ units: HIDDEN_UNITS, activation: 'relu' }))
  }
  model.add(tf.layers.dense({ units: 1 }))
  model.compile({ optimizer: tf.train.adam(0.05), loss: 'meanSquaredError' })

  await model.fit(xs, ys, {
    epochs: seqMode ? 80 : 100,
    verbose: 0,
    batchSize: Math.min(32, xTrain.length),
  })

  const layer0 = model.layers[0].getWeights()
  const w1 = layer0[0].arraySync() as number[][]
  const b1 = layer0[1].arraySync() as number[]

  let w1b: number[][] | undefined
  let b1b: number[] | undefined
  let outLayerIdx = 1

  if (seqMode) {
    const layer1 = model.layers[1].getWeights()
    w1b = layer1[0].arraySync() as number[][]
    b1b = layer1[1].arraySync() as number[]
    outLayerIdx = 2
  }

  const outLayer = model.layers[outLayerIdx].getWeights()
  const outKernel = outLayer[0].arraySync() as number[][]
  const outBias = outLayer[1].arraySync() as number[]
  const w2 = outKernel.map((row) => row[0])
  const b2 = outBias[0]

  const predictAll = (rows: number[][]) =>
    rows.map((row) => densePredict(w1, b1, w2, b2, row, w1b, b1b))

  const trainPred = predictAll(xTrain)
  const testPred = predictAll(xTest.length ? xTest : xTrain.slice(-2))

  xs.dispose()
  ys.dispose()
  model.dispose()

  return {
    w1,
    b1,
    w2,
    b2,
    w1b,
    b1b,
    modelKind: seqMode ? 'seq-mlp' : 'dense',
    r2: Math.round(computeR2(yTrain, trainPred) * 1000) / 1000,
    mae: Math.round(computeMae(yTrain, trainPred) * 10) / 10,
    holdOutR2: Math.round(computeR2(yTest.length ? yTest : yTrain.slice(-2), testPred) * 1000) / 1000,
    holdOutMae: Math.round(computeMae(yTest.length ? yTest : yTrain.slice(-2), testPred) * 10) / 10,
  }
}

function trainClassicalFallback(
  xTrain: number[][],
  yTrain: number[],
  xTest: number[][],
  yTest: number[],
): TrainResult {
  const inputSize = xTrain[0].length
  const w1 = Array.from({ length: inputSize }, () =>
    Array.from({ length: HIDDEN_UNITS }, () => (Math.random() - 0.5) * 0.1))
  const b1 = new Array(HIDDEN_UNITS).fill(0)
  const w2 = new Array(HIDDEN_UNITS).fill(1 / HIDDEN_UNITS)
  let b2 = yTrain.reduce((s, v) => s + v, 0) / yTrain.length

  for (let iter = 0; iter < 300; iter += 1) {
    const lr = 0.02
    for (let j = 0; j < HIDDEN_UNITS; j += 1) {
      let gradW2 = 0
      for (let i = 0; i < xTrain.length; i += 1) {
        const pred = densePredict(w1, b1, w2, b2, xTrain[i])
        const hidden = b1.map((bias, h) =>
          relu(xTrain[i].reduce((s, val, k) => s + val * (w1[k]?.[h] ?? 0), 0) + bias))
        gradW2 += (pred - yTrain[i]) * hidden[j]
      }
      w2[j] -= lr * gradW2 / xTrain.length
    }
    let gradB2 = 0
    for (let i = 0; i < xTrain.length; i += 1) {
      gradB2 += densePredict(w1, b1, w2, b2, xTrain[i]) - yTrain[i]
    }
    b2 -= lr * gradB2 / xTrain.length
  }

  const predictAll = (rows: number[][]) =>
    rows.map((row) => densePredict(w1, b1, w2, b2, row))

  const trainPred = predictAll(xTrain)
  const testPred = predictAll(xTest.length ? xTest : xTrain.slice(-2))

  return {
    w1,
    b1,
    w2,
    b2,
    modelKind: 'dense',
    r2: Math.round(computeR2(yTrain, trainPred) * 1000) / 1000,
    mae: Math.round(computeMae(yTrain, trainPred) * 10) / 10,
    holdOutR2: Math.round(computeR2(yTest.length ? yTest : yTrain.slice(-2), testPred) * 1000) / 1000,
    holdOutMae: Math.round(computeMae(yTest.length ? yTest : yTrain.slice(-2), testPred) * 10) / 10,
  }
}

export function getStoredModels(): Record<string, TrainedModelMeta> {
  return getStoredModelsSync()
}

export async function hydrateStoredModels(): Promise<Record<string, TrainedModelMeta>> {
  return loadStoredModels()
}

export async function clearStoredModels(): Promise<void> {
  await clearAllStoredModels()
}

export async function trainForecastModel(
  snapshots: MetricSnapshot[],
  login: string,
  useTfjs = true,
  seriesMode: ForecastSeriesMode = 'viewers',
  preferSeq = true,
): Promise<TrainedModelMeta | null> {
  const rows = getViewerSeries(snapshots, login, seriesMode)
  if (rows.length < MIN_FORECAST_SAMPLES) return null

  const { x, y } = buildTrainingData(rows)
  if (x.length < 4) return null

  const { xTrain, yTrain, xTest, yTest } = splitTrainTest(x, y)

  let denseResult: TrainResult
  let seqResult: TrainResult | null = null

  try {
    denseResult = useTfjs && xTrain.length >= 6
      ? await trainWithTfjs(xTrain, yTrain, xTest, yTest, false)
      : trainClassicalFallback(xTrain, yTrain, xTest, yTest)
  } catch {
    denseResult = trainClassicalFallback(xTrain, yTrain, xTest, yTest)
  }

  if (useTfjs && preferSeq && xTrain.length >= 10) {
    try {
      seqResult = await trainWithTfjs(xTrain, yTrain, xTest, yTest, true)
    } catch {
      seqResult = null
    }
  }

  const result = seqResult && seqResult.holdOutMae <= denseResult.holdOutMae
    ? seqResult
    : denseResult

  const meta: TrainedModelMeta = {
    login,
    inputSize: x[0].length,
    hiddenSize: result.modelKind === 'seq-mlp' ? SEQ_HIDDEN : HIDDEN_UNITS,
    w1: result.w1,
    b1: result.b1,
    w2: result.w2,
    b2: result.b2,
    w1b: result.w1b,
    b1b: result.b1b,
    r2: result.r2,
    mae: result.mae,
    holdOutR2: result.holdOutR2,
    holdOutMae: result.holdOutMae,
    trainedAt: new Date().toISOString(),
    sampleCount: x.length,
    modelKind: result.modelKind,
    featureNames: RICH_FEATURE_NAMES,
  }

  const models = getStoredModelsSync()
  models[login] = meta
  await saveStoredModels(models)
  return meta
}

export async function trainAllModels(
  snapshots: MetricSnapshot[],
  logins: string[],
  options?: {
    useTfjs?: boolean
    seriesMode?: ForecastSeriesMode
    onProgress?: (done: number, total: number, login: string) => void
  },
): Promise<TrainAllResult> {
  const seriesMode = options?.seriesMode ?? 'viewers'
  const useTfjs = options?.useTfjs ?? true
  const results: TrainedModelMeta[] = []
  const skipped: TrainSkip[] = []
  const eligible = logins.filter((login) => login.trim().length > 0)
  const total = eligible.length

  for (let i = 0; i < eligible.length; i += 1) {
    const login = eligible[i]
    options?.onProgress?.(i, total, login)

    const rows = getViewerSeries(snapshots, login, seriesMode)
    if (rows.length < MIN_FORECAST_SAMPLES) {
      skipped.push({ login, samples: rows.length, reason: 'insufficient_samples' })
      continue
    }

    const { x } = buildTrainingData(rows)
    if (x.length < 4) {
      skipped.push({ login, samples: rows.length, reason: 'insufficient_training_pairs' })
      continue
    }

    const meta = await trainForecastModel(snapshots, login, useTfjs, seriesMode)
    if (meta) results.push(meta)
    else skipped.push({ login, samples: rows.length, reason: 'insufficient_training_pairs' })
  }

  options?.onProgress?.(total, total, '')
  return { models: results, skipped, seriesMode }
}

function projectWithModel(
  model: TrainedModelMeta,
  rows: MetricSnapshot[],
  periods: number,
): number[] {
  const projected: number[] = []
  const synthetic = [...rows]
  for (let i = 0; i < periods; i += 1) {
    const index = synthetic.length
    const fakeRow: MetricSnapshot = {
      ...rows[rows.length - 1],
      capturedAt: new Date(Date.now() + i * 3_600_000).toISOString(),
      viewers: synthetic[synthetic.length - 1]?.viewers ?? 0,
    }
    synthetic.push(fakeRow)
    const features = buildRichFeatureVector(synthetic, index, periods)
    const pred = Math.max(0, Math.round(
      densePredict(model.w1, model.b1, model.w2, model.b2, features, model.w1b, model.b1b),
    ))
    projected.push(pred)
    synthetic[synthetic.length - 1] = { ...fakeRow, viewers: pred }
  }
  return projected
}

export function buildForecast(
  snapshots: MetricSnapshot[],
  login: string,
  periods = 6,
  seriesMode: ForecastSeriesMode = 'viewers',
  modelsOverride?: Record<string, TrainedModelMeta>,
): ForecastResult {
  const { historical: maHistorical, projected: maProjected } =
    computeMaForecast(snapshots, login, periods, 5, seriesMode)
  const models = modelsOverride ?? getStoredModelsSync()
  const model = models[login]
  const rows = getViewerSeries(snapshots, login, seriesMode)
  const lastViewer = rows[rows.length - 1]?.viewers ?? 0
  const naiveProjected = Array.from({ length: periods }, () => lastViewer)

  if (!model?.w1?.length) {
    return {
      login,
      historical: maHistorical.map((p) => ({
        at: p.at,
        viewers: p.viewers,
        ma: p.forecast,
        naive: p.viewers,
      })),
      projected: maProjected.map((ma, i) => ({
        period: i + 1,
        ma,
        naive: naiveProjected[i],
      })),
      modelType: 'ma-fallback',
      bestModel: 'ma',
    }
  }

  const tfProjected = projectWithModel(model, rows, periods)
  const isSeq = model.modelKind === 'seq-mlp'

  const enrichedHistorical: ForecastPoint[] = maHistorical.map((point, index) => {
    const base: ForecastPoint = {
      at: point.at,
      viewers: point.viewers,
      ma: point.forecast,
      naive: index > 0 ? maHistorical[index - 1].viewers : point.viewers,
    }
    if (index < 3 || index >= rows.length) return base

    const pred = Math.max(0, Math.round(
      densePredict(model.w1, model.b1, model.w2, model.b2,
        buildRichFeatureVector(rows, index), model.w1b, model.b1b),
    ))
    if (isSeq) return { ...base, seq: pred, tf: pred }
    return { ...base, tf: pred }
  })

  const projected = maProjected.map((ma, i) => ({
    period: i + 1,
    ma,
    tf: isSeq ? undefined : tfProjected[i],
    seq: isSeq ? tfProjected[i] : undefined,
    naive: naiveProjected[i],
  }))

  const recentActual = rows.slice(-6).map((r) => r.viewers)
  const maeScores = {
    ma: computeMae(recentActual, maHistorical.slice(-6).map((h) => h.forecast ?? h.viewers)),
    tf: computeMae(recentActual, enrichedHistorical.slice(-6).map((h) => h.tf ?? h.viewers ?? 0)),
    seq: computeMae(recentActual, enrichedHistorical.slice(-6).map((h) => h.seq ?? h.tf ?? h.viewers ?? 0)),
    naive: computeMae(recentActual, enrichedHistorical.slice(-6).map((h) => h.naive ?? h.viewers ?? 0)),
  }
  const bestModel = (Object.entries(maeScores).sort((a, b) => a[1] - b[1])[0][0]) as ForecastResult['bestModel']

  return {
    login,
    historical: enrichedHistorical,
    projected,
    modelType: 'tfjs',
    modelKind: model.modelKind,
    r2: model.r2,
    mae: model.mae,
    holdOutR2: model.holdOutR2,
    holdOutMae: model.holdOutMae,
    trainedAt: model.trainedAt,
    featureImportance: computeFeatureImportance(model.w1, model.featureNames ?? RICH_FEATURE_NAMES),
    bestModel,
  }
}

export function buildComparisonChartData(forecast: ForecastResult) {
  return [
    ...forecast.historical.map((p) => ({
      at: p.at,
      viewers: p.viewers,
      MA: p.ma,
      'TF.js': p.tf ?? p.seq,
      Naive: p.naive,
    })),
    ...forecast.projected.map((p) => ({
      at: `+${p.period}`,
      MA: p.ma,
      'TF.js': p.tf ?? p.seq,
      Naive: p.naive,
    })),
  ]
}
