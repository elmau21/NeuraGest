import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import {
  deleteRosterEntry,
  deleteTeam,
  listGames,
  listPlayers,
  listRoster,
  listSeasons,
  listStaff,
  listTeams,
  saveRosterEntry,
  saveStaff,
  saveTeam,
  type NlPlayer,
  type NlRosterEntry,
  type NlStaffAssignment,
  type NlTeam,
} from '@/services/neuraleague'
import { canMutateLeague } from '@/services/permissions'
import { isTauri } from '@/services/twitch'
import { useAuthStore } from '@/stores/auth-store'
import { toastError, toastSuccess } from '@/stores/toast-store'
import { NlPageShell } from './NeuraLeagueShell'

export function NeuraLeagueTeamsPage() {
  const roles = useAuthStore((s) => s.roles)
  const login = useAuthStore((s) => s.session)?.login
  const readonly = !canMutateLeague(roles, login)

  const [teams, setTeams] = useState<NlTeam[]>([])
  const [games, setGames] = useState<Awaited<ReturnType<typeof listGames>>>([])
  const [seasons, setSeasons] = useState<Awaited<ReturnType<typeof listSeasons>>>([])
  const [players, setPlayers] = useState<NlPlayer[]>([])
  const [roster, setRoster] = useState<NlRosterEntry[]>([])
  const [staff, setStaff] = useState<NlStaffAssignment[]>([])
  const [selected, setSelected] = useState<NlTeam | null>(null)
  const [loading, setLoading] = useState(true)

  const gameName = useMemo(() => new Map(games.map((g) => [g.id, g.name])), [games])
  const playerName = useMemo(() => new Map(players.map((p) => [p.id, p.nickname])), [players])

  const reload = useCallback(async () => {
    if (!isTauri) return
    setLoading(true)
    try {
      const [t, g, s, p] = await Promise.all([listTeams(), listGames(), listSeasons(), listPlayers()])
      setTeams(t)
      setGames(g)
      setSeasons(s)
      setPlayers(p)
      setSelected((prev) => (prev ? t.find((x) => x.id === prev.id) ?? t[0] ?? null : t[0] ?? null))
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Error al cargar equipos')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadTeamDetail = useCallback(async (teamId: string) => {
    try {
      const [r, st] = await Promise.all([listRoster(teamId), listStaff(teamId)])
      setRoster(r)
      setStaff(st)
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Error al cargar roster')
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (selected) void loadTeamDetail(selected.id)
  }, [selected, loadTeamDetail])

  const createTeam = async () => {
    if (readonly || games.length === 0) return
    try {
      const saved = await saveTeam({
        name: 'Nuevo equipo',
        tag: 'NEW',
        gameId: games[0].id,
        seasonId: seasons.find((s) => s.status === 'active')?.id,
        region: 'LATAM',
        notes: '',
        socials: {},
      })
      setSelected(saved)
      toastSuccess('Equipo creado')
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo crear')
    }
  }

  const save = async () => {
    if (!selected || readonly) return
    try {
      const saved = await saveTeam(selected)
      setSelected(saved)
      toastSuccess('Equipo guardado')
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo guardar')
    }
  }

  const remove = async () => {
    if (!selected || readonly) return
    try {
      await deleteTeam(selected.id)
      setSelected(null)
      toastSuccess('Equipo archivado')
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo archivar')
    }
  }

  const addRoster = async (playerId: string) => {
    if (!selected || readonly || !playerId) return
    try {
      await saveRosterEntry({
        teamId: selected.id,
        playerId,
        seasonId: selected.seasonId,
        slot: 'starter',
        isCaptain: false,
        notes: '',
      })
      toastSuccess('Jugador añadido al roster')
      await loadTeamDetail(selected.id)
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo añadir')
    }
  }

  const addStaff = async () => {
    if (!selected || readonly) return
    try {
      await saveStaff({
        teamId: selected.id,
        seasonId: selected.seasonId,
        staffRole: 'coach',
        displayName: 'Coach',
        notes: '',
      })
      toastSuccess('Staff añadido')
      await loadTeamDetail(selected.id)
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo añadir staff')
    }
  }

  return (
    <NlPageShell
      title="Equipos"
      description="Tag, juego, región, roster y organigrama de staff."
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="secondary" onClick={() => void reload()}><RefreshCw size={15} />Actualizar</button>
          {!readonly && <button type="button" className="primary" onClick={() => void createTeam()}><Plus size={15} />Equipo</button>}
        </div>
      }
    >
      {loading ? <div className="card empty-state">Cargando…</div> : (
        <div className="nl-split">
          <div className="card">
            <div className="nl-list">
              {teams.map((t) => (
                <button key={t.id} type="button" className={selected?.id === t.id ? 'selected' : ''} onClick={() => setSelected(t)}>
                  <b>[{t.tag}] {t.name}</b>
                  <small>{gameName.get(t.gameId) ?? '—'} · {t.region ?? 'sin región'}</small>
                </button>
              ))}
              {teams.length === 0 && <p className="empty-state">Sin equipos.</p>}
            </div>
          </div>

          <div className="card">
            {!selected ? <p className="empty-state">Selecciona un equipo.</p> : (
              <div className="nl-form">
                <label>Nombre<input disabled={readonly} value={selected.name} onChange={(e) => setSelected({ ...selected, name: e.target.value })} /></label>
                <label>Tag<input disabled={readonly} value={selected.tag} onChange={(e) => setSelected({ ...selected, tag: e.target.value })} /></label>
                <label>Juego
                  <select disabled={readonly} value={selected.gameId} onChange={(e) => setSelected({ ...selected, gameId: e.target.value })}>
                    {games.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </label>
                <label>Temporada
                  <select disabled={readonly} value={selected.seasonId ?? ''} onChange={(e) => setSelected({ ...selected, seasonId: e.target.value || undefined })}>
                    <option value="">—</option>
                    {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
                <label>Región<input disabled={readonly} value={selected.region ?? ''} onChange={(e) => setSelected({ ...selected, region: e.target.value })} /></label>
                <label>Logo URL<input disabled={readonly} value={selected.logoUrl ?? ''} onChange={(e) => setSelected({ ...selected, logoUrl: e.target.value })} /></label>
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
            <div className="card-head"><h3>Roster</h3></div>
            {!readonly && selected && (
              <label>Añadir jugador
                <select defaultValue="" onChange={(e) => { void addRoster(e.target.value); e.target.value = '' }}>
                  <option value="" disabled>Elegir…</option>
                  {players.filter((p) => !roster.some((r) => r.playerId === p.id)).map((p) => (
                    <option key={p.id} value={p.id}>{p.nickname}</option>
                  ))}
                </select>
              </label>
            )}
            <ul className="nl-plain-list">
              {roster.map((r) => (
                <li key={r.id}>
                  <b>{playerName.get(r.playerId) ?? r.playerId}</b>
                  <span>{r.slot}{r.inGameRole ? ` · ${r.inGameRole}` : ''}{r.isCaptain ? ' · capitán' : ''}</span>
                  {!readonly && (
                    <button type="button" className="secondary" style={{ marginLeft: 'auto', padding: '4px 8px' }} onClick={() => void deleteRosterEntry(r.id).then(() => selected && loadTeamDetail(selected.id))}>Quitar</button>
                  )}
                </li>
              ))}
            </ul>
            <div className="card-head" style={{ marginTop: 16 }}><h3>Staff</h3>
              {!readonly && selected && <button type="button" className="secondary" onClick={() => void addStaff()}><Plus size={14} />Staff</button>}
            </div>
            <ul className="nl-plain-list">
              {staff.map((s) => (
                <li key={s.id}>
                  <b>{s.displayName ?? s.staffRole}</b>
                  <span>{s.staffRole}</span>
                </li>
              ))}
              {staff.length === 0 && <li><span>Sin staff asignado</span></li>}
            </ul>
          </div>
        </div>
      )}
    </NlPageShell>
  )
}
