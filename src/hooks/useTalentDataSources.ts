import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMetricHistory } from '@/hooks/useMetricHistory'
import type { StreamSessionRecord, TalentVodRecord } from '@/services/external-stats'
import { mergeAllSnapshotsForMl } from '@/features/ml/ml-twitchtracker'
import {
  collectTalentMetrics,
  fetchRosterVods,
  fetchStreamSessions,
  type CollectMetricsResult,
} from '@/services/talent-collector'
import { fetchTwitchTrackerSnapshots, type TwitchTrackerSnapshot } from '@/services/twitchtracker'
import { isTauri } from '@/services/twitch'

export type TalentSourceCounts = {
  helix: number
  tt: number
  vods: number
  sessions: number
  events: number
  merged: number
  mergedAdded: number
}

function filterByLogin<T extends { login: string }>(rows: T[], login?: string): T[] {
  if (!login) return rows
  const key = login.toLowerCase()
  return rows.filter((row) => row.login.toLowerCase() === key)
}

export function useTalentDataSources(options: {
  hours: number
  login?: string
  logins?: string[]
  vodDays?: number
}) {
  const { hours, login, logins = [], vodDays = 30 } = options
  const {
    snapshots: helixSnapshots,
    events,
    eventSub,
    displayNames,
    loading: metricsLoading,
    error: metricsError,
    reload: reloadMetrics,
  } = useMetricHistory(hours)

  const [ttSnapshots, setTtSnapshots] = useState<TwitchTrackerSnapshot[]>([])
  const [vods, setVods] = useState<TalentVodRecord[]>([])
  const [sessions, setSessions] = useState<StreamSessionRecord[]>([])
  const [extraLoading, setExtraLoading] = useState(false)
  const [ttFetchError, setTtFetchError] = useState<string | null>(null)
  const [extraError, setExtraError] = useState<string | null>(null)
  const [collecting, setCollecting] = useState(false)
  const [collectNote, setCollectNote] = useState<string | null>(null)
  const [collectError, setCollectError] = useState<string | null>(null)
  const [lastCollect, setLastCollect] = useState<CollectMetricsResult | null>(null)

  const reloadExtra = useCallback(async () => {
    if (!isTauri) {
      setTtSnapshots([])
      setVods([])
      setSessions([])
      return
    }
    setExtraLoading(true)
    setExtraError(null)
    try {
      const [ttRows, sessionRows, vodRows] = await Promise.all([
        fetchTwitchTrackerSnapshots(hours).catch((err) => {
          setTtFetchError(err instanceof Error ? err.message : String(err))
          return [] as TwitchTrackerSnapshot[]
        }),
        fetchStreamSessions(hours, login),
        login
          ? fetchRosterVods([login], vodDays)
          : logins.length > 0
            ? fetchRosterVods(logins, vodDays)
            : Promise.resolve([] as TalentVodRecord[]),
      ])
      setTtSnapshots(ttRows)
      setTtFetchError(null)
      setSessions(sessionRows)
      setVods(vodRows)
    } catch (err) {
      setExtraError(err instanceof Error ? err.message : String(err))
    } finally {
      setExtraLoading(false)
    }
  }, [hours, login, logins, vodDays])

  const reloadAll = useCallback(async () => {
    await Promise.all([reloadMetrics(), reloadExtra()])
  }, [reloadMetrics, reloadExtra])

  useEffect(() => {
    void reloadExtra()
  }, [reloadExtra, helixSnapshots.length])

  const scopedTt = useMemo(() => filterByLogin(ttSnapshots, login), [ttSnapshots, login])
  const scopedSessions = useMemo(() => filterByLogin(sessions, login), [sessions, login])
  const scopedVods = useMemo(() => filterByLogin(vods, login), [vods, login])
  const scopedEvents = useMemo(() => filterByLogin(events, login), [events, login])

  const mergedSnapshots = useMemo(
    () => mergeAllSnapshotsForMl(helixSnapshots, scopedTt, scopedSessions, scopedVods),
    [helixSnapshots, scopedTt, scopedSessions, scopedVods],
  )

  const sourceCounts = useMemo<TalentSourceCounts>(() => ({
    helix: helixSnapshots.length,
    tt: scopedTt.length,
    vods: scopedVods.length,
    sessions: scopedSessions.length,
    events: scopedEvents.length,
    merged: mergedSnapshots.length,
    mergedAdded: mergedSnapshots.length - helixSnapshots.length,
  }), [helixSnapshots.length, scopedTt.length, scopedVods.length, scopedSessions.length, scopedEvents.length, mergedSnapshots.length])

  const collectNow = useCallback(async (targetLogin?: string) => {
    if (!isTauri) {
      setCollectError('Recolectar métricas requiere la app de escritorio NeuraGest.')
      return null
    }
    setCollecting(true)
    setCollectError(null)
    setCollectNote(null)
    try {
      const result = await collectTalentMetrics(targetLogin ?? login)
      setLastCollect(result)
      setCollectNote(result.note)
      if (result.ttErrors.length > 0) {
        setCollectError(result.ttErrors.join(' · '))
      }
      await reloadAll()
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setCollectError(message)
      return null
    } finally {
      setCollecting(false)
    }
  }, [login, reloadAll])

  return {
    helixSnapshots,
    mergedSnapshots,
    events: scopedEvents,
    allEvents: events,
    eventSub,
    ttSnapshots: scopedTt,
    vods: scopedVods,
    sessions: scopedSessions,
    displayNames,
    sourceCounts,
    loading: metricsLoading || extraLoading,
    collecting,
    collectNote,
    collectError,
    lastCollect,
    metricsError,
    ttFetchError,
    extraError,
    error: metricsError ?? extraError ?? collectError ?? undefined,
    reloadAll,
    reloadExtra,
    collectNow,
  }
}

export type TalentDataSourcesState = ReturnType<typeof useTalentDataSources>
