import type { BrandRestriction } from '@/services/ops'
import type { SponsorshipDeal } from '@/services/agency'

export type DealConflict = {
  severity: 'critical' | 'warning'
  code: string
  message: string
  detail: string
}

function parseDate(value?: string): number | null {
  if (!value) return null
  const ts = new Date(`${value}T12:00:00`).getTime()
  return Number.isNaN(ts) ? null : ts
}

function rangesOverlap(
  aStart?: string,
  aEnd?: string,
  bStart?: string,
  bEnd?: string,
): boolean {
  const startA = parseDate(aStart) ?? Number.NEGATIVE_INFINITY
  const endA = parseDate(aEnd) ?? Number.POSITIVE_INFINITY
  const startB = parseDate(bStart) ?? Number.NEGATIVE_INFINITY
  const endB = parseDate(bEnd) ?? Number.POSITIVE_INFINITY
  return startA <= endB && startB <= endA
}

function normalizeBrand(name: string) {
  return name.trim().toLowerCase()
}

function brandsConflict(a: string, b: string) {
  const na = normalizeBrand(a)
  const nb = normalizeBrand(b)
  if (na === nb) return true
  return na.includes(nb) || nb.includes(na)
}

export function detectDealConflicts(input: {
  draft: Partial<SponsorshipDeal> & { brandName: string }
  deals: SponsorshipDeal[]
  restrictions: BrandRestriction[]
}): DealConflict[] {
  const { draft, deals, restrictions } = input
  const conflicts: DealConflict[] = []
  if (!draft.brandName.trim()) return conflicts

  const talentId = draft.talentId
  const brand = draft.brandName.trim()

  for (const deal of deals) {
    if (deal.id === draft.id) continue
    if (talentId && deal.talentId !== talentId) continue
    if (!['active', 'negotiating'].includes(deal.status)) continue
    if (!rangesOverlap(draft.startDate, draft.endDate, deal.startDate, deal.endDate)) continue

    if (brandsConflict(brand, deal.brandName)) {
      conflicts.push({
        severity: 'critical',
        code: 'duplicate_brand',
        message: 'Deal duplicado en el mismo periodo',
        detail: `Ya existe un deal activo/negociación con "${deal.brandName}" (${deal.startDate ?? '—'} → ${deal.endDate ?? '—'}).`,
      })
    } else if (talentId) {
      conflicts.push({
        severity: 'warning',
        code: 'overlapping_deal',
        message: 'Solapamiento con otro patrocinio',
        detail: `Coincide con "${deal.brandName}" (${deal.startDate ?? '—'} → ${deal.endDate ?? '—'}). Revisa exclusividades.`,
      })
    }
  }

  const talentRestrictions = restrictions.filter((r) => !talentId || r.talentId === talentId)
  for (const rule of talentRestrictions) {
    if (!rangesOverlap(draft.startDate, draft.endDate, rule.startsAt, rule.endsAt)) continue

    if (rule.kind === 'exclusivity' && !brandsConflict(brand, rule.brandName)) {
      conflicts.push({
        severity: 'critical',
        code: 'exclusivity_violation',
        message: 'Violación de exclusividad',
        detail: `${rule.talentLogin ? `@${rule.talentLogin}` : 'Talento'} tiene exclusividad con "${rule.brandName}" (${rule.startsAt ?? '—'} → ${rule.endsAt ?? '—'}).`,
      })
    }

    if (rule.kind === 'blackout' && brandsConflict(brand, rule.brandName)) {
      conflicts.push({
        severity: 'critical',
        code: 'blackout_violation',
        message: 'Periodo blackout',
        detail: `"${rule.brandName}" está bloqueado (${rule.startsAt ?? '—'} → ${rule.endsAt ?? '—'}). ${rule.notes ?? ''}`.trim(),
      })
    }
  }

  const seen = new Set<string>()
  return conflicts.filter((c) => {
    const key = `${c.code}:${c.detail}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function hasBlockingConflicts(conflicts: DealConflict[]) {
  return conflicts.some((c) => c.severity === 'critical')
}
