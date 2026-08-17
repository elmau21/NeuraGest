import { useCallback, useEffect, useState } from 'react'
import { Plus, RefreshCw, Trash2 } from '@/components/icons'
import {
  deletePlayer,
  listContracts,
  listPlayers,
  saveContract,
  savePlayer,
  type NlContract,
  type NlPlayer,
} from '@/services/neuraleague'
import { listDbTalents, type DbTalent } from '@/services/agency'
import { canMutateLeague } from '@/services/permissions'
import { isTauri } from '@/services/twitch'
import { useAuthStore } from '@/stores/auth-store'
import { toastError, toastSuccess } from '@/stores/toast-store'
import { NlPageShell } from './NeuraLeagueShell'

export function NeuraLeaguePlayersPage() {
  const roles = useAuthStore((s) => s.roles)
  const login = useAuthStore((s) => s.session)?.login
  const readonly = !canMutateLeague(roles, login)

  const [players, setPlayers] = useState<NlPlayer[]>([])
  const [contracts, setContracts] = useState<NlContract[]>([])
  const [talents, setTalents] = useState<DbTalent[]>([])
  const [selected, setSelected] = useState<NlPlayer | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!isTauri) return
    setLoading(true)
    try {
      const [p, c, t] = await Promise.all([
        listPlayers(),
        listContracts(),
        listDbTalents().catch(() => [] as DbTalent[]),
      ])
      setPlayers(p)
      setContracts(c)
      setTalents(t)
      setSelected((prev) => (prev ? p.find((x) => x.id === prev.id) ?? p[0] ?? null : p[0] ?? null))
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Error al cargar jugadores')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = async () => {
    if (readonly) return
    try {
      const saved = await savePlayer({ nickname: 'NuevoJugador', bio: '', socials: {}, notes: '' })
      setSelected(saved)
      toastSuccess('Jugador creado')
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo crear')
    }
  }

  const save = async () => {
    if (!selected || readonly) return
    try {
      const saved = await savePlayer(selected)
      setSelected(saved)
      toastSuccess('Jugador guardado')
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo guardar')
    }
  }

  const remove = async () => {
    if (!selected || readonly) return
    try {
      await deletePlayer(selected.id)
      setSelected(null)
      toastSuccess('Jugador archivado')
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo archivar')
    }
  }

  const addContract = async () => {
    if (!selected || readonly) return
    try {
      await saveContract({
        playerId: selected.id,
        title: `Acuerdo ${selected.nickname}`,
        status: 'draft',
        notes: '',
      })
      toastSuccess('Acuerdo creado')
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo crear acuerdo')
    }
  }

  const playerContracts = selected ? contracts.filter((c) => c.playerId === selected.id) : []

  return (
    <NlPageShell
      title="Jugadores"
      description="Fichas, redes, historial en la org y acuerdos internos."
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="secondary" onClick={() => void reload()}><RefreshCw size={15} />Actualizar</button>
          {!readonly && <button type="button" className="primary" onClick={() => void create()}><Plus size={15} />Jugador</button>}
        </div>
      }
    >
      {loading ? <div className="card empty-state">Cargando…</div> : (
        <div className="nl-split">
          <div className="card">
            <div className="nl-list">
              {players.map((p) => (
                <button key={p.id} type="button" className={selected?.id === p.id ? 'selected' : ''} onClick={() => setSelected(p)}>
                  <b>{p.nickname}</b>
                  <small>{p.primaryRole ?? 'sin rol'} · {p.status}</small>
                </button>
              ))}
              {players.length === 0 && <p className="empty-state">Sin jugadores.</p>}
            </div>
          </div>

          <div className="card">
            {!selected ? <p className="empty-state">Selecciona un jugador.</p> : (
              <div className="nl-form">
                <label>Nickname<input disabled={readonly} value={selected.nickname} onChange={(e) => setSelected({ ...selected, nickname: e.target.value })} /></label>
                <label>Nombre real<input disabled={readonly} value={selected.realName ?? ''} onChange={(e) => setSelected({ ...selected, realName: e.target.value })} /></label>
                <label>Rol principal<input disabled={readonly} value={selected.primaryRole ?? ''} onChange={(e) => setSelected({ ...selected, primaryRole: e.target.value })} /></label>
                <label>País / región
                  <div className="nl-inline">
                    <input disabled={readonly} placeholder="País" value={selected.country ?? ''} onChange={(e) => setSelected({ ...selected, country: e.target.value })} />
                    <input disabled={readonly} placeholder="Región" value={selected.region ?? ''} onChange={(e) => setSelected({ ...selected, region: e.target.value })} />
                  </div>
                </label>
                <label>Estado
                  <select disabled={readonly} value={selected.status} onChange={(e) => setSelected({ ...selected, status: e.target.value as NlPlayer['status'] })}>
                    {['active', 'inactive', 'alumni', 'banned'].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label>Talento Twitch (opcional)
                  <select disabled={readonly} value={selected.talentId ?? ''} onChange={(e) => setSelected({ ...selected, talentId: e.target.value || undefined })}>
                    <option value="">—</option>
                    {talents.map((t) => <option key={t.id} value={t.id}>{t.displayName} (@{t.login})</option>)}
                  </select>
                </label>
                <label>Bio<textarea disabled={readonly} rows={3} value={selected.bio} onChange={(e) => setSelected({ ...selected, bio: e.target.value })} /></label>
                <label>Discord<input disabled={readonly} value={selected.socials.discord ?? ''} onChange={(e) => setSelected({ ...selected, socials: { ...selected.socials, discord: e.target.value } })} /></label>
                <label>Twitter / X<input disabled={readonly} value={selected.socials.twitter ?? ''} onChange={(e) => setSelected({ ...selected, socials: { ...selected.socials, twitter: e.target.value } })} /></label>
                <label>Notas<textarea disabled={readonly} rows={3} value={selected.notes} onChange={(e) => setSelected({ ...selected, notes: e.target.value })} /></label>
                {!readonly && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="primary" onClick={() => void save()}>Guardar</button>
                    <button type="button" className="secondary" onClick={() => void remove()}><Trash2 size={14} />Archivar</button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Acuerdos / contratos</h3>
              {!readonly && selected && <button type="button" className="secondary" onClick={() => void addContract()}><Plus size={14} />Acuerdo</button>}
            </div>
            <ul className="nl-plain-list">
              {playerContracts.map((c) => (
                <li key={c.id}>
                  <b>{c.title}</b>
                  <span>{c.status}{c.externalUrl ? ` · ${c.externalUrl}` : ''}{c.documentId ? ' · doc interno' : ''}</span>
                </li>
              ))}
              {playerContracts.length === 0 && <li><span>Sin acuerdos registrados</span></li>}
            </ul>
          </div>
        </div>
      )}
    </NlPageShell>
  )
}
