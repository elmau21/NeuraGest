import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Loader2, RefreshCw, Shield, UserRound } from '@/components/icons'
import {
  ALL_APP_ROLES,
  type AppRole,
  type AppUserRecord,
  listAppUsers,
  setAppUserRoles,
} from '@/services/app-users'
import { logRoleActivity } from '@/services/audit'
import {
  canAssignDevRole,
  canAssignOwnerRole,
  canAssignStrongRoles,
  STRONG_APP_ROLES,
} from '@/services/permissions'
import { useAuthStore } from '@/stores/auth-store'
import { toastError, toastSuccess } from '@/stores/toast-store'

function roleLabel(role: AppRole): string {
  const labels: Record<AppRole, string> = {
    owner: 'Owner',
    admin: 'Admin',
    manager: 'Manager',
    staff: 'Staff',
    assistant: 'Asistente',
    dev: 'Dev',
    designer: 'Diseñador',
    league_manager: 'Manager Liga',
    coach: 'Coach',
    analyst: 'Analyst',
    player: 'Jugador',
  }
  return labels[role]
}

function userInitials(user: Pick<AppUserRecord, 'displayName' | 'twitchLogin'>): string {
  const source = user.displayName?.trim() || user.twitchLogin
  return source.slice(0, 2).toUpperCase()
}

function UserProfile({ user }: { user: AppUserRecord }) {
  return (
    <div className="settings-profile-chip permissions-user-profile">
      <div className="settings-profile-chip-avatar" aria-hidden>
        {user.avatarUrl
          ? <img src={user.avatarUrl} alt="" />
          : <span>{userInitials(user)}</span>}
      </div>
      <div className="settings-profile-chip-info">
        <b>{user.displayName ?? user.twitchLogin}</b>
        <span>@{user.twitchLogin}</span>
      </div>
    </div>
  )
}

type PermissionsPanelProps = {
  /** Si true, oculta el encabezado largo (útil en Centro de control). */
  compact?: boolean
  /** Filtra chips visibles (p. ej. sin owner). */
  hideRoles?: AppRole[]
}

export function PermissionsPanel({ compact = false, hideRoles = [] }: PermissionsPanelProps) {
  const session = useAuthStore((s) => s.session)
  const actorRoles = useAuthStore((s) => s.roles)
  const canStrong = canAssignStrongRoles(actorRoles, session?.login)
  const canAssignOwner = canAssignOwnerRole(actorRoles, session?.login)
  const canAssignDev = canAssignDevRole(actorRoles, session?.login)
  const [users, setUsers] = useState<AppUserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)

  const autoHideStrong = canStrong ? [] : STRONG_APP_ROLES
  const visibleRoles = ALL_APP_ROLES.filter(
    (role) => !hideRoles.includes(role) && !autoHideStrong.includes(role),
  )

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

    if (role === 'owner' && !canAssignOwner) {
      toastError('Solo un owner puede asignar o quitar el rol Owner')
      return
    }
    if (role === 'dev' && !canAssignDev) {
      toastError('Solo un owner o dev puede asignar o quitar el rol Dev')
      return
    }

    const isProtected = user.twitchLogin.toLowerCase() === 'maufuwari'
    const losingAdmin = isProtected && hasRole && (role === 'owner' || role === 'dev')
    let confirmProtected = false
    if (losingAdmin) {
      if (!canAssignOwner && role === 'owner') {
        toastError('No puedes degradar el owner de MauFuwari')
        return
      }
      if (!canStrong) {
        toastError('No puedes degradar roles owner/dev de MauFuwari')
        return
      }
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
      toastSuccess(`Roles de @${user.twitchLogin} actualizados`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      toastError(message)
    } finally {
      setBusyUserId(null)
    }
  }

  const rootClass = [
    'permissions-panel',
    compact ? 'permissions-panel-compact' : 'card settings-panel-card',
  ].join(' ')

  return (
    <div className={rootClass}>
      {!compact && (
        <div className="settings-panel-head permissions-panel-head">
          <div>
            <h3><Shield size={16} strokeWidth={1.6} /> Administración de permisos</h3>
            <p>Gestiona roles (Owner, Asistente, Manager, Staff, Diseño, Liga…) para cuentas Twitch registradas.</p>
          </div>
          <button type="button" className="secondary" disabled={loading} onClick={() => void load()}>
            <RefreshCw size={14} /> Actualizar
          </button>
        </div>
      )}
      {compact && (
        <div className="permissions-toolbar">
          <button type="button" className="secondary" disabled={loading} onClick={() => void load()}>
            <RefreshCw size={14} /> Actualizar
          </button>
        </div>
      )}

      {error && <p className="integration-note permissions-error"><AlertTriangle size={13} /> {error}</p>}

      {loading ? (
        <p className="permissions-loading">
          <Loader2 size={14} className="spinning" aria-hidden /> Cargando usuarios…
        </p>
      ) : users.length === 0 ? (
        <div className="permissions-empty">
          <UserRound size={28} strokeWidth={1.6} />
          <b>Aún no hay otros usuarios registrados</b>
          <p>Cuando alguien inicie sesión con Twitch en NeuraGest, aparecerá aquí automáticamente. Puedes asignarle roles desde esta pantalla.</p>
          <small>Sesión actual: @{session?.login ?? '—'}</small>
        </div>
      ) : (
        <div className="permissions-list">
          <div className="permissions-list-head" aria-hidden>
            <span>Usuario</span>
            <span>Roles</span>
            <span>Última sesión</span>
          </div>
          {users.map((user) => (
            <article className="permissions-user-row" key={user.id}>
              <div className="permissions-user-col">
                <UserProfile user={user} />
              </div>
              <div className="permissions-roles-col">
                <span className="permissions-col-label">Roles</span>
                <div className="permissions-roles">
                  {visibleRoles.map((role) => {
                    const active = user.roles.includes(role)
                    const ownerLocked = role === 'owner' && !canAssignOwner
                    const devLocked = role === 'dev' && !canAssignDev
                    const strongLocked = ownerLocked || devLocked
                    return (
                      <button
                        type="button"
                        key={role}
                        className={`permissions-role-chip${active ? ' active' : ''}${strongLocked ? ' locked' : ''}`}
                        disabled={busyUserId === user.id || strongLocked}
                        onClick={() => void toggleRole(user, role)}
                        title={
                          ownerLocked
                            ? 'Solo un owner puede gestionar este rol'
                            : devLocked
                              ? 'Solo un owner o dev puede gestionar este rol'
                              : active
                                ? `Quitar ${roleLabel(role)}`
                                : `Asignar ${roleLabel(role)}`
                        }
                      >
                        {roleLabel(role)}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="permissions-seen-col">
                <span className="permissions-col-label">Última sesión</span>
                <time className="permissions-seen" dateTime={user.lastSeenAt}>
                  {new Date(user.lastSeenAt).toLocaleString('es-MX', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </time>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
