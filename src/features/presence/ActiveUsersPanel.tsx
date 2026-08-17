import { useEffect, useState } from 'react'
import { Users } from '@/components/icons'
import {
  subscribeOrgPresence,
  type OrgPresenceUser,
} from '@/services/org-presence'

/** Panel compacto para Dashboard / War Room. */
export function ActiveUsersPanel({ compact = false }: { compact?: boolean }) {
  const [users, setUsers] = useState<OrgPresenceUser[]>([])

  useEffect(() => subscribeOrgPresence(setUsers), [])

  if (compact) {
    return (
      <div className="card presence-panel-compact">
        <span>En NeuraGest ahora</span>
        <b>{users.length}</b>
      </div>
    )
  }

  return (
    <div className="card presence-panel">
      <div className="presence-panel-head">
        <Users size={16} />
        <div>
          <b>En NeuraGest ahora</b>
          <span>{users.length} {users.length === 1 ? 'persona' : 'personas'}</span>
        </div>
      </div>
      <div className="presence-panel-avatars">
        {users.length === 0 ? (
          <p className="empty-state">Nadie más conectado.</p>
        ) : (
          users.map((user) => (
            <div key={user.userId} className="presence-chip" title={`@${user.login}`}>
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" />
              ) : (
                <span>{user.displayName.slice(0, 2).toUpperCase()}</span>
              )}
              <em>{user.displayName}</em>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
