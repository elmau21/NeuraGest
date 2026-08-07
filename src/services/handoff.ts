import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '@/services/twitch'

export type HandoffStatus = 'pending' | 'acknowledged' | 'completed'

export type ShiftHandoff = {
  id: string
  fromManagerId: string
  fromManagerLogin?: string
  fromManagerDisplayName?: string
  toManagerId: string
  toManagerLogin?: string
  toManagerDisplayName?: string
  talentIds: string[]
  talentLogins?: string[]
  openItemsSummary?: string
  notes?: string
  status: HandoffStatus
  handoffAt: string
  acknowledgedAt?: string
}

export const HANDOFF_STATUS_LABELS: Record<HandoffStatus, string> = {
  pending: 'Pendiente',
  acknowledged: 'Recibido',
  completed: 'Completado',
}

function requireTauri() {
  if (!isTauri) throw new Error('Este módulo requiere la app de escritorio con sesión de Twitch.')
}

export async function listShiftHandoffs(status?: HandoffStatus): Promise<ShiftHandoff[]> {
  requireTauri()
  return invoke<ShiftHandoff[]>('list_shift_handoffs', { status: status ?? null })
}

export async function createShiftHandoff(input: {
  fromManagerId: string
  toManagerId: string
  talentIds: string[]
  openItemsSummary?: string
  notes?: string
}): Promise<ShiftHandoff> {
  requireTauri()
  return invoke<ShiftHandoff>('create_shift_handoff', {
    fromManagerId: input.fromManagerId,
    toManagerId: input.toManagerId,
    talentIds: input.talentIds,
    openItemsSummary: input.openItemsSummary ?? null,
    notes: input.notes ?? null,
  })
}

export async function updateHandoffStatus(id: string, status: HandoffStatus): Promise<ShiftHandoff> {
  requireTauri()
  return invoke<ShiftHandoff>('update_handoff_status', { id, status })
}

export async function handoffOnManagerChange(input: {
  talentId: string
  talentLogin: string
  previousManagerId?: string
  newManagerId: string
  openItemsSummary?: string
}): Promise<ShiftHandoff | null> {
  if (!input.previousManagerId || input.previousManagerId === input.newManagerId) return null
  return createShiftHandoff({
    fromManagerId: input.previousManagerId,
    toManagerId: input.newManagerId,
    talentIds: [input.talentId],
    openItemsSummary: input.openItemsSummary ?? `Cambio de responsable para @${input.talentLogin}`,
    notes: `Handoff automático al reasignar manager de @${input.talentLogin}`,
  })
}
