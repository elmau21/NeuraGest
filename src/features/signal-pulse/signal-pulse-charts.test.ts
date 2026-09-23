import { describe, expect, it } from 'vitest'
import {
  activityHeatmap,
  activityPctFromShare,
  activityShare7d,
  clipsViewsBars,
  followersDeltaBars,
  hoursWatchedBars,
  hoursWatchedShare,
  languageShare,
  liveOfflineShare,
  portfolioAudienceSeries,
  talentBreakdownTable,
} from './signal-pulse-charts'
import type { MetricSnapshot } from '@/services/metrics'
import type { TwitchTrackerSnapshot } from '@/services/twitchtracker'
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
  }
}

function snap(login: string, viewers: number, iso: string, isLive = true): MetricSnapshot {
  return {
    id: 1,
    talentId: login,
    login,
    viewers,
    isLive,
    category: null,
    followers: null,
    capturedAt: iso,
  }
}

function tt(partial: Partial<TwitchTrackerSnapshot> & { login: string }): TwitchTrackerSnapshot {
  return {
    id: 1,
    talentId: partial.login,
    login: partial.login,
    periodDays: 30,
    rank: null,
    avgViewers: partial.avgViewers ?? 0,
    maxViewers: 0,
    minutesStreamed: 0,
    hoursWatched: partial.hoursWatched ?? 0,
    followersGrowth: partial.followersGrowth ?? null,
    followersTotal: null,
    syncedAt: partial.syncedAt ?? '2026-09-23T12:00:00Z',
  }
}

describe('signal-pulse-charts', () => {
  const now = Date.parse('2026-09-23T12:00:00Z')

  it('builds daily audience series for 7d', () => {
    const series = portfolioAudienceSeries(
      [
        snap('a', 100, '2026-09-22T10:00:00Z'),
        snap('a', 200, '2026-09-22T11:00:00Z'),
        snap('b', 50, '2026-09-21T10:00:00Z'),
      ],
      168,
      now,
    )
    expect(series.length).toBeGreaterThanOrEqual(2)
    expect(series.every((p) => typeof p.viewers === 'number')).toBe(true)
  })

  it('ranks hours watched and followers delta from TT', () => {
    const talents = [talent({ login: 'alpha' }), talent({ login: 'beta', isLive: true })]
    const rows = [
      tt({ login: 'alpha', hoursWatched: 1000, followersGrowth: 10 }),
      tt({ login: 'beta', hoursWatched: 5000, followersGrowth: 80 }),
    ]
    expect(hoursWatchedBars(rows, talents)[0].login).toBe('beta')
    expect(followersDeltaBars(rows, talents)[0].value).toBe(80)
  })

  it('aggregates clip views by talent', () => {
    const talents = [talent({ login: 'alpha' }), talent({ login: 'beta' })]
    const bars = clipsViewsBars(
      [
        {
          id: '1',
          url: '',
          login: 'alpha',
          displayName: 'A',
          title: 'x',
          viewCount: 100,
          createdAt: '2026-09-20T00:00:00Z',
          thumbnailUrl: '',
          duration: 10,
          gameId: '',
        },
        {
          id: '2',
          url: '',
          login: 'beta',
          displayName: 'B',
          title: 'y',
          viewCount: 40,
          createdAt: '2026-09-21T00:00:00Z',
          thumbnailUrl: '',
          duration: 10,
          gameId: '',
        },
      ],
      [],
      talents,
      7,
      now,
    )
    expect(bars[0]).toMatchObject({ login: 'alpha', value: 100 })
  })

  it('builds activity heatmap cells for 7 days × 24h', () => {
    const heat = activityHeatmap(
      [snap('a', 10, '2026-09-23T08:30:00Z'), snap('a', 20, '2026-09-23T08:45:00Z')],
      7,
      now,
    )
    expect(heat).toHaveLength(7 * 24)
    const cell = heat.find((c) => c.day === '2026-09-23' && c.hour === 8)
    expect(cell?.count).toBe(2)
    expect(cell?.avgViewers).toBe(15)
  })

  it('builds live/offline and language share pies', () => {
    const talents = [
      talent({ login: 'a', isLive: true, language: 'es' }),
      talent({ login: 'b', isLive: false, language: 'es' }),
      talent({ login: 'c', isLive: false, language: 'en' }),
    ]
    const live = liveOfflineShare(talents)
    expect(live.find((s) => s.key === 'live')?.value).toBe(1)
    expect(live.find((s) => s.key === 'offline')?.value).toBe(2)
    const langs = languageShare(talents)
    expect(langs[0]).toMatchObject({ name: 'ES', value: 2 })
  })

  it('builds TT hours share with resto bucket', () => {
    const talents = ['a', 'b', 'c', 'd', 'e', 'f'].map((login) => talent({ login }))
    const rows = talents.map((t, i) => tt({ login: t.login, hoursWatched: (6 - i) * 100 }))
    const share = hoursWatchedShare(rows, talents, 3)
    expect(share).toHaveLength(3)
    expect(share[share.length - 1]?.key).toBe('rest')
  })

  it('builds activity ring pct from 7d share', () => {
    const talents = [talent({ login: 'alpha' }), talent({ login: 'beta' })]
    const share = activityShare7d(
      talents,
      [snap('alpha', 10, '2026-09-22T10:00:00Z')],
      now,
    )
    expect(activityPctFromShare(share)).toBe(50)
  })

  it('builds talent breakdown with TT + clips + live hours', () => {
    const rows = talentBreakdownTable(
      [talent({ login: 'alpha', followers: 100, isLive: true, viewers: 12 })],
      [snap('alpha', 50, '2026-09-23T11:00:00Z')],
      [tt({ login: 'alpha', hoursWatched: 900, followersGrowth: 5, avgViewers: 40 })],
      [
        {
          id: '1',
          url: '',
          login: 'alpha',
          displayName: 'A',
          title: 'x',
          viewCount: 30,
          createdAt: '2026-09-22T00:00:00Z',
          thumbnailUrl: '',
          duration: 10,
          gameId: '',
        },
      ],
      [],
      now,
    )
    expect(rows[0]).toMatchObject({
      login: 'alpha',
      live: true,
      ttHours: 900,
      ttDelta: 5,
      clips7d: 1,
      clipViews7d: 30,
    })
  })
})
