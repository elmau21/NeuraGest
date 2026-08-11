import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import {
  listEvents,
  listObjectives,
  listPlayerStats,
  listPlayers,
  listTeams,
  saveObjective,
  savePlayerStat,
  type NlObjective,
  type NlPlayerStat,
} from '@/services/neuraleague'
import { canMutateLeague } from '@/services/permissions'
import { isTauri } from '@/services/twitch'
import { useAuthStore } from '@/stores/auth-store'
import { toastError, toastSuccess } from '@/stores/toast-store'
import { NlPageShell } from './NeuraLeagueShell'

function weekStartIso(d = new Date()) {
  const day = d.getDay()
  const diff = (day + 6) % 7
  const monday = new Date(d)
  monday.setDate(d.getDate() - diff)
  return monday.toISOString().slice(0, 10)
}

export function NeuraLeagueStatsPage() {
  const roles = useAuthStore((s) => s.roles)
  const login = useAuthStore((s) => s.session)?.login
  const readonly = !canMutateLeague(roles, login)

  const [stats, setStats] = useState<NlPlayerStat[]>([])
  const [objectives, setObjectives] = useState<NlObjective[]>([])
  const [players, setPlayers] = useState<Awaited<ReturnType<typeof listPlayers>>>([])
  const [teams, setTeams] = useState<Awaited<ReturnType<typeof listTeams>>>([])
  const [events, setEvents] = useState<Awaited<ReturnType<typeof listEvents>>>([])
  const [draft, setDraft] = useState<Partial<NlPlayerStat> & { playerId: string }>({
    playerId: '',
    kills: 0,
    deaths: 0,
    assists: 0,
    notes: '',
  })
  const [objDraft, setObjDraft] = useState<Partial<NlObjective> & { title: string; weekStart: string }>({
    title: '',
    weekStart: weekStartIso(),
    scope: 'team',
    description: '',
    status: 'open',
  })
  const [loading, setLoading] = useState(true)

  const playerName = useMemo(() => new Map(players.map((p) => [p.id, p.nickname])), [players])

  const aggregates = useMemo(() => {
    const byPlayer = new Map<string, { k: number; d: number; a: number; n: number }>()
    for (const s of stats) {
      const cur = byPlayer.get(s.playerId) ?? { k: 0, d: 0, a: 0, n: 0 }
      cur.k += s.kills
      cur.d += s.deaths
      cur.a += s.assists
      cur.n += 1
      byPlayer.set(s.playerId, cur)
    }
    return [...byPlayer.entries()].map(([id, v]) => ({
      id,
      name: playerName.get(id) ?? id,
      ...v,
      kd: v.d === 0 ? v.k : +(v.k / v.d).toFixed(2),
    }))
  }, [stats, playerName])

  const byMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of stats) {
      const key = s.mapName || 'Sin mapa'
      m.set(key, (m.get(key) ?? 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [stats])

  const byAgent = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of stats) {
      const key = s.agentOrChamp || 'Sin agente'
      m.set(key, (m.get(key) ?? 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [stats])

  const reload = useCallback(async () => {
    if (!isTauri) return
    setLoading(true)
    try {
      const [s, o, p, t, e] = await Promise.all([
        listPlayerStats(),
        listObjectives(),
        listPlayers(),
        listTeams(),
        listEvents(),
      ])
      setStats(s)
      setObjectives(o)
      setPlayers(p)
      setTeams(t)
      setEvents(e)
      if (!draft.playerId && p[0]) setDraft((d) => ({ ...d, playerId: p[0].id }))
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Error al cargar stats')
    } finally {
      setLoading(false)
    }
  }, [draft.playerId])

  useEffect(() => {
    void reload()
  }, [reload])

  const addStat = async () => {
    if (readonly || !draft.playerId) return
    try {
      await savePlayerStat(draft)
      toastSuccess('Stat registrada')
      setDraft((d) => ({ ...d, kills: 0, deaths: 0, assists: 0, mapName: '', agentOrChamp: '', notes: '' }))
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo guardar')
    }
  }

  const addObjective = async () => {
    if (readonly || !objDraft.title.trim()) return
    try {
      await saveObjective(objDraft)
      toastSuccess('Objetivo creado')
      setObjDraft({ title: '', weekStart: weekStartIso(), scope: 'team', description: '', status: 'open' })
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo crear objetivo')
    }
  }

  return (
    <NlPageShell
      title="Stats"
      description="Rendimiento por jugador, mapa, agente y objetivos semanales."
      action={<button type="button" className="secondary" onClick={() => void reload()}><RefreshCw size={15} />Actualizar</button>}
    >
      {loading ? <div className="card empty-state">Cargando…</div> : (
        <>
          <div className="nl-split nl-split-2">
            <div className="card">
              <div className="card-head"><h3>Por jugador</h3></div>
              <div className="talent-table">
                <div className="table-header" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}>
                  <span>Jugador</span><span>K</span><span>D</span><span>A</span><span>K/D</span>
                </div>
                {aggregates.map((a) => (
                  <div key={a.id} className="table-row" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}>
                    <span>{a.name}</span><span>{a.k}</span><span>{a.d}</span><span>{a.a}</span><span>{a.kd}</span>
                  </div>
                ))}
                {aggregates.length === 0 && <p className="empty-state">Sin stats aún.</p>}
              </div>
            </div>
            <div className="card">
              <div className="card-head"><h3>Mapas / agentes</h3></div>
              <div className="nl-inline-cols">
                <ul className="nl-plain-list">{byMap.map(([k, n]) => <li key={k}><b>{k}</b><span>{n} partidas</span></li>)}</ul>
                <ul className="nl-plain-list">{byAgent.map(([k, n]) => <li key={k}><b>{k}</b><span>{n}</span></li>)}</ul>
              </div>
            </div>
          </div>

          <div className="nl-split" style={{ marginTop: 14 }}>
            {!readonly && (
              <div className="card">
                <div className="card-head"><h3>Registrar partida</h3></div>
                <div className="nl-form">
                  <label>Jugador
                    <select value={draft.playerId} onChange={(e) => setDraft({ ...draft, playerId: e.target.value })}>
                      {players.map((p) => <option key={p.id} value={p.id}>{p.nickname}</option>)}
                    </select>
                  </label>
                  <label>Equipo
                    <select value={draft.teamId ?? ''} onChange={(e) => setDraft({ ...draft, teamId: e.target.value || undefined })}>
                      <option value="">—</option>
                      {teams.map((t) => <option key={t.id} value={t.id}>[{t.tag}] {t.name}</option>)}
                    </select>
                  </label>
                  <label>Evento
                    <select value={draft.eventId ?? ''} onChange={(e) => setDraft({ ...draft, eventId: e.target.value || undefined })}>
                      <option value="">—</option>
                      {events.slice(0, 40).map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
                    </select>
                  </label>
                  <div className="nl-inline">
                    <label>Mapa<input value={draft.mapName ?? ''} onChange={(e) => setDraft({ ...draft, mapName: e.target.value })} /></label>
                    <label>Agente / champ<input value={draft.agentOrChamp ?? ''} onChange={(e) => setDraft({ ...draft, agentOrChamp: e.target.value })} /></label>
                  </div>
                  <div className="nl-inline">
                    <label>K<input type="number" value={draft.kills ?? 0} onChange={(e) => setDraft({ ...draft, kills: Number(e.target.value) })} /></label>
                    <label>D<input type="number" value={draft.deaths ?? 0} onChange={(e) => setDraft({ ...draft, deaths: Number(e.target.value) })} /></label>
                    <label>A<input type="number" value={draft.assists ?? 0} onChange={(e) => setDraft({ ...draft, assists: Number(e.target.value) })} /></label>
                  </div>
                  <button type="button" className="primary" onClick={() => void addStat()}><Plus size={14} />Guardar stat</button>
                </div>
              </div>
            )}

            <div className="card">
              <div className="card-head"><h3>Objetivos semanales</h3></div>
              {!readonly && (
                <div className="nl-form" style={{ marginBottom: 12 }}>
                  <label>Título<input value={objDraft.title} onChange={(e) => setObjDraft({ ...objDraft, title: e.target.value })} /></label>
                  <div className="nl-inline">
                    <label>Semana<input type="date" value={objDraft.weekStart} onChange={(e) => setObjDraft({ ...objDraft, weekStart: e.target.value })} /></label>
                    <label>Alcance
                      <select value={objDraft.scope} onChange={(e) => setObjDraft({ ...objDraft, scope: e.target.value as 'team' | 'player' })}>
                        <option value="team">Equipo</option>
                        <option value="player">Jugador</option>
                      </select>
                    </label>
                  </div>
                  <div className="nl-inline">
                    <label>Antes<input value={objDraft.metricBefore ?? ''} onChange={(e) => setObjDraft({ ...objDraft, metricBefore: e.target.value })} /></label>
                    <label>Después<input value={objDraft.metricAfter ?? ''} onChange={(e) => setObjDraft({ ...objDraft, metricAfter: e.target.value })} /></label>
                  </div>
                  <button type="button" className="secondary" onClick={() => void addObjective()}><Plus size={14} />Objetivo</button>
                </div>
              )}
              <ul className="nl-plain-list">
                {objectives.map((o) => (
                  <li key={o.id}>
                    <b>{o.title}</b>
                    <span>{o.weekStart} · {o.scope} · {o.status}{o.metricBefore || o.metricAfter ? ` · ${o.metricBefore ?? '—'} → ${o.metricAfter ?? '—'}` : ''}</span>
                  </li>
                ))}
                {objectives.length === 0 && <li><span>Sin objetivos</span></li>}
              </ul>
            </div>
          </div>
        </>
      )}
    </NlPageShell>
  )
}
