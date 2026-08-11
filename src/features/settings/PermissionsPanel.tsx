import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw, Shield, UserRound } from 'lucide-react'
import {
  ALL_APP_ROLES,
  type AppRole,
  type AppUserRecord,
  listAppUsers,
  setAppUserRoles,
} from '@/services/app-users'
import { logRoleActivity } from '@/services/audit'
import { useAuthStore } from '@/stores/auth-store'

function roleLabel(role: AppRole): string {
  const labels: Record<AppRole, string> = {
    owner: 'Owner',
    admin: 'Admin',
    manager: 'Manager',
    staff: 'Staff',
    dev: 'Dev',
    designer: 'Diseñador',
    league_manager: 'Manager Liga',
    coach: 'Coach',
    analyst: 'Analyst',
    player: 'Jugador',
  }
  return labels[role]
}

export function PermissionsPanel() {
  const session = useAuthStore((s) => s.session)
  const [users, setUsers] = useState<AppUserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setUsers(await listAppUsers())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const toggleRole = async (user: AppUserRecord, role: AppRole) => {
    const hasRole = user.roles.includes(role)
    const nextRoles = hasRole
      ? user.roles.filter((item) => item !== role)
      : [...user.roles, role]

    const isProtected = user.twitchLogin.toLowerCase() === 'maufuwari'
    const losingAdmin = isProtected && hasRole && (role === 'owner' || role === 'dev')
    let confirmProtected = false
    if (losingAdmin) {
      const ok = window.confirm(
        'MauFuwari perderá privilegios owner/dev. ¿Confirmas esta degradación?',
      )
      if (!ok) return
      confirmProtected = true
    }

    setBusyUserId(user.id)
    setError(null)
    try {
      const updated = await setAppUserRoles(user.id, nextRoles, confirmProtected)
      setUsers((current) =>
        current.map((item) => (item.id === user.id ? { ...item, roles: updated } : item)),
      )
      void logRoleActivity(user.twitchLogin, updated, user.roles)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyUserId(null)
    }
  }

  return (
    <div className="permissions-panel">
      <div className="permissions-head">
        <div>
          <h3><Shield size={16}/> Administración de permisos</h3>
          <p>Gestiona roles owner, dev, admin, manager, staff y diseñador para cuentas Twitch registradas.</p>
        </div>
        <button className="secondary" disabled={loading} onClick={() => void load()}>
          <RefreshCw size={14}/> Actualizar
        </button>
      </div>

      {error && <p className="integration-note permissions-error"><AlertTriangle size={13}/> {error}</p>}

      {loading ? (
        <p className="empty-state">Cargando usuarios…</p>
      ) : users.length === 0 ? (
        <div className="permissions-empty">
          <UserRound size={28}/>
          <b>Aún no hay otros usuarios registrados</b>
          <p>Cuando alguien inicie sesión con Twitch en NeuraGest, aparecerá aquí automáticamente. Puedes asignarle roles desde esta pantalla.</p>
          <small>Sesión actual: @{session?.login ?? '—'}</small>
        </div>
      ) : (
        <div className="permissions-table">
          <div className="permissions-table-head">
            <span>Usuario</span>
            <span>Roles</span>
            <span>Última sesión</span>
          </div>
          {users.map((user) => (
            <div className="permissions-row" key={user.id}>
              <div className="permissions-user">
                {user.avatarUrl
                  ? <img src={user.avatarUrl} alt="" />
                  : <div className="avatar-placeholder">{(user.displayName ?? user.twitchLogin).slice(0, 2).toUpperCase()}</div>}
                <div>
                  <b>{user.displayName ?? user.twitchLogin}</b>
                  <span>@{user.twitchLogin}</span>
                </div>
              </div>
              <div className="permissions-roles">
                {ALL_APP_ROLES.map((role) => {
                  const active = user.roles.includes(role)
                  return (
                    <button
                      key={role}
                      className={`role-chip ${active ? 'active' : ''}`}
                      disabled={busyUserId === user.id}
                      onClick={() => void toggleRole(user, role)}
                      title={active ? `Quitar ${roleLabel(role)}` : `Asignar ${roleLabel(role)}`}
                    >
                      {roleLabel(role)}
                    </button>
                  )
                })}
              </div>
              <span className="permissions-seen">
                {new Date(user.lastSeenAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
