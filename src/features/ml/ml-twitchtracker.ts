import type { StreamSessionRecord, TalentVodRecord } from '@/services/external-stats'
import type { MetricSnapshot } from '@/services/metrics'
import type { TwitchTrackerSnapshot } from '@/services/twitchtracker'

function snapshotKey(row: Pick<MetricSnapshot, 'login' | 'capturedAt'>): string {
  return `${row.login.toLowerCase()}:${row.capturedAt}`
}

function mergeUniqueSnapshots(base: MetricSnapshot[], extra: MetricSnapshot[]): MetricSnapshot[] {
  const keys = new Set(base.map(snapshotKey))
  const unique = extra.filter((row) => !keys.has(snapshotKey(row)))
  return [...base, ...unique].sort(
    (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime(),
  )
}

/** Convierte snapshots TwitchTracker a puntos compatibles con metric_snapshots para ML. */
export function twitchTrackerToMetricSnapshots(
  rows: TwitchTrackerSnapshot[],
): MetricSnapshot[] {
  return rows.flatMap((row, index) => {
    const points: MetricSnapshot[] = [{
      id: -(row.id * 10),
      talentId: row.talentId,
      login: row.login,
      viewers: row.avgViewers,
      isLive: row.avgViewers > 0,
      category: null,
      followers: row.followersTotal,
      capturedAt: row.syncedAt,
    }]

    if (row.maxViewers > row.avgViewers) {
      points.push({
        id: -(row.id * 10 + 1 + index),
        talentId: row.talentId,
        login: row.login,
        viewers: row.maxViewers,
        isLive: true,
        category: null,
        followers: row.followersTotal,
        capturedAt: row.syncedAt,
      })
    }

    return points
  })
}

/** Sesiones locales → puntos CCV (peak) para ML cuando falta polling Helix. */
export function sessionsToMetricSnapshots(sessions: StreamSessionRecord[]): MetricSnapshot[] {
  return sessions
    .filter((session) => (session.peakViewers ?? 0) > 0)
    .map((session, index) => ({
      id: -(index + 1) * 100_000 - (Number.parseInt(session.id.slice(-6), 16) || index),
      talentId: session.talentId,
      login: session.login,
      viewers: session.peakViewers!,
      isLive: true,
      category: session.categoryName,
      followers: null,
      capturedAt: session.startedAt,
    }))
}

/** VODs Helix → proxy CCV (views/hora) para evitar series vacías sin Helix live. */
export function vodsToMetricSnapshots(vods: TalentVodRecord[]): MetricSnapshot[] {
  return vods
    .filter((vod) => vod.durationSeconds > 0)
    .map((vod, index) => {
      const hours = Math.max(vod.durationSeconds / 3600, 0.25)
      return {
        id: -(index + 1) * 200_000 - (Number.parseInt(vod.id.slice(-6), 16) || index),
        talentId: '',
        login: vod.login,
        viewers: Math.round(vod.viewCount / hours),
        isLive: true,
        category: null,
        followers: null,
        capturedAt: vod.publishedAt,
      }
    })
}

/** Fusiona metric_snapshots locales con historia TwitchTracker (más cobertura temporal). */
export function mergeSnapshotsForMl(
  local: MetricSnapshot[],
  external: TwitchTrackerSnapshot[],
): MetricSnapshot[] {
  return mergeUniqueSnapshots(local, twitchTrackerToMetricSnapshots(external))
}

/** Fusión multi-fuente: Helix + TT + sesiones + VODs (mismo contrato que perfil de talento). */
export function mergeAllSnapshotsForMl(
  local: MetricSnapshot[],
  ttSnapshots: TwitchTrackerSnapshot[],
  sessions: StreamSessionRecord[] = [],
  vods: TalentVodRecord[] = [],
): MetricSnapshot[] {
  let merged = mergeSnapshotsForMl(local, ttSnapshots)
  merged = mergeUniqueSnapshots(merged, sessionsToMetricSnapshots(sessions))
  merged = mergeUniqueSnapshots(merged, vodsToMetricSnapshots(vods))
  return merged
}

export function summarizeTwitchTrackerBoost(
  local: MetricSnapshot[],
  merged: MetricSnapshot[],
  logins: string[],
): { addedPoints: number; trainableBefore: number; trainableAfter: number } {
  const minSamples = 8
  const countTrainable = (rows: MetricSnapshot[]) =>
    logins.filter((login) => rows.filter((r) => r.login === login && r.viewers > 0).length >= minSamples).length

  return {
    addedPoints: merged.length - local.length,
    trainableBefore: countTrainable(local),
    trainableAfter: countTrainable(merged),
  }
}
