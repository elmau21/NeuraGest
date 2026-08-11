import { describe, expect, it } from 'vitest'
import {
  canAccessPath,
  canEditPersonalSettings,
  canMutateDesign,
  canMutateLeague,
  defaultPathForRoles,
  DESIGNER_ALLOWED_PATHS,
  DESIGNER_DEFAULT_PATH,
  DEV_ALLOWED_PATHS,
  DEV_DEFAULT_PATH,
  hasFullNavAccess,
  isBasicSettingsOnly,
  isDesignerOnlyNav,
  isDevOnlyNav,
  isLeagueOnlyNav,
  isRestrictedNav,
  LEAGUE_ALLOWED_PATHS,
  LEAGUE_DEFAULT_PATH,
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

  it('solo designer: War Room + Diseño (sin Dashboard/Ajustes/Ops resto)', () => {
    expect(isDesignerOnlyNav(['designer'])).toBe(true)
    expect(isRestrictedNav(['designer'])).toBe(true)
    expect(isDevOnlyNav(['designer'])).toBe(false)
    for (const path of DESIGNER_ALLOWED_PATHS) {
      expect(canAccessPath(['designer'], path)).toBe(true)
    }
    expect(canAccessPath(['designer'], '/diseno/huecos')).toBe(true)
    expect(canAccessPath(['designer'], '/diseno/briefs')).toBe(true)
    expect(canAccessPath(['designer'], '/neuralleague')).toBe(false)
    expect(canAccessPath(['designer'], '/')).toBe(false)
    expect(canAccessPath(['designer'], '/ajustes')).toBe(false)
    expect(canAccessPath(['designer'], '/crm')).toBe(false)
    expect(canAccessPath(['designer'], '/inteligencia')).toBe(false)
    expect(canAccessPath(['designer'], '/auditoria')).toBe(false)
    expect(defaultPathForRoles(['designer'])).toBe(DESIGNER_DEFAULT_PATH)
  })

  it('owner/admin/manager + designer ven navegación completa', () => {
    expect(hasFullNavAccess(['manager', 'designer'])).toBe(true)
    expect(isDesignerOnlyNav(['owner', 'designer'])).toBe(false)
    expect(canAccessPath(['admin', 'designer'], '/crm')).toBe(true)
    expect(canAccessPath(['manager', 'designer'], '/ajustes')).toBe(true)
  })

  it('designer puede mutar Diseño; staff no', () => {
    expect(canMutateDesign(['designer'])).toBe(true)
    expect(canMutateDesign(['manager'])).toBe(true)
    expect(canMutateDesign(['staff'])).toBe(false)
  })

  it('designer+dev sin full-nav: unión de rutas; default War Room', () => {
    expect(isRestrictedNav(['designer', 'dev'])).toBe(true)
    expect(canAccessPath(['designer', 'dev'], '/war-room')).toBe(true)
    expect(canAccessPath(['designer', 'dev'], '/diseno')).toBe(true)
    expect(canAccessPath(['designer', 'dev'], '/inteligencia')).toBe(true)
    expect(canAccessPath(['designer', 'dev'], '/crm')).toBe(false)
    expect(defaultPathForRoles(['designer', 'dev'])).toBe(DESIGNER_DEFAULT_PATH)
  })

  it('solo league_manager / coach / analyst / player: NeuraLeague + War Room + ajustes', () => {
    for (const role of ['league_manager', 'coach', 'analyst', 'player'] as const) {
      expect(isLeagueOnlyNav([role])).toBe(true)
      expect(isRestrictedNav([role])).toBe(true)
      expect(isBasicSettingsOnly([role])).toBe(true)
      expect(canEditPersonalSettings([role])).toBe(true)
      for (const path of LEAGUE_ALLOWED_PATHS) {
        expect(canAccessPath([role], path)).toBe(true)
      }
      expect(canAccessPath([role], '/neuralleague/equipos')).toBe(true)
      expect(canAccessPath([role], '/neuralleague/reclutamiento')).toBe(true)
      expect(canAccessPath([role], '/war-room')).toBe(true)
      expect(canAccessPath([role], '/ajustes')).toBe(true)
      expect(canAccessPath([role], '/')).toBe(false)
      expect(canAccessPath([role], '/diseno')).toBe(false)
      expect(canAccessPath([role], '/crm')).toBe(false)
      expect(canAccessPath([role], '/talentos')).toBe(false)
      expect(defaultPathForRoles([role])).toBe(LEAGUE_DEFAULT_PATH)
    }
  })

  it('owner/admin/manager + rol liga ven navegación completa', () => {
    expect(hasFullNavAccess(['manager', 'coach'])).toBe(true)
    expect(isLeagueOnlyNav(['admin', 'player'])).toBe(false)
    expect(isBasicSettingsOnly(['admin', 'player'])).toBe(false)
    expect(canAccessPath(['owner', 'league_manager'], '/crm')).toBe(true)
    expect(canAccessPath(['staff', 'analyst'], '/neuralleague')).toBe(true)
  })

  it('canMutateLeague: manager/coach/analyst sí; player y staff no', () => {
    expect(canMutateLeague(['league_manager'])).toBe(true)
    expect(canMutateLeague(['coach'])).toBe(true)
    expect(canMutateLeague(['analyst'])).toBe(true)
    expect(canMutateLeague(['owner'])).toBe(true)
    expect(canMutateLeague(['player'])).toBe(false)
    expect(canMutateLeague(['staff'])).toBe(false)
    expect(canMutateLeague(['designer'])).toBe(false)
  })

  it('designer+player sin full-nav: unión Diseño + NeuraLeague + ajustes básicos', () => {
    expect(isRestrictedNav(['designer', 'player'])).toBe(true)
    expect(isLeagueOnlyNav(['designer', 'player'])).toBe(false)
    expect(isBasicSettingsOnly(['designer', 'player'])).toBe(true)
    expect(canEditPersonalSettings(['designer', 'player'])).toBe(true)
    expect(canAccessPath(['designer', 'player'], '/diseno')).toBe(true)
    expect(canAccessPath(['designer', 'player'], '/neuralleague')).toBe(true)
    expect(canAccessPath(['designer', 'player'], '/war-room')).toBe(true)
    expect(canAccessPath(['designer', 'player'], '/ajustes')).toBe(true)
    expect(canAccessPath(['designer', 'player'], '/crm')).toBe(false)
    expect(defaultPathForRoles(['designer', 'player'])).toBe(DESIGNER_DEFAULT_PATH)
  })
})
