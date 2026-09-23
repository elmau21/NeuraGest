/** Helpers to keep desktop OAuth on the loopback listener, never Site URL. */

export function readAuthorizeRedirectTo(authorizeUrl: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(authorizeUrl)
  } catch {
    return null
  }
  const raw =
    parsed.searchParams.get('redirect_to') ?? parsed.searchParams.get('redirectTo')
  if (!raw) return null
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/** Strip one query flag without re-encoding other params (PKCE code_challenge must stay intact). */
export function stripQueryParam(url: string, key: string): string {
  const q = url.indexOf('?')
  if (q < 0) return url
  const base = url.slice(0, q)
  const query = url.slice(q + 1)
  if (!query) return base
  const kept = query
    .split('&')
    .filter((part) => {
      if (!part) return false
      const eq = part.indexOf('=')
      const name = eq >= 0 ? part.slice(0, eq) : part
      return decodeURIComponent(name) !== key
    })
  return kept.length > 0 ? `${base}?${kept.join('&')}` : base
}

/**
 * Fail closed: authorize URL must carry our loopback redirect_to.
 * Strip skip_http_redirect without re-serializing the query (Windows/shell and
 * URLSearchParams have both mangled PKCE code_challenge in the wild).
 */
export function prepareDesktopAuthorizeUrl(
  authorizeUrl: string,
  expectedRedirectTo: string,
): string {
  const redirectParam = readAuthorizeRedirectTo(authorizeUrl)
  if (!redirectParam) {
    throw new Error(
      `La URL de autorización no incluye el retorno local (${expectedRedirectTo}). ` +
        'No se abrió la ventana de acceso. Cierra pestañas de Neura Awards, deja una sola ventana de NeuraGest e inténtalo de nuevo.',
    )
  }
  if (!redirectParam.startsWith(expectedRedirectTo)) {
    throw new Error(
      `La URL de autorización no usa el retorno local esperado (${expectedRedirectTo}). ` +
        'GoTrue redirigiría al Site URL (Awards). No se abrió la ventana de acceso.',
    )
  }

  const cleaned = stripQueryParam(authorizeUrl, 'skip_http_redirect')
  let parsed: URL
  try {
    parsed = new URL(cleaned)
  } catch {
    throw new Error('La URL de autorización de Twitch no es válida.')
  }
  const challenge = parsed.searchParams.get('code_challenge')
  if (challenge !== null && (challenge.length < 43 || challenge.length > 128)) {
    throw new Error(
      'El desafío PKCE de la URL de autorización está corrupto. ' +
        'No se abrió la ventana de acceso. Reintenta desde NeuraGest (no uses el navegador a mano).',
    )
  }
  return cleaned
}
