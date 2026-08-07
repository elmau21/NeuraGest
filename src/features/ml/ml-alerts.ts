import { getDiscordSettings } from '@/services/settings'
import { isTauri } from '@/services/twitch'
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification'
import { getMlSettings, saveMlSettings } from './ml-settings'
import type { AnomalyPoint } from './ml-utils'
import type { InactivityRisk } from './ml-utils'
import type { RegimeChange } from './ml-advanced'

async function ensureNativePermission(): Promise<boolean> {
  if (!isTauri) return false
  let granted = await isPermissionGranted()
  if (!granted) {
    granted = (await requestPermission()) === 'granted'
  }
  return granted
}

export async function postMlDiscordAlert(
  title: string,
  body: string,
  color = 0x6366f1,
): Promise<boolean> {
  const settings = await getDiscordSettings()
  if (!settings.enabled || !settings.webhookUrl.trim()) return false

  try {
    const response = await fetch(settings.webhookUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title,
          description: body,
          color,
          footer: { text: 'NeuraGest · ML Alert' },
        }],
      }),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function postMlNativeAlert(title: string, body: string): Promise<boolean> {
  if (!(await ensureNativePermission())) return false
  try {
    await sendNotification({ title, body })
    return true
  } catch {
    return false
  }
}

function alertKey(kind: string, id: string): string {
  return `${kind}:${id}`
}

export async function dispatchMlAlerts(input: {
  anomalies: AnomalyPoint[]
  highRisks: InactivityRisk[]
  regimeChanges: RegimeChange[]
}): Promise<{ sent: number; skipped: number }> {
  const mlSettings = await getMlSettings()
  if (!mlSettings.mlAlertsEnabled) return { sent: 0, skipped: 0 }

  let sent = 0
  let skipped = 0
  const posted = { ...mlSettings.postedMlAlerts }
  let dirty = false

  const tryAlert = async (key: string, title: string, body: string, color?: number) => {
    if (posted[key]) {
      skipped += 1
      return
    }
    let ok = false
    if (mlSettings.mlAlertsDiscord) {
      ok = await postMlDiscordAlert(title, body, color) || ok
    }
    if (mlSettings.mlAlertsNative) {
      ok = await postMlNativeAlert(title, body) || ok
    }
    if (ok) {
      posted[key] = new Date().toISOString()
      dirty = true
      sent += 1
    } else {
      skipped += 1
    }
  }

  for (const a of input.anomalies.filter((x) => x.severity === 'high').slice(0, 3)) {
    await tryAlert(
      alertKey('anomaly', `${a.login}-${a.capturedAt}`),
      `Anomalía ML · ${a.displayName}`,
      `${a.direction === 'spike' ? 'Pico' : 'Caída'} de viewers: ${a.viewers.toLocaleString('es-MX')} (z=${a.zScore})`,
      a.direction === 'spike' ? 0x22c55e : 0xef4444,
    )
  }

  for (const r of input.highRisks.filter((x) => x.riskLevel === 'crítico' || x.riskLevel === 'alto').slice(0, 3)) {
    await tryAlert(
      alertKey('risk', r.login),
      `Riesgo inactividad · ${r.displayName}`,
      `Score ${r.riskScore}/100 · ${r.daysSinceStream >= 0 ? `${r.daysSinceStream} días offline` : 'sin datos'}`,
      0xf59e0b,
    )
  }

  for (const c of input.regimeChanges.filter((x) => x.severity === 'high').slice(0, 2)) {
    await tryAlert(
      alertKey('regime', `${c.login}-${c.capturedAt}`),
      `Cambio de régimen · ${c.displayName}`,
      `CUSUM ${c.direction === 'up' ? 'alcista' : 'bajista'} · ${c.viewers.toLocaleString('es-MX')} viewers`,
      0x6366f1,
    )
  }

  if (dirty) {
    await saveMlSettings({ ...mlSettings, postedMlAlerts: posted })
  }

  return { sent, skipped }
}
