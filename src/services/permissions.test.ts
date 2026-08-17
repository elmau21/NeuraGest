import { describe, expect, it } from 'vitest'
import {
  canAccessControlCenter,
  canAccessDatosNav,
  canAccessPath,
  canAdminMutate,
  canAssignDevRole,
  canAssignOwnerRole,
  canAssignStrongRoles,
  canCreateDocumentDriveFolder,
  canEditPersonalSettings,
  canManageAppRoles,
  canMutate,
  canMutateDesign,
  canMutateLeague,
  CONTROL_CENTER_PATH,
  defaultPathForRoles,
  DESIGNER_ALLOWED_PATHS,
  DESIGNER_DEFAULT_PATH,
  DEV_ALLOWED_PATHS,
  DEV_DEFAULT_PATH,
  hasAppAccess,
  hasFullNavAccess,
  isBasicSettingsOnly,
  isDesignerOnlyNav,
  isDevOnlyNav,
  isLeagueOnlyNav,
  isNoRoleUser,
  isRestrictedNav,
  LEAGUE_ALLOWED_PATHS,
  LEAGUE_DEFAULT_PATH,
  STRONG_APP_ROLES,
} from './permissions'
import { canViewAudit } from './audit'

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

  it('assistant: full nav, centro de control, muta como manager; no admin-mutate', () => {
    expect(hasFullNavAccess(['assistant'])).toBe(true)
    expect(isDevOnlyNav(['assistant'])).toBe(false)
    expect(isDesignerOnlyNav(['assistant'])).toBe(false)
    expect(isLeagueOnlyNav(['assistant'])).toBe(false)
    expect(isRestrictedNav(['assistant'])).toBe(false)
    expect(canAccessPath(['assistant'], '/crm')).toBe(true)
    expect(canAccessPath(['assistant'], '/auditoria')).toBe(true)
    expect(canAccessPath(['assistant'], '/inteligencia')).toBe(true)
    expect(canAccessDatosNav(['assistant'])).toBe(true)
    expect(canAccessPath(['assistant'], '/diseno')).toBe(true)
    expect(canAccessPath(['assistant'], '/neuralleague')).toBe(true)
    expect(canAccessPath(['assistant'], CONTROL_CENTER_PATH)).toBe(true)
    expect(canAccessPath(['assistant'], '/asistente')).toBe(true)
    expect(defaultPathForRoles(['assistant'])).toBe(CONTROL_CENTER_PATH)
    expect(defaultPathForRoles(['assistant', 'owner'])).toBe('/')
    expect(canMutate(['assistant'])).toBe(true)
    expect(canMutateDesign(['assistant'])).toBe(true)
    expect(canMutateLeague(['assistant'])).toBe(true)
    expect(canAdminMutate(['assistant'])).toBe(false)
    expect(canManageAppRoles(['assistant'])).toBe(true)
    expect(canAssignOwnerRole(['assistant'])).toBe(false)
    expect(canAssignOwnerRole(['owner'])).toBe(true)
    expect(canAssignStrongRoles(['assistant'])).toBe(false)
    expect(canAssignStrongRoles(['owner'])).toBe(true)
    expect(canAssignStrongRoles(['dev'])).toBe(true)
    expect(canAssignStrongRoles(['owner', 'assistant'])).toBe(true)
    expect(canAssignDevRole(['assistant'])).toBe(false)
    expect(canAssignDevRole(['dev'])).toBe(true)
    expect(canAssignDevRole(['owner'])).toBe(true)
    expect(STRONG_APP_ROLES).toEqual(['owner', 'dev'])
    expect(canViewAudit(['assistant'])).toBe(true)
    expect(canAccessControlCenter(['assistant'])).toBe(true)
    expect(canAccessControlCenter(['owner'])).toBe(true)
    expect(canAccessControlCenter(['admin'])).toBe(true)
    expect(canAccessControlCenter(['manager'])).toBe(true)
    expect(canAccessControlCenter(['staff'])).toBe(false)
    expect(canAccessControlCenter(['designer'])).toBe(false)
    expect(canAccessPath(['staff'], CONTROL_CENTER_PATH)).toBe(false)
    expect(canAccessPath(['designer'], CONTROL_CENTER_PATH)).toBe(false)
  })

  it('sin roles: solo pantalla de espera en /', () => {
    expect(isNoRoleUser([])).toBe(true)
    expect(hasAppAccess([])).toBe(false)
    expect(canAccessPath([], '/')).toBe(true)
    expect(canAccessPath([], '/crm')).toBe(false)
    expect(canAccessPath([], '/ajustes')).toBe(false)
    expect(canAccessPath([], '/inteligencia')).toBe(false)
    expect(defaultPathForRoles([])).toBe('/')
  })

  it('Datos solo para owner, dev y assistant', () => {
    expect(canAccessDatosNav(['owner'])).toBe(true)
    expect(canAccessDatosNav(['dev'])).toBe(true)
    expect(canAccessDatosNav(['assistant'])).toBe(true)
    expect(canAccessDatosNav(['admin'])).toBe(false)
    expect(canAccessDatosNav(['manager'])).toBe(false)
    expect(canAccessDatosNav(['staff'])).toBe(false)
    expect(canAccessDatosNav(['designer'])).toBe(false)
    expect(canAccessDatosNav(['coach'])).toBe(false)
    expect(canAccessPath(['admin'], '/inteligencia')).toBe(false)
    expect(canAccessPath(['admin'], '/auditoria')).toBe(false)
    expect(canAccessPath(['manager'], '/analitica')).toBe(false)
    expect(canAccessPath(['staff'], '/estadisticas')).toBe(false)
    expect(canAccessPath(['owner'], '/inteligencia')).toBe(true)
    expect(canAccessPath(['admin'], '/crm')).toBe(true)
  })

  it('canCreateDocumentDriveFolder: owner, manager y assistant; no admin/dev/staff', () => {
    expect(canCreateDocumentDriveFolder(['owner'])).toBe(true)
    expect(canCreateDocumentDriveFolder(['manager'])).toBe(true)
    expect(canCreateDocumentDriveFolder(['assistant'])).toBe(true)
    expect(canCreateDocumentDriveFolder(['owner', 'assistant'])).toBe(true)
    expect(canCreateDocumentDriveFolder(['admin'])).toBe(false)
    expect(canCreateDocumentDriveFolder(['dev'])).toBe(false)
    expect(canCreateDocumentDriveFolder(['staff'])).toBe(false)
    expect(canCreateDocumentDriveFolder(['designer'])).toBe(false)
    expect(canCreateDocumentDriveFolder(['league_manager'])).toBe(false)
    expect(canCreateDocumentDriveFolder(['coach'])).toBe(false)
  })
})
