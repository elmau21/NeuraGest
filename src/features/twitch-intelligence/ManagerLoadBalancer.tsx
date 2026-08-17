import { useCallback, useEffect, useMemo, useState } from 'react'
import { Scale, UserPlus, X } from '@/components/icons'
import {
  assignTalentManager,
  listDbTalents,
  listTalentManagers,
  removeTalentManager,
  type DbTalent,
  type TalentManagerRecord,
} from '@/services/agency'
import { listAppUsers, type AppUserRecord } from '@/services/app-users'
import { isTauri } from '@/services/twitch'
import { useAuthStore } from '@/stores/auth-store'
import {
  buildManagerLoad,
  suggestManagerRebalance,
  type ManagerLoadRow,
} from './twitch-intelligence-utils'

export function ManagerLoadBalancer({ liveLogins }: { liveLogins: Set<string> }) {
  const roles = useAuthStore((s) => s.roles)
  const canManage = roles.some((r) => ['owner', 'admin', 'manager', 'dev'].includes(r))

  const [managers, setManagers] = useState<TalentManagerRecord[]>([])
  const [talents, setTalents] = useState<DbTalent[]>([])
  const [appUsers, setAppUsers] = useState<AppUserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [assignOpen, setAssignOpen] = useState(false)
  const [talentId, setTalentId] = useState('')
  const [managerId, setManagerId] = useState('')

  const reload = useCallback(async () => {
    if (!isTauri) return
    setLoading(true)
    setError(undefined)
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

  const loadRows: ManagerLoadRow[] = useMemo(
    () => buildManagerLoad(managers, liveLogins),
    [managers, liveLogins],
  )
  const suggestions = useMemo(() => suggestManagerRebalance(managers), [managers])

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
    return <div className="ti-empty">Balanceo de managers requiere la app de escritorio NeuraGest.</div>
  }

  const avgLoad = loadRows.length
    ? Math.round(loadRows.reduce((sum, row) => sum + row.loadIndex, 0) / loadRows.length)
    : 0

  return (
    <section className="ti-panel">
      <header>
        <div>
          <h2><Scale size={14} /> Carga managers · balanceo</h2>
          <p>Distribución de talentos y sugerencias de rebalanceo</p>
        </div>
        {canManage && (
          <button className="primary" onClick={() => setAssignOpen(true)}>
            <UserPlus size={14} /> Asignar
          </button>
        )}
      </header>

      {error && <p className="integration-note">{error}</p>}

      <div className="ti-manager-summary">
        <article><span>Responsables</span><strong>{loadRows.length}</strong></article>
        <article><span>Asignaciones</span><strong>{managers.length}</strong></article>
        <article><span>Índice medio</span><strong>{avgLoad}%</strong></article>
        <article><span>En live ahora</span><strong>{[...liveLogins].length}</strong></article>
      </div>

      <div className="ti-manager-load">
        {loadRows.map((row) => (
          <article key={row.managerId} data-overload={row.loadIndex >= 130}>
            <div className="ti-load-bar">
              <i style={{ width: `${Math.min(row.loadIndex, 160)}%` }} />
            </div>
            <div>
              <b>{row.managerDisplayName}</b>
              <small>@{row.managerLogin} · {row.talentCount} talentos · {row.liveCount} live</small>
              {row.suggestedAction && <em>{row.suggestedAction}</em>}
            </div>
            <strong>{row.loadIndex}%</strong>
          </article>
        ))}
        {!loading && loadRows.length === 0 && (
          <div className="ti-empty">Sin asignaciones. Usa «Asignar» para vincular responsables.</div>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="ti-rebalance-suggestions">
          <h3>Sugerencias de rebalanceo</h3>
          {suggestions.map((suggestion) => (
            <p key={`${suggestion.talentLogin}-${suggestion.toManager}`}>
              Mover <b>@{suggestion.talentLogin}</b> de {suggestion.fromManager} → {suggestion.toManager}
              <small>{suggestion.reason}</small>
            </p>
          ))}
        </div>
      )}

      <div className="ti-manager-table">
        <div className="table-header"><span>Talento</span><span>Responsable</span>{canManage && <span />}</div>
        {managers.map((row) => (
          <div className="table-row" key={row.id}>
            <span><b>{row.talentDisplayName}</b> <small>@{row.talentLogin}</small></span>
            <span>{row.managerDisplayName ?? row.managerLogin}</span>
            {canManage && (
              <button className="icon-btn" onClick={() => void unassign(row.id)} aria-label="Quitar">
                <X size={14} />
              </button>
            )}
          </div>
        ))}
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
            <label>Responsable
              <select value={managerId} onChange={(e) => setManagerId(e.target.value)}>
                <option value="">Seleccionar…</option>
                {appUsers.map((u) => <option key={u.id} value={u.id}>{u.displayName ?? u.twitchLogin}</option>)}
              </select>
            </label>
            <div className="agency-modal-actions">
              <button className="secondary" onClick={() => setAssignOpen(false)}>Cancelar</button>
              <button className="primary" disabled={!talentId || !managerId} onClick={() => void assign()}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
