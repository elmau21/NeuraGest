import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PRESENCE_SMALL_TEXT,
  DEFAULT_PRESENCE_STATE,
  presenceLabelForPath,
  presenceSmallTextFor,
} from './discord-presence'

describe('presenceLabelForPath', () => {
  it('mapea rutas conocidas con labels cortos', () => {
    expect(presenceLabelForPath('/')).toBe('Dashboard')
    expect(presenceLabelForPath('/war-room')).toBe('War Room')
    expect(presenceLabelForPath('/ajustes/')).toBe('Ajustes')
  })

  it('detecta perfiles de talento', () => {
    expect(presenceLabelForPath('/talento/arikyu_')).toBe('Perfil de talento')
    expect(presenceLabelForPath('/talentos/arikyu_')).toBe('Perfil de talento')
  })

  it('usa fallback para rutas desconocidas', () => {
    expect(presenceLabelForPath('/algo-nuevo')).toBe(DEFAULT_PRESENCE_STATE)
  })
})

describe('presenceSmallTextFor', () => {
  it('usa la página cuando showPage está activo', () => {
    expect(presenceSmallTextFor('/war-room', true)).toBe('War Room')
  })

  it('usa marca por defecto si no hay página', () => {
    expect(presenceSmallTextFor(undefined, true)).toBe(DEFAULT_PRESENCE_SMALL_TEXT)
    expect(presenceSmallTextFor('/war-room', false)).toBe(DEFAULT_PRESENCE_SMALL_TEXT)
  })
})
