import { getSetting, saveSetting } from '@/services/settings'

export type MlWindowDays = 7 | 14 | 30

export type MlSettings = {
  windowDays: MlWindowDays
  autoRetrain: boolean
  retrainEverySnapshots: number
  lastTrainSnapshotCount: number
  lastTrainAt?: string
  autoCreateRiskTasks: boolean
  mlAlertsEnabled: boolean
  mlAlertsDiscord: boolean
  mlAlertsNative: boolean
  postedMlAlerts: Record<string, string>
}

export const DEFAULT_ML_SETTINGS: MlSettings = {
  windowDays: 14,
  autoRetrain: false,
  retrainEverySnapshots: 50,
  lastTrainSnapshotCount: 0,
  autoCreateRiskTasks: false,
  mlAlertsEnabled: true,
  mlAlertsDiscord: true,
  mlAlertsNative: true,
  postedMlAlerts: {},
}

const ML_SETTINGS_KEY = 'ml_module'

export async function getMlSettings(): Promise<MlSettings> {
  const raw = await getSetting<Partial<MlSettings>>(ML_SETTINGS_KEY, {})
  return { ...DEFAULT_ML_SETTINGS, ...raw }
}

export async function saveMlSettings(settings: MlSettings): Promise<boolean> {
  return saveSetting(ML_SETTINGS_KEY, settings)
}

export function windowDaysToHours(days: MlWindowDays): number {
  return days * 24
}

export function filterSnapshotsByWindow<T extends { capturedAt: string }>(
  rows: T[],
  days: MlWindowDays,
): T[] {
  const cutoff = Date.now() - days * 86_400_000
  return rows.filter((r) => new Date(r.capturedAt).getTime() >= cutoff)
}

export function shouldAutoRetrain(
  settings: MlSettings,
  currentSnapshotCount: number,
): boolean {
  if (!settings.autoRetrain) return false
  const delta = currentSnapshotCount - settings.lastTrainSnapshotCount
  return delta >= settings.retrainEverySnapshots
}
