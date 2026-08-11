import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Plus, RefreshCw } from 'lucide-react'
import {
  exportLeagueBoardPack,
  listCandidates,
  listEvents,
  listGames,
  listPlayers,
  listSeasons,
  listTeams,
  saveSeason,
  type NlSeason,
} from '@/services/neuraleague'
import { canMutateLeague } from '@/services/permissions'
import { isTauri } from '@/services/twitch'
import { useAuthStore } from '@/stores/auth-store'
import { toastError, toastSuccess } from '@/stores/toast-store'
import { NlPageShell } from './NeuraLeagueShell'

export function NeuraLeagueOverviewPage() {
  const roles = useAuthStore((s) => s.roles)
  const login = useAuthStore((s) => s.session)?.login
  const readonly = !canMutateLeague(roles, login)

  const [seasons, setSeasons] = useState<NlSeason[]>([])
  const [games, setGames] = useState<Awaited<ReturnType<typeof listGames>>>([])
  const [teams, setTeams] = useState<Awaited<ReturnType<typeof listTeams>>>([])
  const [players, setPlayers] = useState<Awaited<ReturnType<typeof listPlayers>>>([])
  const [events, setEvents] = useState<Awaited<ReturnType<typeof listEvents>>>([])
  const [candidates, setCandidates] = useState<Awaited<ReturnType<typeof listCandidates>>>([])
  const [selected, setSelected] = useState<NlSeason | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!isTauri) return
    setLoading(true)
    setError(null)
    try {
      const [s, g, t, p, e, c] = await Promise.all([
        listSeasons(),
        listGames(),
        listTeams(),
        listPlayers(),
        listEvents(),
        listCandidates(),
      ])
      setSeasons(s)
      setGames(g)
      setTeams(t)
      setPlayers(p)
      setEvents(e)
      setCandidates(c)
      setSelected((prev) => prev ?? s.find((x) => x.status === 'active') ?? s[0] ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const upcoming = useMemo(
    () =>
      events
        .filter((e) => e.status === 'scheduled' || e.status === 'live')
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
        .slice(0, 6),
    [events],
  )

  const save = async () => {
    if (!selected || readonly) return
    try {
      const saved = await saveSeason(selected)
      setSelected(saved)
      toastSuccess('Temporada guardada')
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo guardar')
    }
  }

  const createSeason = async () => {
    if (readonly) return
    try {
      const slug = `temporada-${Date.now()}`
      const saved = await saveSeason({
        name: 'Nueva temporada',
        slug,
        status: 'draft',
        rulesMd: '',
        notes: '',
      })
      setSelected(saved)
      toastSuccess('Temporada creada')
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo crear')
    }
  }

  const downloadPack = () => {
    const md = exportLeagueBoardPack({
      season: selected,
      teams,
      players,
      events,
      candidates,
    })
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `neuraleague-board-pack-${selected?.slug ?? 'liga'}.md`
    a.click()
    URL.revokeObjectURL(url)
    toastSuccess('Board pack exportado')
  }

  if (!isTauri) {
    return (
      <NlPageShell title="NeuraLeague" description="Gestión interna de la liga.">
        <div className="card empty-state">Abre la app de escritorio para usar NeuraLeague.</div>
      </NlPageShell>
    )
  }

  return (
    <NlPageShell
      title="NeuraLeague"
      description="Temporadas, reglamento e historial de la organización."
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="secondary" onClick={() => void reload()}>
            <RefreshCw size={15} /> Actualizar
          </button>
          <button type="button" className="secondary" onClick={downloadPack}>
            <Download size={15} /> Board pack
          </button>
          {!readonly && (
            <button type="button" className="primary" onClick={() => void createSeason()}>
              <Plus size={15} /> Temporada
            </button>
          )}
        </div>
      }
    >
      {error && <p className="integration-note">{error}</p>}
      {loading ? (
        <div className="card empty-state">Cargando temporada…</div>
      ) : (
        <>
          <div className="kpi-grid nl-kpi">
            <div className="card"><span>Temporadas</span><b>{seasons.length}</b></div>
            <div className="card"><span>Juegos</span><b>{games.length}</b></div>
            <div className="card"><span>Equipos</span><b>{teams.length}</b></div>
            <div className="card"><span>Jugadores</span><b>{players.length}</b></div>
          </div>

          <div className="nl-split">
            <div className="card">
              <div className="card-head"><h3>Ediciones</h3></div>
              <div className="nl-list">
                {seasons.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={selected?.id === s.id ? 'selected' : ''}
                    onClick={() => setSelected(s)}
                  >
                    <b>{s.name}</b>
                    <small>{s.status} · {s.slug}</small>
                  </button>
                ))}
                {seasons.length === 0 && <p className="empty-state">Sin temporadas aún.</p>}
              </div>
            </div>

            <div className="card">
              <div className="card-head"><h3>Detalle de temporada</h3></div>
              {!selected ? (
                <p className="empty-state">Selecciona o crea una temporada.</p>
              ) : (
                <div className="nl-form">
                  <label>Nombre<input disabled={readonly} value={selected.name} onChange={(e) => setSelected({ ...selected, name: e.target.value })} /></label>
                  <label>Slug<input disabled={readonly} value={selected.slug} onChange={(e) => setSelected({ ...selected, slug: e.target.value })} /></label>
                  <label>Estado
                    <select disabled={readonly} value={selected.status} onChange={(e) => setSelected({ ...selected, status: e.target.value as NlSeason['status'] })}>
                      {['draft', 'open', 'active', 'closed', 'archived'].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                  <label>Inicio<input type="datetime-local" disabled={readonly} value={selected.startsAt?.slice(0, 16) ?? ''} onChange={(e) => setSelected({ ...selected, startsAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} /></label>
                  <label>Fin<input type="datetime-local" disabled={readonly} value={selected.endsAt?.slice(0, 16) ?? ''} onChange={(e) => setSelected({ ...selected, endsAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} /></label>
                  <label>Reglamento<textarea disabled={readonly} rows={6} value={selected.rulesMd} onChange={(e) => setSelected({ ...selected, rulesMd: e.target.value })} /></label>
                  <label>Notas<textarea disabled={readonly} rows={3} value={selected.notes} onChange={(e) => setSelected({ ...selected, notes: e.target.value })} /></label>
                  {!readonly && <button type="button" className="primary" onClick={() => void save()}>Guardar temporada</button>}
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-head"><h3>Juegos</h3></div>
              <ul className="nl-plain-list">
                {games.map((g) => <li key={g.id}><b>{g.name}</b><span>{g.agentLabel} / {g.mapLabel}</span></li>)}
              </ul>
              <div className="card-head" style={{ marginTop: 18 }}><h3>Próximos eventos</h3></div>
              <ul className="nl-plain-list">
                {upcoming.map((e) => (
                  <li key={e.id}>
                    <b>{e.title}</b>
                    <span>{new Date(e.startsAt).toLocaleString('es-MX')} · {e.eventType}</span>
                  </li>
                ))}
                {upcoming.length === 0 && <li><span>Sin eventos próximos</span></li>}
              </ul>
            </div>
          </div>
        </>
      )}
    </NlPageShell>
  )
}
