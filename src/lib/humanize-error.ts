/** Convierte errores técnicos de IPC/Tauri en mensajes legibles para la UI. */
export function humanizeInvokeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? 'Error desconocido')
  if (/not allowed by ACL|not allowed on origin|not allowed\.|Command .+ not allowed/i.test(raw)) {
    return 'No se pudo completar la operación de autenticación. Cierra NeuraGest por completo, vuelve a abrirlo e inténtalo de nuevo.'
  }
  if (/connection refused|failed to fetch|networkerror/i.test(raw)) {
    return 'No hay conexión con el servicio. Comprueba tu red e inténtalo de nuevo.'
  }
  if (/puerto está ocupado|os error 10048|addrinuse|address already in use/i.test(raw)) {
    return raw.includes('Cierra otras ventanas')
      ? raw
      : `${raw} Cierra otras ventanas de NeuraGest e inténtalo de nuevo.`
  }
  if (/bad_oauth_state|oauth state not found|enlace de acceso ya no es válido|retorno local|site url/i.test(raw)) {
    return (
      raw +
      (raw.includes('Neura Awards')
        ? ''
        : ' Cierra pestañas de Neura Awards, usa una sola ventana de NeuraGest e inténtalo de nuevo.')
    )
  }
  return raw
}
