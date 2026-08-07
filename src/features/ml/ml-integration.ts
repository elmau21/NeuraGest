import { supabase } from '@/services/supabase'
import { createTask } from '@/services/tasks'
import type { ForecastResult } from './ml-forecast'
import type { InactivityRisk, OptimalSlot } from './ml-utils'
import type { AnomalyPoint } from './ml-utils'
import { getMlSettings } from './ml-settings'

export type WarRoomSlotSuggestion = {
  login: string
  displayName: string
  suggestedSlot: string
  day: number
  hour: number
  expectedViewers: number
  forecastViewers?: number
  source: 'schedule' | 'forecast' | 'hybrid'
}

export function buildWarRoomSlotSuggestions(
  optimalSlots: OptimalSlot[],
  forecasts: Record<string, ForecastResult | null>,
  displayNames: Record<string, string>,
): WarRoomSlotSuggestion[] {
  const byLogin = new Map<string, OptimalSlot>()
  for (const slot of optimalSlots) {
    if (!byLogin.has(slot.login)) byLogin.set(slot.login, slot)
  }

  const logins = new Set([...byLogin.keys(), ...Object.keys(forecasts)])

  return [...logins].map((login) => {
    const slot = byLogin.get(login)
    const forecast = forecasts[login]
    const tfProjection = forecast?.projected[0]?.tf ?? forecast?.projected[0]?.ma
    const expectedViewers = tfProjection ?? slot?.avgViewers ?? 0

    const source: WarRoomSlotSuggestion['source'] =
      slot && tfProjection ? 'hybrid' : slot ? 'schedule' : 'forecast'

    return {
      login,
      displayName: displayNames[login] ?? login,
      suggestedSlot: slot?.label ?? 'Sin franja histórica',
      day: slot?.day ?? 0,
      hour: slot?.hour ?? 20,
      expectedViewers: Math.round(expectedViewers),
      forecastViewers: tfProjection ? Math.round(tfProjection) : undefined,
      source,
    }
  }).sort((a, b) => b.expectedViewers - a.expectedViewers)
}

export async function logMlAnomaliesToActivity(
  anomalies: AnomalyPoint[],
  limit = 5,
): Promise<number> {
  if (!supabase) return 0
  let logged = 0

  for (const a of anomalies.slice(0, limit)) {
    const { error } = await supabase.rpc('log_activity', {
      p_entity_type: 'ml',
      p_entity_id: a.login,
      p_action: 'anomaly_detected',
      p_metadata: {
        displayName: a.displayName,
        viewers: a.viewers,
        zScore: a.zScore,
        direction: a.direction,
        capturedAt: a.capturedAt,
      },
    })
    if (!error) logged += 1
  }

  return logged
}

export async function logMlRegimeToActivity(
  login: string,
  displayName: string,
  direction: string,
  viewers: number,
): Promise<void> {
  if (!supabase) return
  await supabase.rpc('log_activity', {
    p_entity_type: 'ml',
    p_entity_id: login,
    p_action: 'regime_change',
    p_metadata: { displayName, direction, viewers },
  })
}

export async function createRiskTasksIfEnabled(
  risks: InactivityRisk[],
): Promise<string[]> {
  const settings = await getMlSettings()
  if (!settings.autoCreateRiskTasks || !supabase) return []

  const created: string[] = []
  const critical = risks.filter((r) => r.riskLevel === 'crítico' || r.riskLevel === 'alto')

  for (const risk of critical.slice(0, 3)) {
    const task = await createTask({
      title: `[ML] Seguimiento inactividad · ${risk.displayName}`,
      description: `Riesgo ${risk.riskLevel} (score ${risk.riskScore}). Factores: ${risk.factors.join('; ')}`,
      priority: risk.riskLevel === 'crítico' ? 'high' : 'medium',
      status: 'backlog',
      tags: ['ML', 'Inactividad'],
    })
    if (task) {
      created.push(task.id)
      await supabase.rpc('log_activity', {
        p_entity_type: 'ml',
        p_entity_id: risk.login,
        p_action: 'risk_task_created',
        p_metadata: {
          title: task.title,
          riskScore: risk.riskScore,
          taskId: task.id,
        },
      })
    }
  }

  return created
}

export async function logMlTrainingComplete(
  modelCount: number,
  avgR2: number,
  avgMae: number,
): Promise<void> {
  if (!supabase) return
  await supabase.rpc('log_activity', {
    p_entity_type: 'ml',
    p_entity_id: null,
    p_action: 'models_trained',
    p_metadata: { modelCount, avgR2, avgMae },
  })
}

export function scoreClipInHighlights(
  contentType: string,
  baseScore: number,
): number {
  if (contentType === 'clip') return baseScore + 5
  if (contentType === 'vod') return baseScore + 3
  return baseScore
}

export type IntegrationSummary = {
  slotSuggestions: WarRoomSlotSuggestion[]
  activityLogged: number
  tasksCreated: string[]
}

export async function runMlIntegrations(input: {
  anomalies: AnomalyPoint[]
  risks: InactivityRisk[]
  optimalSlots: OptimalSlot[]
  forecasts: Record<string, ForecastResult | null>
  displayNames: Record<string, string>
}): Promise<IntegrationSummary> {
  const slotSuggestions = buildWarRoomSlotSuggestions(
    input.optimalSlots,
    input.forecasts,
    input.displayNames,
  )
  const activityLogged = await logMlAnomaliesToActivity(input.anomalies)
  const tasksCreated = await createRiskTasksIfEnabled(input.risks)

  return { slotSuggestions, activityLogged, tasksCreated }
}
