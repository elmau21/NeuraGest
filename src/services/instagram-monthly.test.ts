import { describe, expect, it } from 'vitest'
import {
  aggregateInstagramPortfolio,
  currentSnapshotMonth,
  type InstagramMonthlySnapshot,
} from './instagram-monthly'

function row(partial: Partial<InstagramMonthlySnapshot> & { instagramHandle: string }): InstagramMonthlySnapshot {
  return {
    id: partial.id ?? 1,
    talentId: partial.talentId ?? null,
    login: partial.login ?? null,
    instagramHandle: partial.instagramHandle,
    followers: partial.followers ?? 0,
    following: partial.following ?? null,
    mediaCount: partial.mediaCount ?? null,
    views: partial.views ?? null,
    viewsAvailable: partial.viewsAvailable ?? false,
    source: partial.source ?? 'bright_data_mcp',
    snapshotMonth: partial.snapshotMonth ?? '2026-09-01',
    syncedAt: partial.syncedAt ?? '2026-09-23T12:00:00Z',
  }
}

describe('instagram-monthly', () => {
  it('formats current snapshot month as first day UTC', () => {
    expect(currentSnapshotMonth(new Date('2026-09-23T18:00:00Z'))).toBe('2026-09-01')
  })

  it('sums portfolio followers for the target month', () => {
    const totals = aggregateInstagramPortfolio(
      [
        row({ instagramHandle: 'ascapop', followers: 14000 }),
        row({ instagramHandle: 'shirookovt', followers: 8691, login: 'shirookouwu' }),
        row({ instagramHandle: 'leoplushy', followers: 3100 }),
        row({ instagramHandle: 'ascapop', followers: 999, snapshotMonth: '2026-08-01' }),
      ],
      '2026-09-01',
    )
    expect(totals.handles).toBe(3)
    expect(totals.followers).toBe(25791)
    expect(totals.views).toBeNull()
    expect(totals.viewsAvailable).toBe(false)
  })
})
