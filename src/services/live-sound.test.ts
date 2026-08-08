import { afterEach, describe, expect, it } from 'vitest'
import {
  detectLiveSoundTransitions,
  resetLiveSoundDebounce,
  shouldPlayLiveSound,
} from './live-sound'
import type { Talent } from '@/types'

function talent(login: string, isLive: boolean): Talent {
  return {
    id: login,
    login,
    displayName: login,
    avatar: '',
    description: '',
    isLive,
    viewers: isLive ? 10 : 0,
    followers: 0,
    category: '',
    title: '',
    createdAt: '',
  }
}

describe('detectLiveSoundTransitions', () => {
  it('detecta offline → live y live → offline', () => {
    const prev = [talent('a', false), talent('b', true)]
    const next = [talent('a', true), talent('b', false)]
    expect(detectLiveSoundTransitions(next, prev)).toEqual(['live', 'offline'])
  })

  it('ignora talentos nuevos sin historial previo', () => {
    expect(detectLiveSoundTransitions([talent('nuevo', true)], [])).toEqual([])
  })

  it('no emite si el estado no cambia', () => {
    const list = [talent('a', true)]
    expect(detectLiveSoundTransitions(list, list)).toEqual([])
  })
})

describe('shouldPlayLiveSound', () => {
  afterEach(() => {
    resetLiveSoundDebounce()
  })

  it('permite el primero y bloquea spam cercano', () => {
    resetLiveSoundDebounce()
    expect(shouldPlayLiveSound(1000, 2500)).toBe(true)
    expect(shouldPlayLiveSound(2000, 2500)).toBe(false)
    expect(shouldPlayLiveSound(3600, 2500)).toBe(true)
  })
})
