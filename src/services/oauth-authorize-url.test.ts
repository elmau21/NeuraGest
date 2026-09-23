import { describe, expect, it } from 'vitest'
import {
  prepareDesktopAuthorizeUrl,
  readAuthorizeRedirectTo,
  stripQueryParam,
} from './oauth-authorize-url'

const LOOPBACK = 'http://127.0.0.1:14563/auth/callback'
const VALID_CHALLENGE = 'a'.repeat(43)

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

  it('exige loopback, quita skip_http_redirect y conserva code_challenge sin re-encode', () => {
    const challenge = `${VALID_CHALLENGE}-_.~`
    const url =
      `https://ehxnggopzftiolgapcav.supabase.co/auth/v1/authorize?provider=twitch` +
      `&redirect_to=${encodeURIComponent(LOOPBACK)}&skip_http_redirect=true&code_challenge=${challenge}`
    const cleaned = prepareDesktopAuthorizeUrl(url, LOOPBACK)
    expect(cleaned).toContain(`code_challenge=${challenge}`)
    expect(cleaned).not.toMatch(/skip_http_redirect/)
    expect(readAuthorizeRedirectTo(cleaned)).toBe(LOOPBACK)
  })

  it('falla si code_challenge está truncado', () => {
    const url =
      `https://ehxnggopzftiolgapcav.supabase.co/auth/v1/authorize?provider=twitch` +
      `&redirect_to=${encodeURIComponent(LOOPBACK)}&code_challenge=abc`
    expect(() => prepareDesktopAuthorizeUrl(url, LOOPBACK)).toThrow(/pkce|corrupto/i)
  })

  it('stripQueryParam no altera el resto de la query', () => {
    const url = `https://example.com/a?x=1&skip_http_redirect=true&y=2%2B3`
    expect(stripQueryParam(url, 'skip_http_redirect')).toBe('https://example.com/a?x=1&y=2%2B3')
  })
})
