import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link2, Loader2, UserCog, Users } from '@/components/icons'
import { listAppUsers, type AppUserRecord } from '@/services/app-users'
import {
  assignOwnerAssistant,
  assignedAssistantIds,
  fetchOwnerAssistantLinks,
  unassignOwnerAssistant,
  type OwnerAssistantLink,
} from '@/services/ops-owner-assistant'
import { isTauri } from '@/services/twitch'
import { useAuthStore } from '@/stores/auth-store'
import { toastError, toastSuccess } from '@/stores/toast-store'

type OwnerAssistantPanelProps = {
  /** Oculta encabezado (Centro de control). */
  compact?: boolean
  /** Tras guardar o quitar vínculo. */
  onLinkChange?: () => void
}

function canConfigurePairing(roles: string[], login?: string | null): boolean {
  if (login?.toLowerCase() === 'maufuwari') return true
  return roles.includes('owner') || roles.includes('admin')
}

function userInitials(user: Pick<AppUserRecord, 'displayName' | 'twitchLogin'>): string {
  const source = user.displayName?.trim() || user.twitchLogin
  return source.slice(0, 2).toUpperCase()
}

function ProfileChip({
  user,
  badge,
}: {
  user: AppUserRecord
  badge?: string
}) {
  return (
    <div className="settings-profile-chip">
      <div className="settings-profile-chip-avatar" aria-hidden>
        {user.avatarUrl
          ? <img src={user.avatarUrl} alt="" />
          : <span>{userInitials(user)}</span>}
      </div>
      <div className="settings-profile-chip-info">
        <b>{user.displayName?.trim() || user.twitchLogin}</b>
        <span>@{user.twitchLogin}</span>
      </div>
      {badge ? <span className="settings-profile-chip-badge">{badge}</span> : null}
    </div>
  )
}

export function OwnerAssistantPanel({ compact = false, onLinkChange }: OwnerAssistantPanelProps) {
  const session = useAuthStore((s) => s.session)
  const roles = useAuthStore((s) => s.roles)
  const authUserId = session?.authUserId ?? ''
  const isOwner = roles.includes('owner')
  const isAdmin = roles.includes('admin')
  const canConfigure = canConfigurePairing(roles, session?.login)

  const [links, setLinks] = useState<OwnerAssistantLink[]>([])
  const [users, setUsers] = useState<AppUserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [selectedOwnerId, setSelectedOwnerId] = useState('')
  const [selectedAssistantId, setSelectedAssistantId] = useState('')

  const load = useCallback(async () => {
    if (!isTauri) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [linkRows, userRows] = await Promise.all([fetchOwnerAssistantLinks(), listAppUsers()])
      setLinks(linkRows)
      setUsers(userRows)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const ownerUsers = useMemo(
    () => users.filter((u) => u.authUserId && u.roles.includes('owner')),
    [users],
  )

  const assistantUsers = useMemo(
    () => users.filter((u) => u.authUserId && u.roles.includes('assistant')),
    [users],
  )

  const activeOwnerId = useMemo(() => {
    if (isOwner && authUserId) return authUserId
    if (selectedOwnerId) return selectedOwnerId
    return ownerUsers[0]?.authUserId ?? ''
  }, [isOwner, authUserId, selectedOwnerId, ownerUsers])

  const currentLink = useMemo(
    () => links.find((l) => l.ownerUserId === activeOwnerId) ?? null,
    [links, activeOwnerId],
  )

  const linkedAssistant = useMemo(
    () => assistantUsers.find((u) => u.authUserId === currentLink?.assistantUserId) ?? null,
    [assistantUsers, currentLink],
  )

  const takenAssistantIds = useMemo(
    () => assignedAssistantIds(links, activeOwnerId || undefined),
    [links, activeOwnerId],
  )

  const availableAssistants = useMemo(
    () =>
      assistantUsers.filter(
        (u) => u.authUserId && !takenAssistantIds.has(u.authUserId),
      ),
    [assistantUsers, takenAssistantIds],
  )

  const selectableAssistants = useMemo(
    () =>
      availableAssistants.filter(
        (u) => u.authUserId !== currentLink?.assistantUserId,
      ),
    [availableAssistants, currentLink],
  )

  const assistantOptions = currentLink ? selectableAssistants : availableAssistants

  useEffect(() => {
    if (currentLink) {
      setSelectedAssistantId('')
    } else {
      setSelectedAssistantId(availableAssistants[0]?.authUserId ?? '')
    }
  }, [currentLink, availableAssistants])

  useEffect(() => {
    if (isOwner && authUserId) setSelectedOwnerId(authUserId)
  }, [isOwner, authUserId])

  const myLinkAsAssistant = useMemo(
    () => links.find((l) => l.assistantUserId === authUserId) ?? null,
    [links, authUserId],
  )

  const myOwnerUser = useMemo(
    () => users.find((u) => u.authUserId === myLinkAsAssistant?.ownerUserId) ?? null,
    [users, myLinkAsAssistant],
  )

  const save = async () => {
    if (!activeOwnerId || !selectedAssistantId) {
      toastError('Elige owner y asistente.')
      return
    }
    const owner = ownerUsers.find((u) => u.authUserId === activeOwnerId)
    const assistant = assistantUsers.find((u) => u.authUserId === selectedAssistantId)
    if (!owner?.authUserId || !assistant?.authUserId) {
      toastError('No se encontraron los usuarios seleccionados.')
      return
    }
    setBusy(true)
    try {
      const row = await assignOwnerAssistant({
        ownerUserId: owner.authUserId,
        ownerLogin: owner.twitchLogin,
        assistantUserId: assistant.authUserId,
        assistantLogin: assistant.twitchLogin,
      })
      if (!row) {
        toastError('No se pudo guardar la asignación. ¿El asistente ya está vinculado a otro owner?')
        return
      }
      toastSuccess(`Asistente @${row.assistantLogin} vinculado a @${row.ownerLogin}.`)
      await load()
      onLinkChange?.()
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!activeOwnerId) return
    setBusy(true)
    try {
      const ok = await unassignOwnerAssistant(activeOwnerId)
      if (!ok) {
        toastError('No se pudo quitar la asignación.')
        return
      }
      toastSuccess('Asignación eliminada.')
      setSelectedAssistantId('')
      await load()
      onLinkChange?.()
    } finally {
      setBusy(false)
    }
  }

  if (!isTauri) {
    return (
      <div className="card settings-panel-card owner-assistant-panel">
        <p className="integration-note settings-panel-note">
          La asignación owner ↔ asistente requiere la app de escritorio.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={`card settings-panel-card owner-assistant-panel${compact ? ' compact' : ''}`}>
        <p className="owner-assistant-loading">
          <Loader2 size={14} className="spinning" aria-hidden /> Cargando vínculos…
        </p>
      </div>
    )
  }

  if (!canConfigure && myLinkAsAssistant) {
    return (
      <div className={`card settings-panel-card owner-assistant-panel readonly${compact ? ' compact' : ''}`}>
        {!compact && (
          <div className="settings-panel-head">
            <div>
              <h3><UserCog size={16} strokeWidth={1.6} /> Tu owner</h3>
              <p>Las notas del día de este owner aparecen en Centro de control.</p>
            </div>
          </div>
        )}
        {myOwnerUser ? (
          <ProfileChip user={myOwnerUser} badge="Owner" />
        ) : (
          <p className="owner-assistant-current">
            <Link2 size={14} strokeWidth={1.6} />
            Tu owner: <b>@{myLinkAsAssistant.ownerLogin}</b>
          </p>
        )}
      </div>
    )
  }

  if (!canConfigure) return null

  return (
    <div className={`card settings-panel-card owner-assistant-panel${compact ? ' compact' : ''}`}>
      {!compact && (
        <div className="settings-panel-head">
          <div>
            <h3><UserCog size={16} strokeWidth={1.6} /> Owner ↔ Asistente</h3>
            <p>Vincula un asistente para compartir las notas del día.</p>
          </div>
        </div>
      )}

      {compact && (
        <p className="owner-assistant-compact-title">
          <Users size={14} strokeWidth={1.6} />
          {currentLink ? 'Asistente vinculado' : 'Asignar asistente'}
        </p>
      )}

      {isAdmin && !isOwner && ownerUsers.length > 1 ? (
        <label className="owner-assistant-field">
          Owner
          <select
            value={activeOwnerId}
            onChange={(e) => setSelectedOwnerId(e.target.value)}
            disabled={busy}
          >
            {ownerUsers.map((u) => (
              <option key={u.id} value={u.authUserId ?? ''}>
                @{u.twitchLogin}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="owner-assistant-link-box">
        {currentLink && linkedAssistant ? (
          <ProfileChip user={linkedAssistant} badge="Asistente" />
        ) : currentLink ? (
          <p className="owner-assistant-current">
            <Link2 size={14} strokeWidth={1.6} />
            Tu asistente: <b>@{currentLink.assistantLogin}</b>
          </p>
        ) : (
          <div className="owner-assistant-empty">
            <Users size={16} strokeWidth={1.6} aria-hidden />
            <span>Sin asistente asignado</span>
          </div>
        )}
      </div>

      <div className="owner-assistant-form">
        <label className="owner-assistant-field">
          {currentLink ? 'Cambiar asistente' : 'Elegir asistente'}
          <select
            className={currentLink && !selectedAssistantId ? 'placeholder-value' : undefined}
            value={selectedAssistantId}
            onChange={(e) => setSelectedAssistantId(e.target.value)}
            disabled={busy || assistantOptions.length === 0}
          >
            <option value="">
              {currentLink
                ? (selectableAssistants.length === 0
                    ? 'No hay otros asistentes'
                    : 'Elegir otro asistente…')
                : (availableAssistants.length === 0
                    ? 'No hay asistentes disponibles'
                    : 'Seleccionar…')}
            </option>
            {assistantOptions.map((u) => (
              <option key={u.id} value={u.authUserId ?? ''}>
                @{u.twitchLogin}
                {u.displayName ? ` · ${u.displayName}` : ''}
              </option>
            ))}
          </select>
        </label>

        {availableAssistants.length === 0 && !currentLink ? (
          <p className="integration-note owner-assistant-hint">
            Todos los asistentes ya están vinculados. Quita una asignación previa o crea usuarios con rol asistente.
          </p>
        ) : null}

        {currentLink && selectableAssistants.length === 0 ? (
          <p className="integration-note owner-assistant-hint">
            No hay otros asistentes disponibles. Quita la asignación actual o crea usuarios con rol asistente.
          </p>
        ) : null}

        <div className="owner-assistant-actions">
          <button
            type="button"
            className="primary"
            disabled={busy || !selectedAssistantId}
            onClick={() => void save()}
          >
            {busy ? 'Guardando…' : currentLink ? 'Actualizar' : 'Asignar'}
          </button>
          {currentLink ? (
            <button type="button" className="secondary ghost-btn" disabled={busy} onClick={() => void remove()}>
              Quitar
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
