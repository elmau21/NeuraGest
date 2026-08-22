import { describe, expect, it } from 'vitest'
import { isActivityNavigable, resolveActivityNavigation } from './activity-navigation'

const controlCtx = { canAccessControlCenter: true, canAccessDatos: true, canManageRoles: true }
const basicCtx = { canAccessControlCenter: false, canAccessDatos: false, canManageRoles: false }

describe('resolveActivityNavigation', () => {
  it('navega tareas al control center con deep link', () => {
    expect(
      resolveActivityNavigation(
        { entityType: 'task', entityId: 'abc-123', action: 'reassigned', metadata: {} },
        controlCtx,
      ),
    ).toEqual({ to: '/control/tareas?task=abc-123' })
  })

  it('navega tareas a /tareas sin control center', () => {
    expect(
      resolveActivityNavigation(
        { entityType: 'task', entityId: 'abc-123', action: 'updated', metadata: {} },
        basicCtx,
      ),
    ).toEqual({ to: '/tareas?task=abc-123' })
  })

  it('navega lives al perfil del talento o war room', () => {
    expect(
      resolveActivityNavigation(
        { entityType: 'talent', action: 'live', metadata: { login: 'bhikoruvt', displayName: 'BhikoruVt' } },
      ),
    ).toEqual({ to: '/talento/bhikoruvt' })

    expect(
      resolveActivityNavigation(
        { entityType: 'talent', action: 'live', metadata: { displayName: 'Sin login' } },
      ),
    ).toEqual({ to: '/war-room' })
  })

  it('navega fichas, documentos y calendario', () => {
    expect(
      resolveActivityNavigation(
        { entityType: 'event_ficha', entityId: 'f1', action: 'updated', metadata: {} },
        controlCtx,
      ),
    ).toEqual({ to: '/control/fichas?ficha=f1' })

    expect(
      resolveActivityNavigation(
        { entityType: 'contract', entityId: 'doc-1', action: 'viewed', metadata: {} },
      ),
    ).toEqual({ to: '/documentos?doc=doc-1' })

    expect(
      resolveActivityNavigation(
        { entityType: 'document', action: 'uploaded', metadata: { folderId: 'fld-9' } },
      ),
    ).toEqual({ to: '/documentos?folder=fld-9' })

    expect(
      resolveActivityNavigation(
        { entityType: 'calendar', entityId: 'evt-1', action: 'created', metadata: {} },
      ),
    ).toEqual({ to: '/calendario?event=evt-1' })

    expect(
      resolveActivityNavigation(
        { entityType: 'crm', entityId: 'deal-1', action: 'saved', metadata: {} },
      ),
    ).toEqual({ to: '/crm?deal=deal-1' })

    expect(
      resolveActivityNavigation(
        { entityType: 'brief', entityId: 'brief-1', action: 'created', metadata: {} },
      ),
    ).toEqual({ to: '/diseno/briefs?brief=brief-1' })

    expect(
      resolveActivityNavigation(
        { entityType: 'wiki', entityId: 'page-1', action: 'updated', metadata: {} },
      ),
    ).toEqual({ to: '/wiki?page=page-1' })
  })

  it('respeta ruta explícita en metadata', () => {
    expect(
      resolveActivityNavigation(
        { entityType: 'custom', action: 'x', metadata: { route: '/diseno/huecos' } },
      ),
    ).toEqual({ to: '/diseno/huecos' })
  })

  it('no navega sesión ni ML sin permisos', () => {
    expect(
      resolveActivityNavigation({ entityType: 'session', action: 'login', metadata: {} }),
    ).toBeNull()
    expect(
      resolveActivityNavigation(
        { entityType: 'ml', action: 'models_trained', metadata: {} },
        basicCtx,
      ),
    ).toBeNull()
  })

  it('navega anomalías ML al perfil del talento', () => {
    expect(
      resolveActivityNavigation(
        {
          entityType: 'ml',
          entityId: 'nosomevt',
          action: 'anomaly_detected',
          metadata: { displayName: 'Nosome' },
        },
        controlCtx,
      ),
    ).toEqual({ to: '/talento/nosomevt' })
  })
})

describe('isActivityNavigable', () => {
  it('refleja si hay destino', () => {
    expect(
      isActivityNavigable({ entityType: 'task', entityId: 'x', action: 'created', metadata: {} }, controlCtx),
    ).toBe(true)
    expect(isActivityNavigable({ entityType: 'auth', action: 'logout', metadata: {} })).toBe(false)
  })
})
