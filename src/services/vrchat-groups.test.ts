import { describe, expect, it } from 'vitest'
import {
  buildVrchatGroupKpi,
  formatSignedDelta,
  type VrchatConfigStatus,
  type VrchatGroupSnapshot,
} from '@/services/vrchat-groups'

const base: VrchatGroupSnapshot = {
  id: 1,
  groupId: 'grp_627b5237-b389-41eb-9eeb-c89233c8474c',
  name: 'Neura',
  iconUrl: null,
  memberCount: 120,
  onlineMemberCount: 8,
  shortCode: null,
  discriminator: null,
  syncedAt: '2026-09-23T18:00:00Z',
}

const config: VrchatConfigStatus = {
  configured: true,
  hasUsername: true,
  hasPassword: true,
  hasAuthCookie: false,
  hasPersistedCookie: true,
  groupId: base.groupId,
  groupUrl: `https://vrchat.com/home/group/${base.groupId}`,
  missingHint: null,
}

describe('vrchat-groups kpi', () => {
  it('calculates member/online deltas when history exists', () => {
    const prev = { ...base, id: 2, memberCount: 100, onlineMemberCount: 5, syncedAt: '2026-09-22T18:00:00Z' }
    const kpi = buildVrchatGroupKpi([base, prev], config)
    expect(kpi.memberCount).toBe(120)
    expect(kpi.onlineMemberCount).toBe(8)
    expect(kpi.memberDelta).toBe(20)
    expect(kpi.onlineDelta).toBe(3)
    expect(formatSignedDelta(kpi.memberDelta)).toBe('+20')
  })

  it('leaves deltas null without previous snapshot', () => {
    const kpi = buildVrchatGroupKpi([base], config)
    expect(kpi.memberDelta).toBeNull()
    expect(kpi.onlineDelta).toBeNull()
    expect(formatSignedDelta(null)).toBe('—')
  })
})
