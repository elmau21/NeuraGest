import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { getDiscordSettings } from '@/services/settings'
import { applyDiscordPresence } from '@/services/discord-presence'
import { isTauri } from '@/services/twitch'

const BOOT_RETRY_DELAYS_MS = [0, 1500, 4000, 8000] as const

/**
 * Sincroniza el estado en Discord con la ruta actual.
 * - Arranque: sync inmediato + reintentos si Discord aún no responde.
 * - Navegación: debounce 800ms (sin spam).
 * - No limpia Presence al desmontar (Strict Mode / HMR borraba el estado por carrera).
 *   El cierre real lo hace Rust en RunEvent::Exit.
 */
export function DiscordPresenceSync() {
  const location = useLocation()
  const pathTimer = useRef<number | null>(null)
  const lastKey = useRef<string>('')
  const bootGen = useRef(0)

  // Arranque: conectar Presence cuanto antes
  useEffect(() => {
    if (!isTauri) return
    const gen = ++bootGen.current
    let cancelled = false

    const boot = async () => {
      try {
        const settings = await getDiscordSettings()
        if (cancelled || gen !== bootGen.current) return

        if (!settings.presenceEnabled) {
          lastKey.current = 'off'
          await applyDiscordPresence(settings)
          return
        }

        for (const delay of BOOT_RETRY_DELAYS_MS) {
          if (delay > 0) await new Promise((r) => window.setTimeout(r, delay))
          if (cancelled || gen !== bootGen.current) return
          const status = await applyDiscordPresence(settings, window.location.pathname)
          lastKey.current = `${window.location.pathname}|${settings.presenceDetails}|${settings.presenceState}|${settings.presenceShowPage}|${settings.presenceApplicationId}|${settings.presenceUseLargeImage}|${settings.presenceUseSmallImage}|${settings.presenceButtonUrl}`
          if (status.connected) break
        }
      } catch (error) {
        console.warn('[DiscordPresenceSync] boot', error)
      }
    }

    void boot()
    return () => {
      cancelled = true
      // No clear: en Strict Mode el cleanup del primer mount ganaba la carrera
      // al set_presence del remount y dejaba Discord sin NeuraGest.
    }
  }, [])

  // Cambios de ruta / settings efectivas vía pathname
  useEffect(() => {
    if (!isTauri) return

    if (pathTimer.current) window.clearTimeout(pathTimer.current)
    pathTimer.current = window.setTimeout(() => {
      void (async () => {
        try {
          const settings = await getDiscordSettings()
          if (!settings.presenceEnabled) {
            if (lastKey.current !== 'off') {
              lastKey.current = 'off'
              await applyDiscordPresence(settings)
            }
            return
          }
          const key = `${location.pathname}|${settings.presenceDetails}|${settings.presenceState}|${settings.presenceShowPage}|${settings.presenceApplicationId}|${settings.presenceUseLargeImage}|${settings.presenceUseSmallImage}|${settings.presenceButtonUrl}`
          if (key === lastKey.current) return
          lastKey.current = key
          await applyDiscordPresence(settings, location.pathname)
        } catch (error) {
          console.warn('[DiscordPresenceSync] path', error)
        }
      })()
    }, 800)

    return () => {
      if (pathTimer.current) window.clearTimeout(pathTimer.current)
    }
  }, [location.pathname])

  return null
}
