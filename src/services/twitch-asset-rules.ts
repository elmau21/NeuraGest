/** Reglas prácticas de entregables Twitch (UI + validación en Drive). */

export type TwitchAssetKind = 'offline' | 'banner' | 'panel' | 'overlay' | 'thumbnail' | 'other'

export type ChannelAssetSpec = {
  kind: Exclude<TwitchAssetKind, 'other'>
  label: string
  hint: string
  /** Palabras en nombre de archivo/carpeta (minúsculas). */
  keywords: string[]
  maxBytes: number
  mimeOk: (mime?: string, name?: string) => boolean
}

const IMAGE_MIME = /^(image\/(png|jpeg|jpg|webp|gif))$/i
const IMAGE_EXT = /\.(png|jpe?g|webp|gif)$/i

function isImage(mime?: string, name?: string): boolean {
  if (mime && IMAGE_MIME.test(mime)) return true
  if (name && IMAGE_EXT.test(name)) return true
  return false
}

export const CHANNEL_ASSET_SPECS: ChannelAssetSpec[] = [
  {
    kind: 'offline',
    label: 'Imagen offline',
    hint: '1920×1080 · PNG/JPG/WEBP · máx. 10 MB',
    keywords: ['offline', 'pantalla-offline', 'offline-image', 'offline_image'],
    maxBytes: 10 * 1024 * 1024,
    mimeOk: isImage,
  },
  {
    kind: 'banner',
    label: 'Banner',
    hint: '1200×480 · PNG/JPG/WEBP · máx. 10 MB',
    keywords: ['banner', 'header', 'profile-banner', 'perfil'],
    maxBytes: 10 * 1024 * 1024,
    mimeOk: isImage,
  },
  {
    kind: 'panel',
    label: 'Paneles',
    hint: 'Ancho 320 px · PNG/JPG/GIF/WEBP · máx. 2 MB c/u',
    keywords: ['panel', 'panels', 'paneles'],
    maxBytes: 2 * 1024 * 1024,
    mimeOk: isImage,
  },
  {
    kind: 'overlay',
    label: 'Overlay',
    hint: 'PNG con transparencia preferible · máx. 8 MB',
    keywords: ['overlay', 'overlays', 'alerta', 'alert'],
    maxBytes: 8 * 1024 * 1024,
    mimeOk: isImage,
  },
  {
    kind: 'thumbnail',
    label: 'Thumbnail',
    hint: '1280×720 · PNG/JPG/WEBP · máx. 5 MB',
    keywords: ['thumbnail', 'thumb', 'miniatura', 'vod'],
    maxBytes: 5 * 1024 * 1024,
    mimeOk: isImage,
  },
]

export const TWITCH_RULES_BLURB =
  'Offline 1920×1080 · Banner 1200×480 · Paneles ~320 px de ancho · PNG/JPG/WEBP (GIF en paneles). Pesos: offline/banner ≤10 MB, panel ≤2 MB, ZIP ≤500 MB.'

export function detectAssetKind(name: string, assetKind?: string | null): TwitchAssetKind {
  if (assetKind && CHANNEL_ASSET_SPECS.some((s) => s.kind === assetKind)) {
    return assetKind as TwitchAssetKind
  }
  const lower = name.toLowerCase()
  for (const spec of CHANNEL_ASSET_SPECS) {
    if (spec.keywords.some((k) => lower.includes(k))) return spec.kind
  }
  return 'other'
}

export type TwitchReadyCheck = {
  ok: boolean
  kind: TwitchAssetKind
  messages: string[]
}

export function validateForTwitch(input: {
  name: string
  mimeType?: string
  sizeBytes?: number
  assetKind?: string | null
}): TwitchReadyCheck {
  return isTwitchReadyCandidate(input)
}

/** Recalcula ok de forma explícita. */
export function isTwitchReadyCandidate(input: {
  name: string
  mimeType?: string
  sizeBytes?: number
  assetKind?: string | null
}): TwitchReadyCheck {
  const kind = detectAssetKind(input.name, input.assetKind)
  if (kind === 'other') {
    return {
      ok: false,
      kind,
      messages: ['Indica el tipo (offline, banner, panel…) en el nombre o en el selector.'],
    }
  }
  const spec = CHANNEL_ASSET_SPECS.find((s) => s.kind === kind)!
  const messages: string[] = []
  if (!spec.mimeOk(input.mimeType, input.name)) {
    messages.push(`Formato no apto para ${spec.label}.`)
  }
  if (input.sizeBytes != null && input.sizeBytes > spec.maxBytes) {
    messages.push(`Supera el peso máximo (${(spec.maxBytes / (1024 * 1024)).toFixed(0)} MB).`)
  }
  if (messages.length === 0) {
    return { ok: true, kind, messages: [`Listo según reglas: ${spec.hint}`] }
  }
  return { ok: false, kind, messages }
}
