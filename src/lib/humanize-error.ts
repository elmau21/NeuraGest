/** Convierte errores técnicos de IPC/Tauri en mensajes legibles para la UI. */
export function humanizeInvokeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? 'Error desconocido')
  if (/not allowed by ACL|not allowed on origin|not allowed\.|Command .+ not allowed/i.test(raw)) {
    return 'No se pudo completar la operación de autenticación. Cierra NeuraGest por completo, vuelve a abrirlo e inténtalo de nuevo.'
  }
  if (/connection refused|failed to fetch|networkerror/i.test(raw)) {
    return 'No hay conexión con el servicio. Comprueba tu red e inténtalo de nuevo.'
  }
  return raw
}
