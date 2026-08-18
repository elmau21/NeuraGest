import { check } from '@tauri-apps/plugin-updater'
import { isTauri } from '@/services/twitch'

export type UpdateCheckResult =
  | { status: 'unavailable'; message: string }
  | { status: 'up-to-date'; currentVersion: string }
  | { status: 'available'; version: string; notes?: string }
  | { status: 'installed'; version: string }

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? '1.0.6'

/** Token opcional para repos privados de GitHub (solo lectura de releases). */
function updaterRequestOptions() {
  const token = import.meta.env.VITE_GITHUB_RELEASES_TOKEN?.trim()
  if (!token) return undefined
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  }
}

function isUpdaterNotConfigured(message: string) {
  return (
    message.includes('REPLACE_WITH_TAURI') ||
    message.includes('endpoint') ||
    message.includes('pubkey') ||
    message.includes('invalid public key')
  )
}

export function getAppVersion() {
  return APP_VERSION
}

export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  if (!isTauri) {
    return { status: 'unavailable', message: 'Actualizaciones solo en la app de escritorio.' }
  }

  try {
    const update = await check(updaterRequestOptions())
    if (!update) {
      return { status: 'up-to-date', currentVersion: APP_VERSION }
    }
    return {
      status: 'available',
      version: update.version,
      notes: update.body ?? undefined,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (isUpdaterNotConfigured(message)) {
      return {
        status: 'unavailable',
        message: 'Actualizador sin configurar. El owner debe añadir la clave pública en tauri.conf.json.',
      }
    }
    if (message.includes('404') || message.toLowerCase().includes('not found')) {
      return {
        status: 'unavailable',
        message: 'No hay releases publicados todavía o el repositorio requiere token de GitHub.',
      }
    }
    return { status: 'unavailable', message }
  }
}

export async function installAppUpdate(): Promise<UpdateCheckResult> {
  if (!isTauri) {
    return { status: 'unavailable', message: 'Actualizaciones solo en la app de escritorio.' }
  }

  const update = await check(updaterRequestOptions())
  if (!update) {
    return { status: 'up-to-date', currentVersion: APP_VERSION }
  }

  await update.downloadAndInstall()
  return { status: 'installed', version: update.version }
}
