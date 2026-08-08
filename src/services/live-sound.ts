import type { Talent } from '@/types'

export type LiveSoundSettings = {
  /** Sonido al pasar offline → en vivo. Default OFF. */
  soundOnLive: boolean
  /** Sonido al pasar en vivo → offline. Default OFF. */
  soundOnOffline: boolean
}

export const DEFAULT_LIVE_SOUND_SETTINGS: LiveSoundSettings = {
  soundOnLive: false,
  soundOnOffline: false,
}

const STORAGE_KEY = 'neuragest-live-sound'
const MIN_GAP_MS = 2500

let lastPlayedAt = 0
let audioCtx: AudioContext | null = null

export function getLiveSoundSettings(): LiveSoundSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_LIVE_SOUND_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<LiveSoundSettings>
    return {
      soundOnLive: Boolean(parsed.soundOnLive),
      soundOnOffline: Boolean(parsed.soundOnOffline),
    }
  } catch {
    return { ...DEFAULT_LIVE_SOUND_SETTINGS }
  }
}

export function saveLiveSoundSettings(settings: LiveSoundSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    /* ignore */
  }
}

export type LiveSoundTransition = 'live' | 'offline'

/** Detecta solo transiciones reales offline↔live por login. */
export function detectLiveSoundTransitions(
  talents: Talent[],
  previousTalents: Talent[],
): LiveSoundTransition[] {
  const prevByLogin = new Map(
    previousTalents.map((t) => [t.login.toLowerCase(), t.isLive]),
  )
  const events: LiveSoundTransition[] = []
  for (const talent of talents) {
    const wasLive = prevByLogin.get(talent.login.toLowerCase())
    if (wasLive === undefined) continue
    if (talent.isLive && !wasLive) events.push('live')
    if (!talent.isLive && wasLive) events.push('offline')
  }
  return events
}

/** Debounce global para no spamear si varios canales cambian a la vez. */
export function shouldPlayLiveSound(now = Date.now(), minGapMs = MIN_GAP_MS): boolean {
  if (lastPlayedAt > 0 && now - lastPlayedAt < minGapMs) return false
  lastPlayedAt = now
  return true
}

/** Solo tests: reinicia el debounce. */
export function resetLiveSoundDebounce(): void {
  lastPlayedAt = 0
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new Ctx()
  }
  return audioCtx
}

/** Resume obligatorio: sin gesto + await, Web Audio suele quedar mudo (autoplay). */
async function ensureRunningCtx(): Promise<AudioContext | null> {
  const ctx = getCtx()
  if (!ctx) return null
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch {
      return null
    }
  }
  return ctx.state === 'running' ? ctx : ctx
}

async function playTone(frequency: number, durationMs: number, volume = 0.08): Promise<void> {
  const ctx = await ensureRunningCtx()
  if (!ctx) return

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = frequency
  gain.gain.value = 0
  osc.connect(gain)
  gain.connect(ctx.destination)

  const now = ctx.currentTime
  const attack = 0.012
  const release = Math.max(0.04, durationMs / 1000 - attack)
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(volume, now + attack)
  gain.gain.exponentialRampToValueAtTime(0.001, now + attack + release)
  osc.start(now)
  osc.stop(now + attack + release + 0.02)
}

export async function playLiveOnBeep(): Promise<void> {
  await playTone(880, 120, 0.07)
  window.setTimeout(() => {
    void playTone(1175, 90, 0.05)
  }, 90)
}

export async function playLiveOffBeep(): Promise<void> {
  await playTone(520, 140, 0.06)
  window.setTimeout(() => {
    void playTone(390, 160, 0.045)
  }, 100)
}

export function notifyLiveSoundChanges(
  talents: Talent[],
  previousTalents: Talent[],
  settings: LiveSoundSettings = getLiveSoundSettings(),
): void {
  if (!settings.soundOnLive && !settings.soundOnOffline) return
  const events = detectLiveSoundTransitions(talents, previousTalents)
  if (events.length === 0) return
  if (!shouldPlayLiveSound()) return

  const hasLive = events.includes('live')
  const hasOffline = events.includes('offline')
  if (hasLive && settings.soundOnLive) {
    playLiveOnBeep()
    return
  }
  if (hasOffline && settings.soundOnOffline) {
    playLiveOffBeep()
  }
}
