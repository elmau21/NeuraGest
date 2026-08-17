import { useCallback, useEffect, useState } from 'react'
import { ArrowRightLeft, Check, Plus, RefreshCw } from '@/components/icons'
import { listAppUsers, type AppUserRecord } from '@/services/app-users'
import { assignTalentManager, listDbTalents, listTalentManagers, type DbTalent, type TalentManagerRecord } from '@/services/agency'
import {
  createShiftHandoff,
  handoffOnManagerChange,
  listShiftHandoffs,
  updateHandoffStatus,
  HANDOFF_STATUS_LABELS,
  type HandoffStatus,
  type ShiftHandoff,
} from '@/services/handoff'
import { isTauri } from '@/services/twitch'
import { useAuthStore } from '@/stores/auth-store'
import { logHandoffActivity } from '@/services/audit'

export function HandoffPage() {
  const appUserId = useAuthStore((s) => s.appUserId)
  const [handoffs, setHandoffs] = useState<ShiftHandoff[]>([])
  const [managers, setManagers] = useState<TalentManagerRecord[]>([])
  const [talents, setTalents] = useState<DbTalent[]>([])
  const [appUsers, setAppUsers] = useState<AppUserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({
    talentId: '',
    toManagerId: '',
    notes: '',
    openItemsSummary: '',
  })

  const reload = useCallback(async () => {
    if (!isTauri) return
    setLoading(true)
    setError(null)
    try {
      const [rows, mgrs, dbTalents, users] = await Promise.all([
        listShiftHandoffs(),
        listTalentManagers(),
        listDbTalents(),
        listAppUsers(),
      ])
      setHandoffs(rows)
      setManagers(mgrs)
      setTalents(dbTalents)
      setAppUsers(users)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const currentManager = (talentId: string) =>
    managers.find((m) => m.talentId === talentId)?.managerAppUserId

  const submitHandoff = async () => {
    const talent = talents.find((t) => t.id === form.talentId)
    if (!talent || !form.toManagerId) return
    const fromId = currentManager(form.talentId) ?? appUserId
    if (!fromId) {
      setError('No hay manager saliente identificado.')
      return
    }
    try {
      if (fromId !== form.toManagerId) {
        await assignTalentManager(form.talentId, form.toManagerId)
      }
      const row = await createShiftHandoff({
        fromManagerId: fromId,
        toManagerId: form.toManagerId,
        talentIds: [form.talentId],
        openItemsSummary: form.openItemsSummary || `Turno @${talent.login}`,
        notes: form.notes,
      })
      setHandoffs((prev) => [row, ...prev])
      void logHandoffActivity('created', { talentLogin: talent.login, status: row.status }, row.id)
      setFormOpen(false)
      setForm({ talentId: '', toManagerId: '', notes: '', openItemsSummary: '' })
      void reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const quickReassign = async (talentId: string, newManagerId: string) => {
    const talent = talents.find((t) => t.id === talentId)
    if (!talent) return
    const prev = currentManager(talentId)
    try {
      await assignTalentManager(talentId, newManagerId)
      await handoffOnManagerChange({
        talentId,
        talentLogin: talent.login,
        previousManagerId: prev,
        newManagerId,
        openItemsSummary: `Reasignación de @${talent.login}`,
      })
      void reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const setStatus = async (id: string, status: HandoffStatus) => {
    try {
      const updated = await updateHandoffStatus(id, status)
      void logHandoffActivity('updated', { status: updated.status }, updated.id)
      setHandoffs((prev) => prev.map((h) => (h.id === id ? updated : h)))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  if (!isTauri) {
    return <div className="card agency-gate"><p>Handoff de turno requiere la app de escritorio NeuraGest.</p></div>
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Handoff de turno</h1>
          <p>Transferencia de responsabilidad al cambiar manager de talento.</p>
        </div>
        <div className="page-actions">
          <button className="secondary" disabled={loading} onClick={() => void reload()}><RefreshCw size={16}/></button>
          <button className="primary" onClick={() => setFormOpen(true)}><Plus size={16}/> Nuevo handoff</button>
        </div>
      </div>

      {error && <p className="integration-note">{error}</p>}

      <div className="card">
        <h3><ArrowRightLeft size={16}/> Handoffs recientes</h3>
        {loading ? <p className="empty-state">Cargando…</p> : handoffs.length === 0 ? (
          <p className="empty-state">Sin handoffs — reasigna un manager para generar uno.</p>
        ) : (
          <div className="ops-handoff-list">
            {handoffs.map((h) => (
              <div key={h.id} className={`ops-handoff-row status-${h.status}`}>
                <div>
                  <b>{h.fromManagerDisplayName ?? h.fromManagerLogin} → {h.toManagerDisplayName ?? h.toManagerLogin}</b>
                  <span>{new Date(h.handoffAt).toLocaleString('es-MX')} · {HANDOFF_STATUS_LABELS[h.status]}</span>
                  {h.openItemsSummary && <p>{h.openItemsSummary}</p>}
                  {h.notes && <small>{h.notes}</small>}
                </div>
                {h.status === 'pending' && (
                  <button className="secondary" onClick={() => void setStatus(h.id, 'acknowledged')}><Check size={14}/> Recibir</button>
                )}
                {h.status === 'acknowledged' && (
                  <button className="secondary" onClick={() => void setStatus(h.id, 'completed')}><Check size={14}/> Completar</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h3>Reasignación rápida</h3>
        <div className="ops-handoff-quick">
          {talents.slice(0, 8).map((t) => {
            const mgr = managers.find((m) => m.talentId === t.id)
            return (
              <div key={t.id} className="ops-handoff-quick-row">
                <span>@{t.login}</span>
                <small>{mgr ? `@${mgr.managerLogin}` : 'Sin manager'}</small>
                <select defaultValue="" onChange={(e) => { if (e.target.value) void quickReassign(t.id, e.target.value); e.target.value = '' }}>
                  <option value="">Cambiar a…</option>
                  {appUsers.map((u) => <option key={u.id} value={u.id}>{u.displayName ?? u.twitchLogin}</option>)}
                </select>
              </div>
            )
          })}
        </div>
      </div>

      {formOpen && (
        <div className="modal-backdrop" onClick={() => setFormOpen(false)}>
          <div className="agency-modal card" onClick={(e) => e.stopPropagation()}>
            <h3>Handoff manual</h3>
            <label>Talento
              <select value={form.talentId} onChange={(e) => setForm((f) => ({ ...f, talentId: e.target.value }))}>
                <option value="">—</option>
                {talents.map((t) => <option key={t.id} value={t.id}>{t.displayName}</option>)}
              </select>
            </label>
            <label>Nuevo responsable
              <select value={form.toManagerId} onChange={(e) => setForm((f) => ({ ...f, toManagerId: e.target.value }))}>
                <option value="">—</option>
                {appUsers.map((u) => <option key={u.id} value={u.id}>{u.displayName ?? u.twitchLogin}</option>)}
              </select>
            </label>
            <label>Pendientes<textarea rows={2} value={form.openItemsSummary} onChange={(e) => setForm((f) => ({ ...f, openItemsSummary: e.target.value }))}/></label>
            <label>Notas<textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}/></label>
            <div className="agency-modal-actions">
              <button className="secondary" onClick={() => setFormOpen(false)}>Cancelar</button>
              <button className="primary" onClick={() => void submitHandoff()}>Transferir turno</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
