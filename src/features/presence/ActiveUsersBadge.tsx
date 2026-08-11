import { useEffect, useRef, useState } from 'react'
import { Users, X } from 'lucide-react'
import {
  subscribeOrgPresence,
  type OrgPresenceUser,
} from '@/services/org-presence'
import { useAuthStore } from '@/stores/auth-store'

const PAGE_LABELS: Record<string, string> = {
  '/': 'Dashboard',
  '/control': 'Centro de control',
  '/asistente': 'Centro de control',
  '/war-room': 'War Room',
  '/talentos': 'Talentos',
  '/pipeline': 'Pipeline',
  '/crm': 'CRM',
  '/schedule': 'Schedule',
  '/comisiones': 'Comisiones',
  '/portal': 'Portal',
  '/rate-card': 'Rate Card',
  '/brief': 'Brief',
  '/assets': 'Assets',
  '/diseno': 'Diseño gráfico',
  '/diseno/huecos': 'Huecos de canal',
  '/diseno/briefs': 'Briefs creativos',
  '/neuralleague': 'NeuraLeague',
  '/neuralleague/equipos': 'Equipos NL',
  '/neuralleague/jugadores': 'Jugadores NL',
  '/neuralleague/calendario': 'Calendario NL',
  '/neuralleague/stats': 'Stats NL',
  '/neuralleague/vods': 'VODs NL',
  '/neuralleague/entrenamientos': 'Entrenamientos NL',
  '/neuralleague/reclutamiento': 'Reclutamiento NL',
  '/neuralleague/operacion': 'Operación NL',
  '/handoff': 'Handoff',
  '/media-kit': 'Media Kit',
  '/vod-digest': 'VOD digest',
  '/board-pack': 'Board pack',
  '/onboarding': 'Onboarding',
  '/tareas': 'Tareas',
  '/wiki': 'Wiki',
  '/documentos': 'Documentos',
  '/calendario': 'Calendario',
  '/inteligencia': 'Inteligencia',
  '/ciencia-datos': 'Ciencia de datos',
  '/estadisticas': 'Estadísticas',
  '/analitica': 'Analítica',
  '/auditoria': 'Auditoría',
  '/ajustes': 'Ajustes',
}

function pageLabel(path?: string): string | null {
  if (!path) return null
  if (PAGE_LABELS[path]) return PAGE_LABELS[path]
  if (path.startsWith('/diseno/')) return 'Diseño'
  if (path.startsWith('/neuralleague')) return 'NeuraLeague'
  if (path.startsWith('/talento/')) return 'Perfil de talento'
  if (path.startsWith('/portal/')) return 'Portal'
  if (path.startsWith('/media-kit')) return 'Media Kit'
  return 'NeuraGest'
}

export function ActiveUsersBadge() {
  const selfId = useAuthStore((s) => s.session?.authUserId)
  const [users, setUsers] = useState<OrgPresenceUser[]>([])
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => subscribeOrgPresence(setUsers), [])

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [open])

  const preview = users.slice(0, 4)

  return (
    <div className="presence-badge-wrap" ref={wrapRef}>
      <button
        type="button"
        className={open ? 'active' : ''}
        aria-label="Quién está en NeuraGest"
        title="Quién está en NeuraGest"
        onClick={(event) => {
          event.stopPropagation()
          setOpen((value) => !value)
        }}
      >
        <span className="presence-avatars" aria-hidden>
          {preview.length === 0 ? (
            <Users size={16} />
          ) : (
            preview.map((user) =>
              user.avatarUrl ? (
                <img key={user.userId} src={user.avatarUrl} alt="" />
              ) : (
                <span key={user.userId} className="presence-avatar-fallback">
                  {user.displayName.slice(0, 1).toUpperCase()}
                </span>
              ),
            )
          )}
        </span>
        <span className="presence-count">{users.length}</span>
      </button>
      {open && (
        <div className="presence-popover card" onClick={(event) => event.stopPropagation()}>
          <div className="presence-popover-head">
            <b>En NeuraGest ahora</b>
            <button type="button" className="secondary" onClick={() => setOpen(false)}>
              <X size={14} />
            </button>
          </div>
          <div className="presence-list">
            {users.length === 0 ? (
              <p className="empty-state">Nadie más en NeuraGest por ahora.</p>
            ) : (
              users.map((user) => {
                const where = pageLabel(user.path)
                const isSelf = user.userId === selfId
                return (
                  <div key={user.userId} className="presence-row">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="" />
                    ) : (
                      <span className="presence-avatar-fallback lg">
                        {user.displayName.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <div>
                      <b>
                        {user.displayName}
                        {isSelf ? ' (tú)' : ''}
                      </b>
                      <span>
                        @{user.login}
                        {where ? ` · ${where}` : ''}
                      </span>
                    </div>
                    <i className="presence-dot" title="En línea" />
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
