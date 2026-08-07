/** Máximo de embeds simultáneos: equilibrio entre utilidad NOC y carga del webview. */
export const MAX_MOSAIC_STREAMS = 6

/**
 * Twitch exige que `parent` coincida con el host del documento que embebe.
 * En release Tauri servimos la UI por `http://127.0.0.1:<port>` (plugin localhost)
 * porque el origin por defecto `tauri.localhost` no es válido para embeds Twitch
 * (HTTPS obligatorio salvo localhost / 127.0.0.1).
 */
export function getTwitchEmbedParents(): string[] {
  const parents = new Set<string>(['localhost', '127.0.0.1'])
  if (typeof window !== 'undefined' && window.location.hostname) {
    const host = window.location.hostname
    // Solo hosts que Twitch acepta como parent (sin schemes raros).
    if (host && host !== 'tauri.localhost') {
      parents.add(host)
    }
  }
  return [...parents]
}

/** Twitch solo embebe desde http(s); origins custom (tauri://, etc.) fallan. */
export function canEmbedTwitchPlayer(): boolean {
  if (typeof window === 'undefined') return true
  const { protocol, hostname } = window.location
  if (protocol !== 'http:' && protocol !== 'https:') return false
  // tauri.localhost se sirve por HTTP custom y Twitch lo rechaza (no es "localhost").
  if (hostname === 'tauri.localhost' || hostname.endsWith('.tauri.localhost')) return false
  return true
}

function appendParents(params: URLSearchParams) {
  for (const parent of getTwitchEmbedParents()) {
    params.append('parent', parent)
  }
}

export function buildTwitchPlayerUrl(
  login: string,
  options?: { muted?: boolean; autoplay?: boolean },
): string {
  const params = new URLSearchParams()
  params.set('channel', login.toLowerCase())
  appendParents(params)
  params.set('muted', String(options?.muted ?? true))
  params.set('autoplay', String(options?.autoplay ?? true))
  return `https://player.twitch.tv/?${params.toString()}`
}

export function buildTwitchChatUrl(login: string): string {
  const params = new URLSearchParams()
  appendParents(params)
  params.set('darkpopout', '')
  return `https://www.twitch.tv/embed/${login.toLowerCase()}/chat?${params.toString()}`
}

export function buildTwitchChannelUrl(login: string): string {
  return `https://www.twitch.tv/${login.toLowerCase()}`
}
