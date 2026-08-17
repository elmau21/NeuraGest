import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  Brain,
  Clock,
  Database,
  FileDown,
  GitCompare,
  Layers,
  Loader2,
  Radio,
  Sparkles,
  Tag,
  Target,
  TrendingUp,
  Users,
  Zap,
  Calendar,
  Activity,
  HeartHandshake,
  LineChart,
} from '@/components/icons'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { useAppStore } from '@/stores/app-store'
import { useAuthStore } from '@/stores/auth-store'
import { useTalentDataSources } from '@/hooks/useTalentDataSources'
import { TalentSourceCounters } from '@/components/TalentSourceCounters'
import { historySeriesByLogin } from '@/services/metrics'
import { canMutate } from '@/services/permissions'
import { listPipelineItems } from '@/services/agency'
import { isTauri } from '@/services/twitch'
import { buildScheduleHeatmap, dayLabel } from '@/features/twitch-intelligence/twitch-intelligence-utils'
import {
  analyzeCategoryTypical,
  buildEnhancedHighlights,
  buildModelExplanations,
  computeInactivityRisk,
  computeSnapshotStats,
  detectAnomalies,
  findOptimalSchedule,
  kMeansCluster,
  MIN_FORECAST_SAMPLES,
  type ForecastSeriesMode,
} from './ml-utils'
import {
  buildComparisonChartData,
  buildForecast,
  hydrateStoredModels,
  trainAllModels,
  type TrainedModelMeta,
  type TrainAllResult,
} from './ml-forecast'
import {
  buildScheduleAbTests,
  computeFeatureImportance,
  decomposeWeeklySeries,
  detectRegimeChanges,
  estimateDaysUntilNextStream,
  recommendCollabs,
} from './ml-advanced'
import {
  DEFAULT_ML_SETTINGS,
  filterSnapshotsByWindow,
  getMlSettings,
  saveMlSettings,
  shouldAutoRetrain,
  windowDaysToHours,
  type MlSettings,
  type MlWindowDays,
} from './ml-settings'
import { getLastModelStoreBackend, type ModelStoreBackend } from './ml-storage'
import { dispatchMlAlerts } from './ml-alerts'
import { buildWarRoomSlotSuggestions, logMlTrainingComplete, runMlIntegrations } from './ml-integration'
import { buildWeeklyReportData, exportWeeklyReportPdf } from './ml-report'
import { summarizeTwitchTrackerBoost } from './ml-twitchtracker'
import { TWITCHTRACKER_DISCLAIMER } from '@/services/twitchtracker'
import { TwitchTrackerPanel } from '@/features/settings/TwitchTrackerPanel'

const CLUSTER_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444']

type MlTab =
  | 'forecast'
  | 'compare'
  | 'anomalies'
  | 'regime'
  | 'clusters'
  | 'collabs'
  | 'inactivity'
  | 'survival'
  | 'categories'
  | 'schedule'
  | 'ab'
  | 'decompose'
  | 'highlights'
  | 'explain'
  | 'alerts'
  | 'integration'
  | 'report'

function modelStoreLabel(backend: ModelStoreBackend): string {
  switch (backend) {
    case 'tauri': return 'app local'
    case 'indexeddb': return 'caché local'
    case 'supabase': return 'nube NeuraGest'
    case 'localStorage': return 'navegador'
  }
}

const tabs: { id: MlTab; label: string; icon: typeof Brain }[] = [
  { id: 'forecast', label: 'Pronóstico', icon: TrendingUp },
  { id: 'compare', label: 'Comparar', icon: GitCompare },
  { id: 'anomalies', label: 'Anomalías', icon: AlertTriangle },
  { id: 'regime', label: 'Régimen', icon: Activity },
  { id: 'clusters', label: 'Clusters', icon: Layers },
  { id: 'collabs', label: 'Collabs', icon: HeartHandshake },
  { id: 'inactivity', label: 'Inactividad', icon: Clock },
  { id: 'survival', label: 'Próx. stream', icon: Calendar },
  { id: 'categories', label: 'Categorías', icon: Tag },
  { id: 'schedule', label: 'Horario', icon: Target },
  { id: 'ab', label: 'A/B horarios', icon: GitCompare },
  { id: 'decompose', label: 'Descomposición', icon: LineChart },
  { id: 'highlights', label: 'Highlights', icon: Sparkles },
  { id: 'explain', label: 'Explicabilidad', icon: Brain },
  { id: 'alerts', label: 'Alertas', icon: Bell },
  { id: 'integration', label: 'Integración', icon: Users },
  { id: 'report', label: 'Informe PDF', icon: FileDown },
]

function Panel({ title, subtitle, children, actions }: {
  title: string
  subtitle?: string
  children: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <section className="ml-panel">
      <header>
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions && <div className="ml-header-actions">{actions}</div>}
      </header>
      <div className="ml-panel-body">{children}</div>
    </section>
  )
}

function Empty({ message, actions }: { message: string; actions?: React.ReactNode }) {
  return (
    <div className="ml-empty">
      <p>{message}</p>
      {actions && <div className="ml-empty-actions">{actions}</div>}
    </div>
  )
}

type TrainFeedback = { type: 'info' | 'ok' | 'warning' | 'critical'; message: string }

function RiskBadge({ level }: { level: string }) {
  const cls = level === 'crítico' ? 'critical' : level === 'alto' ? 'high' : level === 'medio' ? 'medium' : 'low'
  return <span className={`ml-risk-badge ${cls}`}>{level}</span>
}

function MlPageInner() {
  const talents = useAppStore((s) => s.talents)
  const loading = useAppStore((s) => s.twitchLoading)
  const refresh = useAppStore((s) => s.refreshTalentData)
  const roles = useAuthStore((s) => s.roles)
  const session = useAuthStore((s) => s.session)
  const readonly = !canMutate(roles, session?.login)

  const [mlSettings, setMlSettings] = useState<MlSettings>(DEFAULT_ML_SETTINGS)
  const historyHours = windowDaysToHours(mlSettings.windowDays)
  const logins = useMemo(() => talents.map((t) => t.login), [talents])
  const {
    helixSnapshots: rawSnapshots,
    mergedSnapshots: rawMerged,
    events,
    displayNames,
    sourceCounts,
    loading: metricsLoading,
    collecting,
    collectNote,
    collectError,
    ttFetchError,
    error,
    reloadAll,
    reloadExtra,
    collectNow,
  } = useTalentDataSources({ hours: historyHours, logins })

  const snapshots = useMemo(
    () => filterSnapshotsByWindow(rawSnapshots, mlSettings.windowDays),
    [rawSnapshots, mlSettings.windowDays],
  )

  const mlSnapshots = useMemo(
    () => filterSnapshotsByWindow(rawMerged, mlSettings.windowDays),
    [rawMerged, mlSettings.windowDays],
  )

  const [tab, setTab] = useState<MlTab>('forecast')
  const [selectedLogin, setSelectedLogin] = useState('')
  const [training, setTraining] = useState(false)
  const [trainProgress, setTrainProgress] = useState<{ done: number; total: number; login: string } | null>(null)
  const [trainFeedback, setTrainFeedback] = useState<TrainFeedback | null>(null)
  const [seriesMode, setSeriesMode] = useState<ForecastSeriesMode>('viewers')
  const [trainedModels, setTrainedModels] = useState<TrainedModelMeta[]>([])
  const [storeBackend, setStoreBackend] = useState<ModelStoreBackend>('localStorage')
  const [pipelineItems, setPipelineItems] = useState<Awaited<ReturnType<typeof listPipelineItems>>>([])
  const [pipelineLoaded, setPipelineLoaded] = useState(false)
  const [alertStatus, setAlertStatus] = useState<string | null>(null)
  const [integrationStatus, setIntegrationStatus] = useState<string | null>(null)
  const autoRetrainRef = useRef(false)

  const ttBoost = useMemo(
    () => summarizeTwitchTrackerBoost(snapshots, mlSnapshots, logins),
    [snapshots, mlSnapshots, logins],
  )
  const activeLogin = selectedLogin || logins[0] || ''
  const talentsLive = useMemo(() => Object.fromEntries(talents.map((t) => [t.login, t.category])), [talents])

  const modelsMap = useMemo(
    () => Object.fromEntries(trainedModels.map((m) => [m.login, m])),
    [trainedModels],
  )

  const anomalies = useMemo(() => detectAnomalies(mlSnapshots, displayNames), [mlSnapshots, displayNames])
  const regimeChanges = useMemo(() => detectRegimeChanges(mlSnapshots, displayNames), [mlSnapshots, displayNames])
  const clusters = useMemo(() => kMeansCluster(mlSnapshots, displayNames), [mlSnapshots, displayNames])
  const collabRecs = useMemo(() => recommendCollabs(clusters, displayNames), [clusters, displayNames])
  const inactivityRisks = useMemo(() => computeInactivityRisk(mlSnapshots, events, displayNames), [mlSnapshots, events, displayNames])
  const survivalEstimates = useMemo(() => estimateDaysUntilNextStream(mlSnapshots, events, displayNames), [mlSnapshots, events, displayNames])
  const categoryInsights = useMemo(() => analyzeCategoryTypical(mlSnapshots, displayNames, talentsLive), [mlSnapshots, displayNames, talentsLive])
  const optimalSlots = useMemo(() => findOptimalSchedule(mlSnapshots, displayNames), [mlSnapshots, displayNames])
  const abTests = useMemo(() => buildScheduleAbTests(mlSnapshots, displayNames), [mlSnapshots, displayNames])
  const heatmapCells = useMemo(() => buildScheduleHeatmap(mlSnapshots), [mlSnapshots])
  const enhancedHighlights = useMemo(
    () => buildEnhancedHighlights(pipelineItems, mlSnapshots, events, anomalies, clusters),
    [pipelineItems, mlSnapshots, events, anomalies, clusters],
  )
  const snapshotStats = useMemo(
    () => computeSnapshotStats(mlSnapshots, logins, MIN_FORECAST_SAMPLES, seriesMode),
    [mlSnapshots, logins, seriesMode],
  )
  const forecast = useMemo(
    () => activeLogin ? buildForecast(mlSnapshots, activeLogin, 6, seriesMode, modelsMap) : null,
    [mlSnapshots, activeLogin, seriesMode, modelsMap],
  )
  const historicalPreview = useMemo(
    () => activeLogin ? historySeriesByLogin(mlSnapshots, activeLogin, 120) : [],
    [mlSnapshots, activeLogin],
  )
  const canShowForecastChart = Boolean(forecast && forecast.historical.length >= 3)
  const canShowHistoricalChart = historicalPreview.length >= 2
  const comparisonData = useMemo(
    () => forecast ? buildComparisonChartData(forecast) : [],
    [forecast],
  )
  const decomposition = useMemo(
    () => activeLogin ? decomposeWeeklySeries(mlSnapshots, activeLogin) : [],
    [mlSnapshots, activeLogin],
  )
  const featureImportance = useMemo(() => {
    const model = modelsMap[activeLogin]
    if (!model) return []
    return computeFeatureImportance(model.w1, model.featureNames ?? [])
  }, [modelsMap, activeLogin])
  const explanations = useMemo(
    () => buildModelExplanations(mlSnapshots, trainedModels[0]?.trainedAt),
    [mlSnapshots, trainedModels],
  )
  const slotSuggestions = useMemo(() => {
    const forecasts: Record<string, ReturnType<typeof buildForecast> | null> = {}
    for (const login of logins.slice(0, 8)) {
      forecasts[login] = buildForecast(mlSnapshots, login, 3, seriesMode, modelsMap)
    }
    return buildWarRoomSlotSuggestions(optimalSlots, forecasts, displayNames)
  }, [optimalSlots, logins, mlSnapshots, seriesMode, modelsMap, displayNames])

  useEffect(() => {
    void getMlSettings().then(setMlSettings)
    void hydrateStoredModels().then((models) => {
      setTrainedModels(Object.values(models))
      setStoreBackend(getLastModelStoreBackend())
    })
  }, [])

  const reloadTwitchTracker = useCallback(() => {
    void reloadExtra()
  }, [reloadExtra])

  const handleCollectNow = useCallback(async () => {
    if (readonly) return
    await collectNow(selectedLogin || undefined)
  }, [readonly, collectNow, selectedLogin])

  const persistMlSettings = useCallback(async (next: MlSettings) => {
    setMlSettings(next)
    await saveMlSettings(next)
  }, [])

  const formatTrainResult = useCallback((result: TrainAllResult): TrainFeedback => {
    const { models, skipped, seriesMode: mode } = result
    const modeLabel = mode === 'live' ? 'capturas en vivo' : mode === 'viewers' ? 'puntos con viewers>0' : 'todas las capturas'
    if (models.length === 0) {
      return {
        type: 'warning',
        message: `No se entrenó ningún modelo (${modeLabel}). ${skipped.length} omitido(s). Se requieren ≥${MIN_FORECAST_SAMPLES} puntos.`,
      }
    }
    const avgR2 = models.reduce((s, m) => s + (m.holdOutR2 ?? m.r2), 0) / models.length
    const avgMae = models.reduce((s, m) => s + (m.holdOutMae ?? m.mae), 0) / models.length
    void logMlTrainingComplete(models.length, avgR2, avgMae)
    return {
      type: 'ok',
      message: `${models.length} modelo(s) · calidad del pronóstico ${avgR2.toFixed(3)} · precisión ${avgMae.toFixed(1)} · guardado en ${modelStoreLabel(getLastModelStoreBackend())}`,
    }
  }, [])

  const handleTrain = useCallback(async () => {
    if (readonly) {
      setTrainFeedback({ type: 'warning', message: 'Modo staff: no puedes entrenar modelos.' })
      return
    }
    setTraining(true)
    setTrainProgress({ done: 0, total: logins.length, login: logins[0] ?? '' })
    setTrainFeedback({ type: 'info', message: 'Entrenando modelos de pronóstico con validación 80/20…' })
    try {
      const result = await trainAllModels(mlSnapshots, logins, {
        seriesMode,
        useTfjs: true,
        onProgress: (done, total, login) => setTrainProgress({ done, total, login }),
      })
      setTrainedModels(result.models)
      setStoreBackend(getLastModelStoreBackend())
      await persistMlSettings({
        ...mlSettings,
        lastTrainSnapshotCount: mlSnapshots.length,
        lastTrainAt: new Date().toISOString(),
      })
      setTrainFeedback(formatTrainResult(result))
    } catch (caught) {
      setTrainFeedback({
        type: 'critical',
        message: caught instanceof Error ? caught.message : 'Error desconocido al entrenar modelos.',
      })
    } finally {
      setTraining(false)
      setTrainProgress(null)
    }
  }, [mlSnapshots, logins, readonly, seriesMode, formatTrainResult, mlSettings, persistMlSettings])

  useEffect(() => {
    if (autoRetrainRef.current || training || readonly) return
    if (!shouldAutoRetrain(mlSettings, mlSnapshots.length)) return
    autoRetrainRef.current = true
    void handleTrain().finally(() => { autoRetrainRef.current = false })
  }, [mlSnapshots.length, mlSettings, training, readonly, handleTrain])

  const loadPipeline = useCallback(async () => {
    if (pipelineLoaded) return
    try {
      setPipelineItems(await listPipelineItems())
      setPipelineLoaded(true)
    } catch { /* ignore */ }
  }, [pipelineLoaded])

  useEffect(() => {
    if (tab === 'highlights') void loadPipeline()
  }, [tab, loadPipeline])

  useEffect(() => {
    if (mlSnapshots.length === 0) return
    void dispatchMlAlerts({
      anomalies,
      highRisks: inactivityRisks,
      regimeChanges,
    }).then(({ sent }) => {
      if (sent > 0) setAlertStatus(`${sent} alerta(s) ML enviada(s)`)
    })
  }, [mlSnapshots.length, anomalies.length, inactivityRisks.length, regimeChanges.length])

  const handleRunIntegrations = useCallback(async () => {
    const forecasts: Record<string, ReturnType<typeof buildForecast> | null> = {}
    for (const login of logins.slice(0, 6)) {
      forecasts[login] = buildForecast(mlSnapshots, login, 3, seriesMode, modelsMap)
    }
    const result = await runMlIntegrations({
      anomalies,
      risks: inactivityRisks,
      optimalSlots,
      forecasts,
      displayNames,
    })
    setIntegrationStatus(
      `${result.activityLogged} anomalía(s) en activity · ${result.tasksCreated.length} tarea(s) creada(s) · ${result.slotSuggestions.length} sugerencias War Room`,
    )
  }, [anomalies, inactivityRisks, optimalSlots, logins, mlSnapshots, seriesMode, modelsMap, displayNames])

  const handleExportPdf = useCallback(() => {
    const data = buildWeeklyReportData(
      mlSnapshots,
      trainedModels,
      anomalies,
      inactivityRisks,
      clusters,
      mlSettings.windowDays,
      snapshotStats.trainableLogins,
    )
    exportWeeklyReportPdf(data)
  }, [mlSnapshots, trainedModels, anomalies, inactivityRisks, clusters, mlSettings.windowDays, snapshotStats.trainableLogins])

  const isLoading = loading || metricsLoading || collecting
  const { total: snapshotCount, live: liveCount, withViewers, trainableLogins } = snapshotStats
  const activeSeriesCount = activeLogin
    ? (snapshotStats.perLogin[activeLogin]?.withViewers ?? snapshotStats.perLogin[activeLogin]?.total ?? 0)
    : 0
  const canTrain = !readonly && !training

  return (
    <div className="ml-page">
      <div className="ml-titlebar">
        <div>
          <span>DATOS · ML / DL LOCAL</span>
          <h1>Data Science</h1>
          <p>
            Pronóstico, anomalías, régimen, collabs y scoring sobre historial guardado y estadísticas externas.
            {snapshotCount > 0 && (
              <>
                {' · '}{snapshotCount.toLocaleString('es-MX')} pts ML / {mlSettings.windowDays}d
                {' · '}{snapshots.length.toLocaleString('es-MX')} Twitch
                {ttBoost.addedPoints > 0 && ` · +${ttBoost.addedPoints} TT`}
                {' · '}{liveCount.toLocaleString('es-MX')} live
                {' · '}{withViewers.toLocaleString('es-MX')} con viewers
                {trainableLogins > 0 && ` · ${trainableLogins} entrenables`}
                {ttBoost.trainableAfter > ttBoost.trainableBefore && ` (+${ttBoost.trainableAfter - ttBoost.trainableBefore} vía TT)`}
                {' · '}guardado: {modelStoreLabel(storeBackend)}
              </>
            )}
          </p>
          <p className="integration-note">{TWITCHTRACKER_DISCLAIMER}</p>
          {snapshotCount > 0 && <TalentSourceCounters counts={sourceCounts} className="ml-source-counters" />}
          {ttFetchError && (
            <p className="integration-note integration-error">Estadísticas externas: {ttFetchError}</p>
          )}
          {collectNote && !collectError && (
            <p className="integration-note">{collectNote}</p>
          )}
        </div>
        <div className="ml-titlebar-actions">
          <select
            className="ml-select"
            value={mlSettings.windowDays}
            onChange={(e) => void persistMlSettings({ ...mlSettings, windowDays: Number(e.target.value) as MlWindowDays })}
            title="Ventana temporal"
            aria-label="Ventana temporal"
          >
            <option value={7}>7 días</option>
            <option value={14}>14 días</option>
            <option value={30}>30 días</option>
          </select>
          <select className="ml-select ml-series-mode" value={seriesMode} onChange={(e) => setSeriesMode(e.target.value as ForecastSeriesMode)}>
            <option value="viewers">Serie: viewers&gt;0</option>
            <option value="live">Serie: solo live</option>
            <option value="all">Serie: todos</option>
          </select>
          <button
            className="ml-sync ml-collect"
            disabled={readonly || collecting || !isTauri}
            onClick={() => void handleCollectNow()}
            title={selectedLogin ? `Actualizar datos de @${selectedLogin}` : 'Actualizar datos del roster completo'}
          >
            {collecting ? <Loader2 size={14} className="ml-spin" /> : <Database size={14} />}
            {collecting ? 'Recolectando…' : 'Recolectar ahora'}
          </button>
          <button className="ml-train" disabled={!canTrain} onClick={() => void handleTrain()}>
            {training ? <Loader2 size={14} className="ml-spin" /> : <Zap size={14} />}
            {training ? 'Entrenando…' : 'Entrenar'}
          </button>
          <button className="ml-sync" disabled={loading} onClick={() => void refresh().then(() => reloadAll())}>
            <Radio size={14} />{loading ? 'Sincronizando…' : 'Actualizar Twitch'}
          </button>
          <TwitchTrackerPanel compact onSynced={reloadTwitchTracker} />
        </div>
      </div>

      <div className="ml-config-row">
        <label className="ml-config-toggle">
          <input
            type="checkbox"
            checked={mlSettings.autoRetrain}
            disabled={readonly}
            onChange={(e) => void persistMlSettings({ ...mlSettings, autoRetrain: e.target.checked })}
          />
          Reentrenamiento auto
        </label>
        <label className="ml-config-inline">
          cada
          <input
            type="number"
            min={10}
            max={500}
            value={mlSettings.retrainEverySnapshots}
            disabled={readonly}
            onChange={(e) => void persistMlSettings({
              ...mlSettings,
              retrainEverySnapshots: Number(e.target.value) || 50,
            })}
          />
          capturas
        </label>
        <label className="ml-config-toggle">
          <input
            type="checkbox"
            checked={mlSettings.autoCreateRiskTasks}
            disabled={readonly}
            onChange={(e) => void persistMlSettings({ ...mlSettings, autoCreateRiskTasks: e.target.checked })}
          />
          Tareas auto riesgo alto
        </label>
      </div>

      {readonly && <p className="ml-banner warning">Modo staff: solo lectura.</p>}
      {!isTauri && <p className="ml-banner warning">El histórico completo requiere la app de escritorio.</p>}
      {error && <p className="ml-banner critical">Error métricas: {error}</p>}
      {collectError && <p className="ml-banner critical">{collectError}</p>}
      {trainFeedback && <p className={`ml-banner ${trainFeedback.type}`}>{trainFeedback.message}</p>}
      {alertStatus && <p className="ml-banner ok">{alertStatus}</p>}
      {integrationStatus && <p className="ml-banner info">{integrationStatus}</p>}

      {training && trainProgress && trainProgress.total > 0 && (
        <div className="ml-train-progress" role="status">
          <div className="ml-train-progress-bar" style={{ width: `${Math.round((trainProgress.done / trainProgress.total) * 100)}%` }} />
          <span>Entrenando {trainProgress.done + 1}/{trainProgress.total}{trainProgress.login ? ` · @${trainProgress.login}` : ''}</span>
        </div>
      )}

      <nav className="an-tabs ml-tabs" aria-label="Módulos ML">
        {tabs.map((item) => {
          const Icon = item.icon
          return (
            <button key={item.id} type="button" className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>
              <Icon size={13} />{item.label}
            </button>
          )
        })}
      </nav>

      {isLoading && snapshotCount === 0 && <div className="ml-loading">Cargando historial…</div>}

      <div className="ml-content">
        {(tab === 'forecast' || tab === 'compare') && (
          <Panel
            title={tab === 'compare' ? 'Comparación media móvil vs modelo vs referencia' : 'Pronóstico de viewers'}
            subtitle={tab === 'compare'
              ? `Mejor modelo reciente: ${forecast?.bestModel?.toUpperCase() ?? '—'}`
              : canShowForecastChart
                ? 'Modelo de pronóstico con validación · señales hora, día y categoría'
                : canShowHistoricalChart
                  ? 'Histórico Twitch y estadísticas externas — entrena modelos para proyección'
                  : 'Sin datos en la ventana seleccionada'}
            actions={logins.length > 0 && (
              <select className="ml-select" value={activeLogin} onChange={(e) => setSelectedLogin(e.target.value)}>
                {logins.map((l) => <option key={l} value={l}>{displayNames[l] ?? l}</option>)}
              </select>
            )}
          >
            {!canShowForecastChart && !canShowHistoricalChart ? (
              <Empty
                message={`Sin serie de viewers en ${mlSettings.windowDays}d. ${activeSeriesCount} pts en serie.`}
                actions={
                  <>
                    <button
                      type="button"
                      className="ml-sync ml-collect"
                      disabled={readonly || collecting || !isTauri}
                      onClick={() => void handleCollectNow()}
                    >
                      <Database size={14} /> Recolectar ahora
                    </button>
                    <button type="button" className="ml-sync" disabled={loading} onClick={() => void refresh().then(() => reloadAll())}>
                      <Radio size={14} /> Actualizar Twitch
                    </button>
                    <TwitchTrackerPanel compact onSynced={reloadTwitchTracker} />
                  </>
                }
              />
            ) : !canShowForecastChart && canShowHistoricalChart ? (
              <>
                <p className="ml-banner info">
                  Pronóstico ML requiere ≥{MIN_FORECAST_SAMPLES} puntos ({activeSeriesCount} disponibles).
                  Mostrando histórico acumulado de Twitch y estadísticas externas.
                </p>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={historicalPreview}>
                    <defs>
                      <linearGradient id="mlHistGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#9146ff" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#9146ff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--chart-grid,#1e2530)" />
                    <XAxis dataKey="at" tick={{ fontSize: 9, fill: '#8b95a7' }} minTickGap={28} />
                    <YAxis tick={{ fontSize: 9, fill: '#8b95a7' }} />
                    <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid #313947', fontSize: 11 }} />
                    <Area type="monotone" dataKey="viewers" stroke="#9146ff" fill="url(#mlHistGrad)" name="Viewers" />
                  </AreaChart>
                </ResponsiveContainer>
              </>
            ) : forecast ? (
              <>
                <div className="ml-forecast-meta">
                  <span className="ml-badge">{forecast.modelKind === 'seq-mlp' ? 'Modelo secuencial' : forecast.modelType === 'tfjs' ? 'Modelo neuronal' : 'Media móvil'}</span>
                  {forecast.holdOutR2 !== undefined && <span className="ml-badge ok">Calidad = {forecast.holdOutR2}</span>}
                  {forecast.holdOutMae !== undefined && <span className="ml-badge ok">Precisión = {forecast.holdOutMae}</span>}
                  <span className="ml-badge">Best: {forecast.bestModel}</span>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={tab === 'compare' ? comparisonData : comparisonData}>
                    <CartesianGrid stroke="var(--chart-grid,#1e2530)" />
                    <XAxis dataKey="at" tick={{ fontSize: 9, fill: '#8b95a7' }} />
                    <YAxis tick={{ fontSize: 9, fill: '#8b95a7' }} />
                    <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid #313947', fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="viewers" stroke="#9146ff" dot={false} name="Real" connectNulls={false} />
                    <Line type="monotone" dataKey="MA" stroke="#22c55e" dot={false} strokeDasharray="4 4" name="MA" />
                    <Line type="monotone" dataKey="TF.js" stroke="#f59e0b" dot={false} name="Modelo ML" />
                    <Line type="monotone" dataKey="Naive" stroke="#64748b" dot={false} strokeDasharray="2 6" name="Naive" />
                  </ComposedChart>
                </ResponsiveContainer>
                {featureImportance.length > 0 && tab === 'forecast' && (
                  <div className="ml-importance-grid">
                    {featureImportance.slice(0, 5).map((f) => (
                      <div key={f.feature} className="ml-importance-bar">
                        <span>{f.feature}</span>
                        <div style={{ width: `${f.contribution}%` }} />
                        <b>{f.contribution}%</b>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </Panel>
        )}

        {tab === 'decompose' && (
          <Panel title="Descomposición tendencia + estacionalidad" subtitle="Componentes aditivos semanales clásicos">
            {decomposition.length < 7 ? (
              <Empty message="Se requieren ≥7 puntos con viewers para descomponer." />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={decomposition}>
                  <CartesianGrid stroke="var(--chart-grid,#1e2530)" />
                  <XAxis dataKey="at" tick={{ fontSize: 8, fill: '#8b95a7' }} />
                  <YAxis tick={{ fontSize: 9, fill: '#8b95a7' }} />
                  <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid #313947', fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Area type="monotone" dataKey="viewers" stroke="#9146ff" fill="#9146ff22" name="Real" />
                  <Line type="monotone" dataKey="trend" stroke="#22c55e" dot={false} name="Tendencia" />
                  <Line type="monotone" dataKey="seasonal" stroke="#f59e0b" dot={false} name="Estacional" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Panel>
        )}

        {tab === 'survival' && (
          <Panel title="Días hasta próximo stream" subtitle="Heurística survival por gaps entre stream.online">
            {survivalEstimates.length === 0 ? (
              <Empty message="Sin datos de streams." />
            ) : (
              <table className="ml-table">
                <thead><tr><th>Talento</th><th>Días offline</th><th>Gap mediano</th><th>Est. días restantes</th><th>Confianza</th></tr></thead>
                <tbody>
                  {survivalEstimates.map((s) => (
                    <tr key={s.login}>
                      <td>{s.displayName}</td>
                      <td>{s.daysSinceLastStream >= 0 ? s.daysSinceLastStream : '—'}</td>
                      <td>{s.medianGapDays}</td>
                      <td><b>{s.estimatedDaysUntil}</b></td>
                      <td><span className={`ml-badge ${s.confidence === 'alta' ? 'ok' : 'moderate'}`}>{s.confidence}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        )}

        {tab === 'collabs' && (
          <Panel title="Recomendador collabs" subtitle="Similitud coseno entre perfiles de cluster">
            {collabRecs.length === 0 ? (
              <Empty message="Sin recomendaciones (clusters insuficientes)." />
            ) : (
              <table className="ml-table">
                <thead><tr><th>Par</th><th>Similitud</th><th>Clusters</th><th>Motivo</th></tr></thead>
                <tbody>
                  {collabRecs.map((c) => (
                    <tr key={`${c.loginA}-${c.loginB}`}>
                      <td>{c.displayNameA} × {c.displayNameB}</td>
                      <td>{c.similarity}</td>
                      <td>{c.clusterA} / {c.clusterB}</td>
                      <td className="ml-factors">{c.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        )}

        {tab === 'regime' && (
          <Panel title="Cambio de régimen (CUSUM)" subtitle="Detección de shifts en viewers live">
            {regimeChanges.length === 0 ? (
              <Empty message="Sin cambios de régimen detectados." />
            ) : (
              <table className="ml-table">
                <thead><tr><th>Talento</th><th>Viewers</th><th>CUSUM</th><th>Dirección</th><th>Fecha</th></tr></thead>
                <tbody>
                  {regimeChanges.map((r, i) => (
                    <tr key={`${r.login}-${r.capturedAt}-${i}`}>
                      <td>{r.displayName}</td>
                      <td>{r.viewers.toLocaleString('es-MX')}</td>
                      <td>{r.cusum}</td>
                      <td><span className={`ml-badge ${r.direction === 'up' ? 'ok' : 'high'}`}>{r.direction}</span></td>
                      <td>{new Date(r.capturedAt).toLocaleString('es-MX')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        )}

        {tab === 'ab' && (
          <Panel title="A/B horarios (heatmap)" subtitle="Mejor vs peor franja por talento">
            {abTests.length === 0 ? (
              <Empty message="Datos insuficientes para A/B." />
            ) : (
              <table className="ml-table">
                <thead><tr><th>Talento</th><th>Variante A</th><th>Variante B</th><th>Uplift</th><th>Ganador</th></tr></thead>
                <tbody>
                  {abTests.map((t) => (
                    <tr key={t.login}>
                      <td>{t.displayName}</td>
                      <td>{t.variantA.label}: {t.variantA.avgViewers} ({t.variantA.samples}m)</td>
                      <td>{t.variantB.label}: {t.variantB.avgViewers} ({t.variantB.samples}m)</td>
                      <td className="positive">+{t.upliftPct}%</td>
                      <td>{t.winner}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        )}

        {tab === 'alerts' && (
          <Panel title="Alertas ML" subtitle="Avisos a Discord + notificaciones nativas Windows">
            <div className="ml-config-row">
              <label className="ml-config-toggle">
                <input type="checkbox" checked={mlSettings.mlAlertsEnabled} disabled={readonly}
                  onChange={(e) => void persistMlSettings({ ...mlSettings, mlAlertsEnabled: e.target.checked })} />
                Alertas ML activas
              </label>
              <label className="ml-config-toggle">
                <input type="checkbox" checked={mlSettings.mlAlertsDiscord} disabled={readonly}
                  onChange={(e) => void persistMlSettings({ ...mlSettings, mlAlertsDiscord: e.target.checked })} />
                Discord
              </label>
              <label className="ml-config-toggle">
                <input type="checkbox" checked={mlSettings.mlAlertsNative} disabled={readonly}
                  onChange={(e) => void persistMlSettings({ ...mlSettings, mlAlertsNative: e.target.checked })} />
                Alertas nativas
              </label>
            </div>
            <p className="integration-note">Configura los avisos a Discord en Ajustes → Discord. Se alertan anomalías altas, riesgo alto/crítico y cambios de régimen severos.</p>
            <button className="ml-train" type="button" onClick={() => void dispatchMlAlerts({ anomalies, highRisks: inactivityRisks, regimeChanges }).then(({ sent }) => setAlertStatus(`${sent} enviada(s)`))}>
              Probar alertas ahora
            </button>
          </Panel>
        )}

        {tab === 'integration' && (
          <Panel title="Integración ops" subtitle="Forecast → War Room · riesgo → tareas · anomalías → activity">
            <div className="ml-integration-actions">
              <button className="ml-train" type="button" onClick={() => void handleRunIntegrations()}>Ejecutar integraciones</button>
              <Link to="/war-room" className="ml-sync">War Room →</Link>
              <Link to="/schedule" className="ml-sync">Schedule →</Link>
            </div>
            <table className="ml-table">
              <thead><tr><th>Talento</th><th>Slot sugerido</th><th>Viewers esp.</th><th>Fuente</th></tr></thead>
              <tbody>
                {slotSuggestions.slice(0, 12).map((s) => (
                  <tr key={s.login}>
                    <td>{s.displayName}</td>
                    <td>{s.suggestedSlot}</td>
                    <td>{s.expectedViewers.toLocaleString('es-MX')}</td>
                    <td><span className="ml-badge">{s.source}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}

        {tab === 'report' && (
          <Panel title="Informe PDF semanal" subtitle="Resumen Data Science exportable">
            <p className="integration-note">Incluye capturas, modelos, anomalías, riesgos y clusters del periodo {mlSettings.windowDays} días.</p>
            <button className="ml-train" type="button" onClick={handleExportPdf}>
              <FileDown size={14} /> Exportar PDF
            </button>
          </Panel>
        )}

        {tab === 'anomalies' && (
          <Panel title="Detección de anomalías" subtitle="Z-score ±2σ">
            {anomalies.length === 0 ? (
              <Empty message="No se detectaron anomalías significativas." />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <ScatterChart>
                    <CartesianGrid stroke="var(--chart-grid,#1e2530)" />
                    <XAxis dataKey="capturedAt" tick={{ fontSize: 8, fill: '#8b95a7' }} />
                    <YAxis dataKey="zScore" tick={{ fontSize: 9, fill: '#8b95a7' }} />
                    <ZAxis dataKey="viewers" range={[40, 200]} />
                    <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid #313947', fontSize: 11 }} />
                    <Scatter data={anomalies} fill="#f59e0b" />
                  </ScatterChart>
                </ResponsiveContainer>
                <table className="ml-table">
                  <thead><tr><th>Talento</th><th>Viewers</th><th>Z</th><th>Tipo</th><th>Fecha</th></tr></thead>
                  <tbody>
                    {anomalies.slice(0, 20).map((a, i) => (
                      <tr key={`${a.login}-${a.capturedAt}-${i}`}>
                        <td>{a.displayName}</td>
                        <td>{a.viewers.toLocaleString('es-MX')}</td>
                        <td>{a.zScore}</td>
                        <td><span className={`ml-badge ${a.severity}`}>{a.direction}</span></td>
                        <td>{new Date(a.capturedAt).toLocaleString('es-MX')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </Panel>
        )}

        {tab === 'clusters' && (
          <Panel title="Clustering K-means" subtitle="k=4 perfiles de emisión">
            {clusters.length === 0 ? <Empty message="Datos insuficientes." /> : (
              <div className="ml-cluster-grid">
                {clusters.map((cluster) => (
                  <div key={cluster.clusterId} className="ml-cluster-card" style={{ borderColor: CLUSTER_COLORS[cluster.clusterId] }}>
                    <header>
                      <span className="ml-cluster-dot" style={{ background: CLUSTER_COLORS[cluster.clusterId] }} />
                      <h3>{cluster.label}</h3>
                      <span className="ml-badge">{cluster.logins.length}</span>
                    </header>
                    <ul className="ml-cluster-members">
                      {cluster.logins.map((login) => <li key={login}>{displayNames[login] ?? login}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        )}

        {tab === 'inactivity' && (
          <Panel title="Riesgo de inactividad" subtitle="Score compuesto offline + tendencia">
            {inactivityRisks.length === 0 ? <Empty message="Sin datos." /> : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={inactivityRisks.slice(0, 12)} layout="vertical">
                    <CartesianGrid stroke="var(--chart-grid,#1e2530)" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9, fill: '#8b95a7' }} />
                    <YAxis type="category" dataKey="displayName" width={100} tick={{ fontSize: 9, fill: '#8b95a7' }} />
                    <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid #313947', fontSize: 11 }} />
                    <Bar dataKey="riskScore" radius={[0, 4, 4, 0]}>
                      {inactivityRisks.slice(0, 12).map((r) => (
                        <Cell key={r.login} fill={r.riskLevel === 'crítico' ? '#ef4444' : r.riskLevel === 'alto' ? '#f59e0b' : '#6366f1'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <table className="ml-table">
                  <thead><tr><th>Talento</th><th>Score</th><th>Nivel</th><th>Offline</th><th>Factores</th></tr></thead>
                  <tbody>
                    {inactivityRisks.map((r) => (
                      <tr key={r.login}>
                        <td>{r.displayName}</td>
                        <td>{r.riskScore}</td>
                        <td><RiskBadge level={r.riskLevel} /></td>
                        <td>{r.daysSinceStream >= 0 ? r.daysSinceStream : '—'}</td>
                        <td className="ml-factors">{r.factors.join(' · ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </Panel>
        )}

        {tab === 'categories' && (
          <Panel title="Categoría típica vs actual" subtitle="Desviación histórica vs categoría en vivo">
            {categoryInsights.length === 0 ? <Empty message="Sin datos." /> : (
              <table className="ml-table">
                <thead><tr><th>Talento</th><th>Típica</th><th>Actual</th><th>Share</th><th>Estado</th></tr></thead>
                <tbody>
                  {categoryInsights.map((c) => (
                    <tr key={c.login} className={c.isAtypical ? 'atypical' : ''}>
                      <td>{c.displayName}</td>
                      <td>{c.typicalCategory}</td>
                      <td>{c.currentCategory}</td>
                      <td>{c.typicalShare}%</td>
                      <td>{c.isAtypical ? <span className="ml-badge warning">Atípica</span> : <span className="ml-badge ok">Normal</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        )}

        {tab === 'schedule' && (
          <Panel title="Horario óptimo" subtitle="Top franjas día/hora">
            {optimalSlots.length === 0 ? <Empty message="Datos insuficientes." /> : (
              <>
                <div className="ml-heatmap-preview">
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={heatmapCells.filter((c) => c.snapshots > 0).slice(0, 50)}>
                      <CartesianGrid stroke="var(--chart-grid,#1e2530)" />
                      <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#8b95a7' }} />
                      <YAxis tick={{ fontSize: 9, fill: '#8b95a7' }} />
                      <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid #313947', fontSize: 11 }} />
                      <Area type="monotone" dataKey="intensity" stroke="#6366f1" fill="#6366f133" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <table className="ml-table">
                  <thead><tr><th>Talento</th><th>Franja</th><th>Avg</th><th>Intensidad</th></tr></thead>
                  <tbody>
                    {optimalSlots.map((s, i) => (
                      <tr key={`${s.login}-${s.day}-${s.hour}-${i}`}>
                        <td>{s.displayName}</td>
                        <td>{s.label} ({dayLabel(s.day)})</td>
                        <td>{s.avgViewers.toLocaleString('es-MX')}</td>
                        <td>{s.intensity}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </Panel>
        )}

        {tab === 'highlights' && (
          <Panel title="Score highlights" subtitle="Clips/VODs + boost ML anomalías/cluster">
            {enhancedHighlights.length === 0 ? <Empty message="Sin clips/highlights/VODs en pipeline." /> : (
              <table className="ml-table">
                <thead><tr><th>Título</th><th>Tipo</th><th>Score</th><th>ML boost</th><th>Desglose</th></tr></thead>
                <tbody>
                  {enhancedHighlights.map((h) => (
                    <tr key={h.id}>
                      <td>{h.title}</td>
                      <td>{h.contentType}</td>
                      <td><div className="ml-score-bar"><div className="ml-score-fill" style={{ width: `${h.score}%` }} /><span>{h.score}</span></div></td>
                      <td>{h.mlBoost > 0 ? `+${h.mlBoost}` : '—'}</td>
                      <td className="ml-factors">{h.scoreBreakdown}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        )}

        {tab === 'explain' && (
          <Panel title="Explicabilidad" subtitle="Arquitectura, inputs y limitaciones">
            <div className="ml-explain-grid">
              {explanations.map((exp) => (
                <article key={exp.model} className="ml-explain-card">
                  <h3>{exp.model}</h3>
                  <p>{exp.description}</p>
                  <dl>
                    <div><dt>Algoritmo</dt><dd>{exp.algorithm}</dd></div>
                    <div><dt>Inputs</dt><dd>{exp.inputs.join(', ')}</dd></div>
                    <div><dt>Datos</dt><dd>{exp.dataPoints.toLocaleString('es-MX')}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </div>
  )
}

export default MlPageInner
