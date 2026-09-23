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

/**
 * Fail closed: authorize URL must carry our loopback redirect_to.
 * Also strip skip_http_redirect so Twitch/GoTrue do not see a client-only flag.
 */
export function prepareDesktopAuthorizeUrl(
  authorizeUrl: string,
  expectedRedirectTo: string,
): string {
  const redirectParam = readAuthorizeRedirectTo(authorizeUrl)
  if (!redirectParam) {
    throw new Error(
      `La URL de autorización no incluye el retorno local (${expectedRedirectTo}). ` +
        'No se abrió el navegador. Cierra pestañas de Neura Awards, deja una sola ventana de NeuraGest e inténtalo de nuevo.',
    )
  }
  if (!redirectParam.startsWith(expectedRedirectTo)) {
    throw new Error(
      `La URL de autorización no usa el retorno local esperado (${expectedRedirectTo}). ` +
        'GoTrue redirigiría al Site URL (Awards). No se abrió el navegador.',
    )
  }

  const cleaned = new URL(authorizeUrl)
  cleaned.searchParams.delete('skip_http_redirect')
  return cleaned.toString()
}
