import { useEffect, useRef } from 'react'
import { checkForAppUpdate } from '@/services/updater'
import { isTauri } from '@/services/twitch'
import { useUpdatePromptStore } from '@/stores/update-prompt-store'
import { UpdateAvailableModal } from '@/features/settings/UpdateAvailableModal'

const CHECK_DELAY_MS = 8_000

/**
 * Comprueba actualizaciones en segundo plano al iniciar sesión.
 * Muestra el modal una vez por sesión si hay versión nueva.
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
          useUpdatePromptStore.getState().offer(
            { version: result.version, notes: result.notes },
            { force: false },
          )
        } catch {
          /* silencioso: el panel manual sigue disponible */
        }
      })()
    }, CHECK_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [])

  return <UpdateAvailableModal />
}
