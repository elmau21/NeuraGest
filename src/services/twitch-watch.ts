import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-shell'
import { isTauri } from '@/services/twitch'
import { buildTwitchChannelUrl } from '@/features/war-room/twitch-embed'

export type TwitchWatchMode = 'window' | 'browser'

/**
 * Abre el canal en una ventana/webview de NeuraGest donde el usuario puede
 * iniciar sesión en Twitch (cookies propias). Eso sí puede contar como viewer.
 * El mosaico con player.twitch.tv no usa esa sesión.
 * Si la ventana falla, abre el navegador del sistema.
 */
export async function openTwitchWithAccount(login: string): Promise<TwitchWatchMode> {
  const url = buildTwitchChannelUrl(login)
  if (isTauri) {
    try {
      await invoke('open_twitch_channel_window', { login })
      return 'window'
    } catch {
      await open(url)
      return 'browser'
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer')
  return 'browser'
}

export async function openTwitchInBrowser(login: string): Promise<void> {
  const url = buildTwitchChannelUrl(login)
  if (isTauri) {
    await open(url)
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}
