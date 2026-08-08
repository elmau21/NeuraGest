import { describe, expect, it } from 'vitest'
import {
  canAccessPath,
  defaultPathForRoles,
  DEV_ALLOWED_PATHS,
  DEV_DEFAULT_PATH,
  hasFullNavAccess,
  isDevOnlyNav,
} from './permissions'

describe('nav por rol', () => {
  it('owner+dev tiene navegación completa (prioridad owner)', () => {
    expect(hasFullNavAccess(['owner', 'dev'])).toBe(true)
    expect(isDevOnlyNav(['owner', 'dev'])).toBe(false)
    expect(canAccessPath(['owner', 'dev'], '/auditoria')).toBe(true)
    expect(canAccessPath(['owner', 'dev'], '/crm')).toBe(true)
  })

  it('solo dev: solo Inteligencia, Ciencia, Estadísticas y Analítica', () => {
    expect(isDevOnlyNav(['dev'])).toBe(true)
    for (const path of DEV_ALLOWED_PATHS) {
      expect(canAccessPath(['dev'], path)).toBe(true)
    }
    expect(canAccessPath(['dev'], '/auditoria')).toBe(false)
    expect(canAccessPath(['dev'], '/')).toBe(false)
    expect(canAccessPath(['dev'], '/ajustes')).toBe(false)
    expect(canAccessPath(['dev'], '/war-room')).toBe(false)
    expect(defaultPathForRoles(['dev'])).toBe(DEV_DEFAULT_PATH)
  })

  it('admin/manager/staff no se restringen por tener o no dev', () => {
    expect(isDevOnlyNav(['admin'])).toBe(false)
    expect(isDevOnlyNav(['manager'])).toBe(false)
    expect(isDevOnlyNav(['staff'])).toBe(false)
    expect(canAccessPath(['admin'], '/crm')).toBe(true)
    expect(canAccessPath(['staff', 'dev'], '/talentos')).toBe(true)
  })

  it('maufuwari siempre tiene nav completa', () => {
    expect(isDevOnlyNav(['dev'], 'maufuwari')).toBe(false)
    expect(canAccessPath(['dev'], '/ajustes', 'maufuwari')).toBe(true)
  })
})
