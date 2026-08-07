import { useCallback, useEffect, useMemo, useState } from 'react'
import { UserPlus, X } from 'lucide-react'
import { listAppUsers, type AppUserRecord } from '@/services/app-users'
import {
  assignTalentManager,
  listDbTalents,
  listTalentManagers,
  removeTalentManager,
  type DbTalent,
  type TalentManagerRecord,
} from '@/services/agency'
import { isTauri } from '@/services/twitch'
import { useAuthStore } from '@/stores/auth-store'

type Props = {
  compact?: boolean
}

export function TalentManagersPanel({ compact = false }: Props) {
  const appUserId = useAuthStore((s) => s.appUserId)
  const roles = useAuthStore((s) => s.roles)
  const canManage = roles.some((r) => ['owner', 'admin', 'manager', 'dev'].includes(r))

  const [managers, setManagers] = useState<TalentManagerRecord[]>([])
  const [talents, setTalents] = useState<DbTalent[]>([])
  const [appUsers, setAppUsers] = useState<AppUserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const [talentId, setTalentId] = useState('')
  const [managerId, setManagerId] = useState('')

  const reload = useCallback(async () => {
    if (!isTauri) return
    setLoading(true)
    setError(null)
    try {
      const [rows, dbTalents] = await Promise.all([listTalentManagers(), listDbTalents()])
      setManagers(rows)
      setTalents(dbTalents)
      if (canManage) {
        try {
          setAppUsers(await listAppUsers())
        } catch {
          setAppUsers([])
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [canManage])

  useEffect(() => { void reload() }, [reload])

  const myTalentLogins = useMemo(() => {
    if (!appUserId) return new Set<string>()
    return new Set(
      managers
        .filter((m) => m.managerAppUserId === appUserId)
        .map((m) => m.talentLogin.toLowerCase()),
    )
  }, [managers, appUserId])

  const assign = async () => {
    if (!talentId || !managerId) return
    try {
      const row = await assignTalentManager(talentId, managerId)
      setManagers((prev) => {
        const filtered = prev.filter((m) => !(m.talentId === row.talentId && m.managerAppUserId === row.managerAppUserId))
        return [row, ...filtered]
      })
      setAssignOpen(false)
      setTalentId('')
      setManagerId('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const unassign = async (id: string) => {
    try {
      await removeTalentManager(id)
      setManagers((prev) => prev.filter((m) => m.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  if (!isTauri) {
    return compact ? null : (
      <div className="card agency-gate"><p>Responsables requiere la app de escritorio NeuraGest.</p></div>
    )
  }

  return (
    <div className={compact ? 'talent-managers-inline' : 'card talent-managers-panel'}>
      <div className="talent-managers-head">
        <div>
          <b>{compact ? 'Responsables' : 'Asignación talento ↔ responsable'}</b>
          {!compact && <p>Quién gestiona cada talento de la agencia.</p>}
        </div>
        {canManage && (
          <button className="primary" onClick={() => setAssignOpen(true)}>
            <UserPlus size={15} /> Asignar
          </button>
        )}
      </div>

      {error && <p className="integration-note">{error}</p>}

      <div className="talent-managers-table">
        <div className="table-header"><span>Talento</span><span>Responsable</span>{canManage && <span />}</div>
        {managers.map((row) => (
          <div className="table-row" key={row.id}>
            <span><b>{row.talentDisplayName}</b> <small>@{row.talentLogin}</small></span>
            <span>{row.managerDisplayName ?? row.managerLogin} <small>@{row.managerLogin}</small></span>
            {canManage && (
              <button className="icon-btn" onClick={() => void unassign(row.id)} aria-label="Quitar">
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        {!loading && managers.length === 0 && (
          <p className="empty-state">Sin asignaciones. {canManage ? 'Usa «Asignar» para vincular un responsable.' : ''}</p>
        )}
      </div>

      {assignOpen && (
        <div className="modal-backdrop" onClick={() => setAssignOpen(false)}>
          <div className="agency-modal card" onClick={(e) => e.stopPropagation()}>
            <h3>Asignar responsable</h3>
            <label>Talento
              <select value={talentId} onChange={(e) => setTalentId(e.target.value)}>
                <option value="">Seleccionar…</option>
                {talents.map((t) => <option key={t.id} value={t.id}>{t.displayName} (@{t.login})</option>)}
              </select>
            </label>
            <label>Responsable (app_user)
              <select value={managerId} onChange={(e) => setManagerId(e.target.value)}>
                <option value="">Seleccionar…</option>
                {appUsers.map((u) => <option key={u.id} value={u.id}>{u.displayName ?? u.twitchLogin} (@{u.twitchLogin})</option>)}
              </select>
            </label>
            <div className="agency-modal-actions">
              <button className="secondary" onClick={() => setAssignOpen(false)}>Cancelar</button>
              <button className="primary" disabled={!talentId || !managerId} onClick={() => void assign()}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Export filter helper for parent */}
      <span hidden data-my-talent-logins={Array.from(myTalentLogins).join(',')} />
    </div>
  )
}

export function useMyTalentLogins() {
  const appUserId = useAuthStore((s) => s.appUserId)
  const [logins, setLogins] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!isTauri || !appUserId) return
    void listTalentManagers().then((rows) => {
      setLogins(new Set(
        rows.filter((m) => m.managerAppUserId === appUserId).map((m) => m.talentLogin.toLowerCase()),
      ))
    }).catch(() => undefined)
  }, [appUserId])

  return logins
}
