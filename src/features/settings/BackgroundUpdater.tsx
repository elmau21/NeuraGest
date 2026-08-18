import { useEffect, useRef } from 'react'
import { useToastStore } from '@/stores/toast-store'
import { checkForAppUpdate } from '@/services/updater'
import { isTauri } from '@/services/twitch'

const CHECK_DELAY_MS = 8_000
const SESSION_KEY = 'neuragest-update-toast-shown'

/**
 * Comprueba actualizaciones en segundo plano al iniciar sesión.
 * Muestra un aviso una vez por sesión si hay versión nueva.
 */
export function BackgroundUpdater() {
  const checked = useRef(false)

  useEffect(() => {
    if (!isTauri || checked.current) return
    checked.current = true

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await checkForAppUpdate()
          if (result.status !== 'available') return
          if (sessionStorage.getItem(SESSION_KEY) === result.version) return
          sessionStorage.setItem(SESSION_KEY, result.version)
          useToastStore.getState().push(
            `Hay una actualización disponible (v${result.version}). Ve a Ajustes → Actualizaciones para instalarla.`,
            'info',
            12_000,
          )
        } catch {
          /* silencioso: el panel manual sigue disponible */
        }
      })()
    }, CHECK_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [])

  return null
}
