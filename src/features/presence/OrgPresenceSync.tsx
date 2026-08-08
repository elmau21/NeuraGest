import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { clearOrgPresence, trackOrgPresence } from '@/services/org-presence'
import { useAuthStore } from '@/stores/auth-store'

/**
 * Publica presencia del usuario autenticado en el canal de la org.
 * Limpieza al logout / sesión no autenticada (no en unmount por Strict Mode).
 */
export function OrgPresenceSync() {
  const location = useLocation()
  const session = useAuthStore((s) => s.session)
  const status = useAuthStore((s) => s.status)
  const pathTimer = useRef<number | null>(null)

  useEffect(() => {
    if (status !== 'authenticated' || !session) {
      void clearOrgPresence()
      return
    }

    if (pathTimer.current) window.clearTimeout(pathTimer.current)
    pathTimer.current = window.setTimeout(() => {
      void trackOrgPresence({
        userId: session.authUserId,
        login: session.login,
        displayName: session.displayName,
        avatarUrl: session.avatarUrl,
        path: location.pathname,
      })
    }, 300)

    return () => {
      if (pathTimer.current) window.clearTimeout(pathTimer.current)
    }
  }, [status, session, location.pathname])

  return null
}
