import { describe, expect, it } from 'vitest'
import { humanizeInvokeError } from './humanize-error'

describe('humanizeInvokeError', () => {
  it('oculta mensajes ACL técnicos', () => {
    expect(humanizeInvokeError(new Error('Command wait_oauth_callback not allowed by ACL'))).toMatch(
      /autenticación|vuelve a abrirlo/i,
    )
  })

  it('deja pasar mensajes de negocio', () => {
    expect(humanizeInvokeError(new Error('Twitch no devolvió el código de autorización.'))).toBe(
      'Twitch no devolvió el código de autorización.',
    )
  })

  it('conserva la pista de puerto ocupado / otras ventanas', () => {
    const msg =
      'No se pudo preparar el retorno de inicio de sesión en 127.0.0.1:14563: el puerto está ocupado. Cierra otras ventanas de NeuraGest'
    expect(humanizeInvokeError(new Error(msg))).toContain('Cierra otras ventanas')
  })
})
