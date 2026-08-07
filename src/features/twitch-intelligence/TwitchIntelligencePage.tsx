import { useMemo, useState } from 'react'
import {
  Brain,
  CalendarCheck,
  CheckSquare,
  Clock,
  Database,
  LineChart,
  Loader2,
  Radio,
  Scale,
  Sparkles,
  Tag,
  Trophy,
} from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import { useTalentDataSources } from '@/hooks/useTalentDataSources'
import { TalentSourceCounters } from '@/components/TalentSourceCounters'
import { isTauri } from '@/services/twitch'
import { AtypicalCategoryRadar } from './AtypicalCategoryRadar'
import { ScheduleHeatmap } from './ScheduleHeatmap'
import { WeeklyClipsRanking } from './WeeklyClipsRanking'
import { ScheduleCompliancePanel } from './ScheduleCompliancePanel'
import { MovingAverageSimulator } from './MovingAverageSimulator'
import { PostStreamChecklist } from './PostStreamChecklist'
import { HighlightsQueue } from './HighlightsQueue'
import { ManagerLoadBalancer } from './ManagerLoadBalancer'
import { BackfillPanel } from '@/features/settings/BackfillPanel'
import { TwitchTrackerPanel } from '@/features/settings/TwitchTrackerPanel'
import {
  buildCategoryRadar,
  buildScheduleHeatmap,
} from './twitch-intelligence-utils'

type IntelTab =
  | 'radar'
  | 'heatmap'
  | 'clips'
  | 'schedule'
  | 'simulator'
  | 'poststream'
  | 'highlights'
  | 'managers'

const tabs: { id: IntelTab; label: string; icon: typeof Brain }[] = [
  { id: 'radar', label: 'Radar', icon: Tag },
  { id: 'heatmap', label: 'Heatmap', icon: Clock },
  { id: 'clips', label: 'Clips', icon: Trophy },
  { id: 'schedule', label: 'Schedule', icon: CalendarCheck },
  { id: 'simulator', label: 'Simulador', icon: LineChart },
  { id: 'poststream', label: 'Post-stream', icon: CheckSquare },
  { id: 'highlights', label: 'Highlights', icon: Sparkles },
  { id: 'managers', label: 'Managers', icon: Scale },
]

export function TwitchIntelligencePage() {
  const talents = useAppStore((s) => s.talents)
  const loading = useAppStore((s) => s.twitchLoading)
  const refresh = useAppStore((s) => s.refreshTalentData)
  const logins = useMemo(() => talents.map((t) => t.login), [talents])
  const {
    mergedSnapshots,
    allEvents,
    eventSub,
    displayNames,
    sourceCounts,
    loading: metricsLoading,
    collecting,
    collectNote,
    collectError,
    reloadAll,
    reloadExtra,
    collectNow,
  } = useTalentDataSources({ hours: 336, logins })
  const [tab, setTab] = useState<IntelTab>('radar')

  const talentsLive = useMemo(
    () => Object.fromEntries(talents.map((t) => [t.login, t.category])),
    [talents],
  )
  const radarTalents = useMemo(
    () => buildCategoryRadar(mergedSnapshots, displayNames, talentsLive),
    [mergedSnapshots, displayNames, talentsLive],
  )
  const heatmapCells = useMemo(() => buildScheduleHeatmap(mergedSnapshots), [mergedSnapshots])
  const liveLogins = useMemo(
    () => new Set(talents.filter((t) => t.isLive).map((t) => t.login.toLowerCase())),
    [talents],
  )

  const isBusy = loading || metricsLoading || collecting

  return (
    <div className="ti-page">
      <div className="ti-titlebar">
        <div>
          <span>INTELIGENCIA TWITCH · POST-STREAM</span>
          <h1>Inteligencia Twitch</h1>
          <p>
            Radar, heatmap, clips de Twitch, cumplimiento, simulador, checklist offline y cola de highlights
            sobre datos fusionados de Twitch, estadísticas externas, repeticiones y sesiones.
          </p>
          <TalentSourceCounters counts={sourceCounts} className="ti-source-counters" />
          {collectNote && !collectError && (
            <p className="ti-collect-note">{collectNote}</p>
          )}
        </div>
        <div className="ti-titlebar-actions">
          <button
            type="button"
            className="ti-sync ti-collect"
            disabled={isBusy || !isTauri}
            onClick={() => void collectNow()}
            title="Actualizar datos del roster (Twitch + repeticiones + estadísticas externas + tiempo real)"
          >
            {collecting ? <Loader2 size={14} className="ml-spin" /> : <Database size={14} />}
            {collecting ? 'Recolectando…' : 'Recolectar ahora'}
          </button>
          <BackfillPanel compact />
          <TwitchTrackerPanel compact onSynced={() => void reloadExtra()} />
          <button className="ti-sync" disabled={loading} onClick={() => void refresh().then(() => reloadAll())}>
            <Radio size={14} />{loading ? 'Sincronizando…' : 'Actualizar Twitch'}
          </button>
        </div>
      </div>

      {eventSub && (
        <p className={`ti-eventsub ${eventSub.state}`}>
          Tiempo real: {eventSub.state === 'connected' ? 'conectado' : eventSub.state === 'connecting' ? 'conectando' : eventSub.state === 'fallback_polling' ? 'modo alterno' : 'desconectado'} · {eventSub.subscriptions} suscripciones activas
          {eventSub.lastEventAt && ` · último evento ${new Date(eventSub.lastEventAt).toLocaleString('es-MX')}`}
        </p>
      )}

      {collectError && <p className="ti-banner error">{collectError}</p>}

      <nav className="ti-tabs" aria-label="Módulos inteligencia Twitch">
        {tabs.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              className={tab === item.id ? 'active' : ''}
              onClick={() => setTab(item.id)}
            >
              <Icon size={13} />{item.label}
            </button>
          )
        })}
      </nav>

      <div className="ti-content">
        {tab === 'radar' && <AtypicalCategoryRadar talents={radarTalents} />}
        {tab === 'heatmap' && <ScheduleHeatmap cells={heatmapCells} />}
        {tab === 'clips' && <WeeklyClipsRanking />}
        {tab === 'schedule' && <ScheduleCompliancePanel />}
        {tab === 'simulator' && (
          <MovingAverageSimulator snapshots={mergedSnapshots} logins={logins} displayNames={displayNames} />
        )}
        {tab === 'poststream' && <PostStreamChecklist displayNames={displayNames} />}
        {tab === 'highlights' && <HighlightsQueue snapshots={mergedSnapshots} events={allEvents} />}
        {tab === 'managers' && <ManagerLoadBalancer liveLogins={liveLogins} />}
      </div>

      {metricsLoading && <p className="ti-loading">Cargando histórico de métricas…</p>}
    </div>
  )
}
