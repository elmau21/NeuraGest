import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  buildTwitchChannelUrl,
  buildTwitchChatUrl,
  buildTwitchPlayerUrl,
  canEmbedTwitchPlayer,
  getTwitchEmbedParents,
  MAX_MOSAIC_STREAMS,
} from './twitch-embed'

describe('twitch-embed helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('expone un límite útil para el mosaico', () => {
    expect(MAX_MOSAIC_STREAMS).toBe(6)
  })

  it('incluye localhost y 127.0.0.1 como parents base', () => {
    const parents = getTwitchEmbedParents()
    expect(parents).toContain('localhost')
    expect(parents).toContain('127.0.0.1')
    expect(parents).not.toContain('tauri.localhost')
  })

  it('construye URL de player con channel, parent y mute', () => {
    const url = buildTwitchPlayerUrl('AriKyu_', { muted: true, autoplay: true })
    const parsed = new URL(url)
    expect(parsed.origin).toBe('https://player.twitch.tv')
    expect(parsed.searchParams.get('channel')).toBe('arikyu_')
    expect(parsed.searchParams.get('muted')).toBe('true')
    expect(parsed.searchParams.get('autoplay')).toBe('true')
    expect(parsed.searchParams.getAll('parent').length).toBeGreaterThanOrEqual(1)
    expect(parsed.searchParams.getAll('parent')).toContain('localhost')
  })

  it('construye URL de chat con parent', () => {
    const url = buildTwitchChatUrl('nosomevt')
    const parsed = new URL(url)
    expect(parsed.href.startsWith('https://www.twitch.tv/embed/nosomevt/chat')).toBe(true)
    expect(parsed.searchParams.getAll('parent')).toContain('localhost')
  })

  it('construye URL pública del canal', () => {
    expect(buildTwitchChannelUrl('BhikoruVt')).toBe('https://www.twitch.tv/bhikoruvt')
  })

  it('documenta que el mosaico embed no es sesión de cuenta', () => {
    // player.twitch.tv con parent local no hereda el login OAuth de NeuraGest.
    const player = buildTwitchPlayerUrl('arikyu_')
    expect(player.startsWith('https://player.twitch.tv/')).toBe(true)
    expect(buildTwitchChannelUrl('arikyu_')).toBe('https://www.twitch.tv/arikyu_')
  })

  it('permite embed en http://localhost', () => {
    vi.stubGlobal('window', {
      location: { protocol: 'http:', hostname: 'localhost' },
    })
    expect(canEmbedTwitchPlayer()).toBe(true)
  })

  it('permite embed en http://127.0.0.1', () => {
    vi.stubGlobal('window', {
      location: { protocol: 'http:', hostname: '127.0.0.1' },
    })
    expect(canEmbedTwitchPlayer()).toBe(true)
  })

  it('bloquea embed en tauri.localhost (origin inválido para Twitch)', () => {
    vi.stubGlobal('window', {
      location: { protocol: 'http:', hostname: 'tauri.localhost' },
    })
    expect(canEmbedTwitchPlayer()).toBe(false)
  })
})
