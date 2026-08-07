import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification'
import {
  getNativeAlertSettings,
  saveNativeAlertSettings,
  type NativeAlertSettings,
} from '@/services/settings'
import type { Talent } from '@/types'
import { isTauri } from '@/services/twitch'

let permissionChecked = false

async function ensurePermission(): Promise<boolean> {
  if (!isTauri) return false
  if (permissionChecked) {
    const granted = await isPermissionGranted()
    return granted
  }
  permissionChecked = true
  let granted = await isPermissionGranted()
  if (!granted) {
    const result = await requestPermission()
    granted = result === 'granted'
  }
  return granted
}

function streamKey(talent: Talent): string {
  return talent.streamId ?? `${talent.login}-${talent.startedAt ?? 'live'}`
}

async function pushNotification(title: string, body: string): Promise<void> {
  if (!(await ensurePermission())) return
  await sendNotification({ title, body })
}

export async function notifyTalentStreamChanges(
  talents: Talent[],
  previousLiveIds: Set<string>,
  previousTalents: Talent[] = [],
): Promise<void> {
  if (!isTauri) return
  const settings = await getNativeAlertSettings()
  if (!settings.enabled) return

  const previousByLogin = new Map(previousTalents.map((talent) => [talent.login.toLowerCase(), talent]))
  let postedAlerts = { ...settings.postedAlerts }
  let dirty = false

  for (const talent of talents) {
    const key = streamKey(talent)
    const prev = previousByLogin.get(talent.login.toLowerCase())
    const wasLive = prev?.isLive ?? previousLiveIds.has(talent.streamId ?? talent.id)

    if (settings.notifyOnline && talent.isLive && !wasLive && !postedAlerts[`online:${key}`]) {
      await pushNotification(
        `${talent.displayName} en vivo`,
        `${talent.viewers.toLocaleString('es-MX')} viewers · ${talent.category || 'Twitch'}`,
      )
      postedAlerts = { ...postedAlerts, [`online:${key}`]: new Date().toISOString() }
      dirty = true
    }

    if (settings.notifyOffline && !talent.isLive && wasLive && !postedAlerts[`offline:${talent.login}`]) {
      await pushNotification(
        `${talent.displayName} offline`,
        'Se detectó fin de transmisión.',
      )
      postedAlerts = { ...postedAlerts, [`offline:${talent.login}`]: new Date().toISOString() }
      dirty = true
    }

    if (
      settings.notifyViewerThreshold
      && talent.isLive
      && settings.viewerThreshold > 0
      && talent.viewers >= settings.viewerThreshold
      && !postedAlerts[`threshold:${key}`]
    ) {
      await pushNotification(
        `Umbral alcanzado · ${talent.displayName}`,
        `${talent.viewers.toLocaleString('es-MX')} viewers (umbral ${settings.viewerThreshold.toLocaleString('es-MX')})`,
      )
      postedAlerts = { ...postedAlerts, [`threshold:${key}`]: new Date().toISOString() }
      dirty = true
    }
  }

  if (dirty) {
    await saveNativeAlertSettings({ ...settings, postedAlerts })
  }
}

export async function testNativeNotification(): Promise<boolean> {
  if (!isTauri) return false
  try {
    await pushNotification('NeuraGest', 'Las alertas nativas de Windows están activas.')
    return true
  } catch {
    return false
  }
}

export type { NativeAlertSettings }
