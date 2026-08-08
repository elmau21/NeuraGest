import { describe, expect, it } from 'vitest'
import { formatActivityLabel, resolveActorLogin, resolveActorName } from './activity-format'

describe('resolveActorName', () => {
  it('prioriza display_name del join', () => {
    expect(
      resolveActorName(
        { display_name: 'MauFuwari', twitch_login: 'maufuwari' },
        { actorName: 'Otro' },
      ),
    ).toBe('MauFuwari')
  })

  it('usa login Twitch si no hay display_name', () => {
    expect(resolveActorName({ display_name: null, twitch_login: 'porrinskyvt' })).toBe(
      'porrinskyvt',
    )
  })

  it('cae a metadata si no hay join', () => {
    expect(resolveActorName(null, { actorName: 'Nosome' })).toBe('Nosome')
  })
})

describe('resolveActorLogin', () => {
  it('lee twitch_login del directorio', () => {
    expect(resolveActorLogin({ display_name: 'Ana', twitch_login: 'ana_live' })).toBe('ana_live')
  })

  it('cae a metadata', () => {
    expect(resolveActorLogin(null, { actorLogin: 'guest' })).toBe('guest')
  })
})

describe('formatActivityLabel', () => {
  it('incluye quién abrió el contrato', () => {
    expect(
      formatActivityLabel('contract', 'viewed', { fileName: 'a.pdf' }, 'MauFuwari'),
    ).toBe('MauFuwari abrió el contrato «a.pdf»')
  })

  it('incluye quién descargó / borró / subió', () => {
    expect(
      formatActivityLabel('contract', 'downloaded', { title: 'Contrato X' }, 'Ana'),
    ).toBe('Ana descargó el contrato «Contrato X»')
    expect(
      formatActivityLabel('contract', 'deleted', { fileName: 'b.pdf' }, 'Luis'),
    ).toBe('Luis borró el contrato «b.pdf»')
    expect(
      formatActivityLabel('contract', 'uploaded', { fileName: 'c.pdf' }, 'Sara'),
    ).toBe('Sara subió el contrato «c.pdf»')
  })

  it('usa Alguien si no hay actor', () => {
    expect(formatActivityLabel('contract', 'viewed', { fileName: 'z.pdf' })).toBe(
      'Alguien abrió el contrato «z.pdf»',
    )
  })

  it('formatea tareas, wiki, sesión y CRM', () => {
    expect(formatActivityLabel('task', 'created', { title: 'Brief' }, 'Ana')).toBe(
      'Ana creó la tarea «Brief»',
    )
    expect(formatActivityLabel('task', 'completed', { title: 'Brief' }, 'Ana')).toBe(
      'Ana completó la tarea «Brief»',
    )
    expect(formatActivityLabel('wiki', 'created', { title: 'SOPs' }, 'Luis')).toBe(
      'Luis creó la wiki «SOPs»',
    )
    expect(formatActivityLabel('wiki', 'updated', { title: 'SOPs' }, 'Luis')).toBe(
      'Luis editó la wiki «SOPs»',
    )
    expect(formatActivityLabel('session', 'login', {}, 'Mau')).toBe(
      'Mau inició sesión en NeuraGest',
    )
    expect(formatActivityLabel('crm', 'saved', { brandName: 'Red Bull' }, 'Sara')).toBe(
      'Sara guardó el deal «Red Bull»',
    )
    expect(formatActivityLabel('handoff', 'created', { talentLogin: 'nosomevt' }, 'Ana')).toBe(
      'Ana registró un handoff de @nosomevt',
    )
  })
})
