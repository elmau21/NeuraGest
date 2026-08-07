import type { SponsorshipDeal, SponsorshipStatus } from '@/services/agency'

export type CrmSlaLevel = 'ok' | 'warning' | 'critical'

export type CrmSlaInfo = {
  dealId: string
  daysIdle: number
  level: CrmSlaLevel
  label: string
  lastMovement: string
}

const ACTIVE_STATUSES: SponsorshipStatus[] = ['lead', 'negotiating', 'active']

const SLA_WARNING_DAYS = 7
const SLA_CRITICAL_DAYS = 14

export function daysSince(isoDate: string): number {
  const then = new Date(isoDate).getTime()
  const now = Date.now()
  return Math.max(0, Math.floor((now - then) / 86_400_000))
}

export function computeDealSla(deal: SponsorshipDeal, now = Date.now()): CrmSlaInfo | null {
  if (!ACTIVE_STATUSES.includes(deal.status)) return null
  const lastMovement = deal.updatedAt || deal.createdAt
  const daysIdle = Math.max(0, Math.floor((now - new Date(lastMovement).getTime()) / 86_400_000))
  let level: CrmSlaLevel = 'ok'
  let label = `${daysIdle}d sin movimiento`
  if (daysIdle >= SLA_CRITICAL_DAYS) {
    level = 'critical'
    label = `${daysIdle}d — SLA crítico`
  } else if (daysIdle >= SLA_WARNING_DAYS) {
    level = 'warning'
    label = `${daysIdle}d — revisar`
  }
  return { dealId: deal.id, daysIdle, level, label, lastMovement }
}

export function summarizeCrmSla(deals: SponsorshipDeal[]) {
  const infos = deals.map(computeDealSla).filter((i): i is CrmSlaInfo => i !== null)
  return {
    total: infos.length,
    critical: infos.filter((i) => i.level === 'critical').length,
    warning: infos.filter((i) => i.level === 'warning').length,
    ok: infos.filter((i) => i.level === 'ok').length,
    byDealId: Object.fromEntries(infos.map((i) => [i.dealId, i])) as Record<string, CrmSlaInfo>,
  }
}
