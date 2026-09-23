import { describe, expect, it } from 'vitest'
import { prepareDesktopAuthorizeUrl, readAuthorizeRedirectTo } from './oauth-authorize-url'

const LOOPBACK = 'http://127.0.0.1:14563/auth/callback'

describe('oauth-authorize-url', () => {
  it('lee redirect_to del authorize', () => {
    const url =
      `https://ehxnggopzftiolgapcav.supabase.co/auth/v1/authorize?provider=twitch` +
      `&redirect_to=${encodeURIComponent(LOOPBACK)}`
    expect(readAuthorizeRedirectTo(url)).toBe(LOOPBACK)
  })

  it('falla si falta redirect_to (evitar leak a Site URL)', () => {
    const url =
      'https://ehxnggopzftiolgapcav.supabase.co/auth/v1/authorize?provider=twitch&skip_http_redirect=true'
    expect(() => prepareDesktopAuthorizeUrl(url, LOOPBACK)).toThrow(/no incluye el retorno local/i)
  })

  it('falla si redirect_to es Site URL de Awards', () => {
    const awards = 'https://neuralive.online/es/neura-awards'
    const url =
      `https://ehxnggopzftiolgapcav.supabase.co/auth/v1/authorize?provider=twitch` +
      `&redirect_to=${encodeURIComponent(awards)}`
    expect(() => prepareDesktopAuthorizeUrl(url, LOOPBACK)).toThrow(/no usa el retorno local/i)
  })

  it('exige loopback y quita skip_http_redirect antes de abrir el navegador', () => {
    const url =
      `https://ehxnggopzftiolgapcav.supabase.co/auth/v1/authorize?provider=twitch` +
      `&redirect_to=${encodeURIComponent(LOOPBACK)}&skip_http_redirect=true&code_challenge=abc`
    const cleaned = prepareDesktopAuthorizeUrl(url, LOOPBACK)
    const parsed = new URL(cleaned)
    expect(parsed.searchParams.get('redirect_to')).toBe(LOOPBACK)
    expect(parsed.searchParams.has('skip_http_redirect')).toBe(false)
    expect(parsed.searchParams.get('code_challenge')).toBe('abc')
  })
})
