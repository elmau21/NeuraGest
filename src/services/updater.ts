import { check } from '@tauri-apps/plugin-updater'
import { isTauri } from '@/services/twitch'

export type UpdateCheckResult =
  | { status: 'unavailable'; message: string }
  | { status: 'up-to-date'; currentVersion: string }
  | { status: 'available'; version: string; notes?: string }
  | { status: 'installed'; version: string }

export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  if (!isTauri) {
    return { status: 'unavailable', message: 'Actualizaciones solo en la app de escritorio.' }
  }

  try {
    const update = await check()
    if (!update) {
      return { status: 'up-to-date', currentVersion: '1.0.0' }
    }
    return {
      status: 'available',
      version: update.version,
      notes: update.body ?? undefined,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('REPLACE_WITH_TAURI') || message.includes('endpoint') || message.includes('pubkey')) {
      return {
        status: 'unavailable',
        message: 'Actualizador sin configurar. Consulta la documentación de publicación.',
      }
    }
    return { status: 'unavailable', message }
  }
}

export async function installAppUpdate(): Promise<UpdateCheckResult> {
  if (!isTauri) {
    return { status: 'unavailable', message: 'Actualizaciones solo en la app de escritorio.' }
  }

  const update = await check()
  if (!update) {
    return { status: 'up-to-date', currentVersion: '1.0.0' }
  }

  await update.downloadAndInstall()
  return { status: 'installed', version: update.version }
}
