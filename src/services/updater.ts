import { check } from '@tauri-apps/plugin-updater'
import { isTauri } from '@/services/twitch'

export type UpdateCheckResult =
  | { status: 'unavailable'; message: string }
  | { status: 'up-to-date'; currentVersion: string }
  | { status: 'available'; version: string; notes?: string }
  | { status: 'installed'; version: string }

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? '1.0.7'

/**
 * Token opcional para repos privados de GitHub (solo lectura de releases).
 * No enviar `Accept: application/vnd.github+json`: ese media type es de la API
 * y haría que GitHub devolviera metadatos JSON en vez del instalador. El plugin
 * pone `application/json` en check() y `application/octet-stream` en download().
 */
function updaterRequestOptions() {
  const token = import.meta.env.VITE_GITHUB_RELEASES_TOKEN?.trim()
  if (!token) return undefined
  return {
    headers: {
      Authorization: `Bearer ${token}`,
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
    if (message.toLowerCase().includes('error decoding response body')) {
      return {
        status: 'unavailable',
        message:
          'GitHub devolvió latest.json en un formato que el updater no pudo leer. Suele ser un BOM UTF-8 o una página HTML de login (repo privado sin token).',
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
