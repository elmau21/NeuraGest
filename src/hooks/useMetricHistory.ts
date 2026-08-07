import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/stores/app-store'
import {
  buildStreakIndicators,
  buildWeeklyComparison,
  fetchEventSubStatus,
  fetchMetricSnapshots,
  fetchStreamEvents,
  type EventSubStatus,
  type MetricSnapshot,
  type StreakIndicator,
  type StreamEvent,
  type WeeklyTalentMetrics,
} from '@/services/metrics'

export function useMetricHistory(hours = 168) {
  const talents = useAppStore((state) => state.talents)
  const lastTwitchUpdate = useAppStore((state) => state.lastTwitchUpdate)
  const [snapshots, setSnapshots] = useState<MetricSnapshot[]>([])
  const [events, setEvents] = useState<StreamEvent[]>([])
  const [eventSub, setEventSub] = useState<EventSubStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()

  const displayNames = Object.fromEntries(
    talents.map((talent) => [talent.login, talent.displayName]),
  )

  const reload = useCallback(async () => {
    setLoading(true)
    setError(undefined)
    try {
      const [metricRows, eventRows, status] = await Promise.all([
        fetchMetricSnapshots(hours),
        fetchStreamEvents(hours),
        fetchEventSubStatus(),
      ])
      setSnapshots(metricRows)
      setEvents(eventRows)
      setEventSub(status)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setLoading(false)
    }
  }, [hours])

  useEffect(() => {
    void reload()
  }, [reload, lastTwitchUpdate])

  const weekly = buildWeeklyComparison(snapshots, displayNames)
  const streaks = buildStreakIndicators(snapshots, events, displayNames)

  return {
    snapshots,
    events,
    eventSub,
    weekly,
    streaks,
    loading,
    error,
    reload,
    displayNames,
  }
}

export type MetricHistoryState = {
  snapshots: MetricSnapshot[]
  events: StreamEvent[]
  eventSub: EventSubStatus | null
  weekly: WeeklyTalentMetrics[]
  streaks: StreakIndicator[]
  loading: boolean
  error?: string
  reload: () => Promise<void>
  displayNames: Record<string, string>
}
