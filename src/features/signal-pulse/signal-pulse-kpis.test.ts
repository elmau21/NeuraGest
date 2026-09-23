import { describe, expect, it } from 'vitest'
import { buildPortfolioOpsKpis, countClipsInWindow } from './signal-pulse-kpis'
import type { MetricSnapshot } from '@/services/metrics'
import type { Talent } from '@/types'

function talent(partial: Partial<Talent> & { login: string }): Talent {
  return {
    id: partial.id ?? partial.login,
    login: partial.login,
    displayName: partial.displayName ?? partial.login,
    avatar: '',
    description: '',
    isLive: partial.isLive ?? false,
    viewers: partial.viewers ?? 0,
    followers: partial.followers ?? 0,
    category: '',
    title: '',
    createdAt: '',
    language: partial.language,
    tags: partial.tags,
    contentClassificationLabels: partial.contentClassificationLabels,
  }
}

function snap(login: string, viewers: number, hoursAgo: number, isLive = true): MetricSnapshot {
  return {
    id: hoursAgo,
    talentId: login,
    login,
    viewers,
    isLive,
    category: null,
    followers: null,
    capturedAt: new Date(Date.now() - hoursAgo * 3600_000).toISOString(),
  }
}

describe('signal-pulse-kpis', () => {
  it('counts clips in 7d window preferring Helix weekly', () => {
    const now = Date.parse('2026-09-23T12:00:00Z')
    const weekly = [
      {
        id: '1',
        url: '',
        login: 'a',
        displayName: 'A',
        title: 'x',
        viewCount: 10,
        createdAt: '2026-09-20T00:00:00Z',
        thumbnailUrl: '',
        duration: 30,
        gameId: '',
      },
      {
        id: '2',
        url: '',
        login: 'b',
        displayName: 'B',
        title: 'y',
        viewCount: 5,
        createdAt: '2026-08-01T00:00:00Z',
        thumbnailUrl: '',
        duration: 30,
        gameId: '',
      },
    ]
    expect(countClipsInWindow(weekly, [], 7, now)).toEqual({ count: 1, viewCount: 10 })
  })

  it('builds actionable portfolio KPIs from real sources', () => {
    const now = Date.parse('2026-09-23T12:00:00Z')
    const talents = [
      talent({ login: 'alpha', followers: 1000, language: 'es', tags: ['IRL'], contentClassificationLabels: ['Gambling'] }),
      talent({ login: 'beta', followers: 500, language: 'en', tags: ['IRL', 'Just Chatting'] }),
      talent({ login: 'gamma', followers: 200 }),
    ]
    const snapshots = [
      snap('alpha', 120, 2),
      snap('alpha', 200, 3),
      snap('beta', 50, 10),
      snap('gamma', 10, 200), // fuera de 7d
    ]
    const kpis = buildPortfolioOpsKpis({
      talents,
      snapshots,
      ttSnapshots: [
        {
          id: 1,
          talentId: '1',
          login: 'alpha',
          periodDays: 30,
          rank: null,
          avgViewers: 100,
          maxViewers: 200,
          minutesStreamed: 600,
          hoursWatched: 1000,
          followersGrowth: 40,
          followersTotal: 1000,
          syncedAt: '2026-09-22T00:00:00Z',
        },
        {
          id: 2,
          talentId: '2',
          login: 'beta',
          periodDays: 30,
          rank: null,
          avgViewers: 50,
          maxViewers: 80,
          minutesStreamed: 300,
          hoursWatched: 400,
          followersGrowth: -5,
          followersTotal: 500,
          syncedAt: '2026-09-22T00:00:00Z',
        },
      ],
      weeklyClips: [
        {
          id: 'c1',
          url: '',
          login: 'alpha',
          displayName: 'A',
          title: 'clip',
          viewCount: 99,
          createdAt: '2026-09-21T00:00:00Z',
          thumbnailUrl: '',
          duration: 20,
          gameId: '',
        },
      ],
      dbClips: [],
      now,
    })

    expect(kpis.totalFollowers).toBe(1700)
    expect(kpis.combinedFollowers).toBe(1700)
    expect(kpis.ttAvgViewers).toBe(75)
    expect(kpis.ttHoursWatched).toBe(1400)
    expect(kpis.ttFollowersGrowth).toBe(35)
    expect(kpis.clips7d).toBe(1)
    expect(kpis.peakViewers7d).toBe(200)
    expect(kpis.activeTalents7d).toBe(2)
    expect(kpis.activityPct7d).toBe(67)
    expect(kpis.languages).toBe(2)
    expect(kpis.uniqueTags).toBe(2)
    expect(kpis.cclCount).toBe(1)
    expect(kpis.igFollowers).toBe(0)
    expect(kpis.igHandles).toBe(0)
  })

  it('sums Instagram monthly portfolio into KPIs', () => {
    const now = Date.parse('2026-09-23T12:00:00Z')
    const kpis = buildPortfolioOpsKpis({
      talents: [talent({ login: 'shirookouwu', followers: 100 })],
      snapshots: [],
      ttSnapshots: [],
      weeklyClips: [],
      dbClips: [],
      igSnapshots: [
        {
          id: 1,
          talentId: 't1',
          login: 'shirookouwu',
          instagramHandle: 'shirookovt',
          followers: 8691,
          following: 842,
          mediaCount: 301,
          views: null,
          viewsAvailable: false,
          source: 'bright_data_mcp',
          snapshotMonth: '2026-09-01',
          syncedAt: '2026-09-23T12:00:00Z',
        },
        {
          id: 2,
          talentId: null,
          login: null,
          instagramHandle: 'ascapop',
          followers: 14000,
          following: 320,
          mediaCount: null,
          views: null,
          viewsAvailable: false,
          source: 'bright_data_mcp',
          snapshotMonth: '2026-09-01',
          syncedAt: '2026-09-23T12:00:00Z',
        },
      ],
      now,
    })
    expect(kpis.igFollowers).toBe(22691)
    expect(kpis.combinedFollowers).toBe(22791)
    expect(kpis.igHandles).toBe(2)
    expect(kpis.igSnapshotMonth).toBe('2026-09-01')
  })
})
