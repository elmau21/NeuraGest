import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, RefreshCw } from '@/components/icons'
import {
  listAttendance,
  listAvailability,
  listIncidents,
  listPlayers,
  listPracticeBlocks,
  listTeams,
  listTrainings,
  saveAttendance,
  saveAvailability,
  saveIncident,
  savePracticeBlock,
  saveTraining,
  type NlIncident,
  type NlPracticeBlock,
  type NlTraining,
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

export function NeuraLeagueTrainingPage() {
  const roles = useAuthStore((s) => s.roles)
  const login = useAuthStore((s) => s.session)?.login
  const readonly = !canMutateLeague(roles, login)

  const [trainings, setTrainings] = useState<NlTraining[]>([])
  const [teams, setTeams] = useState<Awaited<ReturnType<typeof listTeams>>>([])
  const [players, setPlayers] = useState<Awaited<ReturnType<typeof listPlayers>>>([])
  const [blocks, setBlocks] = useState<NlPracticeBlock[]>([])
  const [attendance, setAttendance] = useState<Awaited<ReturnType<typeof listAttendance>>>([])
  const [availability, setAvailability] = useState<Awaited<ReturnType<typeof listAvailability>>>([])
  const [incidents, setIncidents] = useState<NlIncident[]>([])
  const [selected, setSelected] = useState<NlTraining | null>(null)
  const [loading, setLoading] = useState(true)

  const playerName = useMemo(() => new Map(players.map((p) => [p.id, p.nickname])), [players])

  const reload = useCallback(async () => {
    if (!isTauri) return
    setLoading(true)
    try {
      const [tr, t, p, a, i] = await Promise.all([
        listTrainings(),
        listTeams(),
        listPlayers(),
        listAvailability(),
        listIncidents(),
      ])
      setTrainings(tr)
      setTeams(t)
      setPlayers(p)
      setAvailability(a)
      setIncidents(i)
      setSelected((prev) => (prev ? tr.find((x) => x.id === prev.id) ?? tr[0] ?? null : tr[0] ?? null))
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Error al cargar entrenamientos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!selected) return
    void Promise.all([listPracticeBlocks(selected.id), listAttendance(selected.id)])
      .then(([b, att]) => {
        setBlocks(b)
        setAttendance(att)
      })
      .catch((err) => toastError(err instanceof Error ? err.message : 'Error detalle'))
  }, [selected])

  const create = async () => {
    if (readonly) return
    try {
      const starts = new Date()
      starts.setMinutes(0, 0, 0)
      starts.setHours(starts.getHours() + 1)
      const saved = await saveTraining({
        title: 'Entrenamiento',
        startsAt: starts.toISOString(),
        status: 'scheduled',
        notes: '',
        teamId: teams[0]?.id,
      })
      setSelected(saved)
      toastSuccess('Entrenamiento creado')
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo crear')
    }
  }

  const save = async () => {
    if (!selected || readonly) return
    try {
      const saved = await saveTraining(selected)
      setSelected(saved)
      toastSuccess('Guardado')
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo guardar')
    }
  }

  const addBlock = async (blockType: NlPracticeBlock['blockType']) => {
    if (!selected || readonly) return
    try {
      await savePracticeBlock({
        trainingId: selected.id,
        blockType,
        title: blockType,
        sortOrder: blocks.length,
        notes: '',
      })
      setBlocks(await listPracticeBlocks(selected.id))
      toastSuccess('Bloque añadido')
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Error bloque')
    }
  }

  const markAttendance = async (playerId: string, status: 'present' | 'late' | 'absent' | 'excused') => {
    if (!selected || readonly) return
    try {
      await saveAttendance({ trainingId: selected.id, playerId, status })
      setAttendance(await listAttendance(selected.id))
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Error asistencia')
    }
  }

  const seedAvailability = async () => {
    if (readonly || !players[0]) return
    try {
      await saveAvailability({
        playerId: players[0].id,
        weekStart: weekStartIso(),
        slots: { lun: 'tarde', mie: 'noche', vie: 'tarde' },
        notes: '',
      })
      toastSuccess('Disponibilidad guardada')
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Error disponibilidad')
    }
  }

  const addIncident = async () => {
    if (readonly) return
    try {
      await saveIncident({
        title: 'Incidencia',
        kind: 'no_show',
        severity: 'low',
        body: '',
        playerId: players[0]?.id,
        teamId: teams[0]?.id,
      })
      toastSuccess('Incidencia registrada')
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Error incidencia')
    }
  }

  return (
    <NlPageShell
      title="Entrenamientos"
      description="Agenda, bloques, asistencia, disponibilidad e incidencias."
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="secondary" onClick={() => void reload()}><RefreshCw size={15} />Actualizar</button>
          {!readonly && <button type="button" className="primary" onClick={() => void create()}><Plus size={15} />Sesión</button>}
        </div>
      }
    >
      {loading ? <div className="card empty-state">Cargando…</div> : (
        <div className="nl-split">
          <div className="card">
            <div className="nl-list">
              {trainings.map((t) => (
                <button key={t.id} type="button" className={selected?.id === t.id ? 'selected' : ''} onClick={() => setSelected(t)}>
                  <b>{t.title}</b>
                  <small>{new Date(t.startsAt).toLocaleString('es-MX')} · {t.status}</small>
                </button>
              ))}
              {trainings.length === 0 && <p className="empty-state">Sin sesiones.</p>}
            </div>
          </div>

          <div className="card">
            {!selected ? <p className="empty-state">Selecciona una sesión.</p> : (
              <div className="nl-form">
                <label>Título<input disabled={readonly} value={selected.title} onChange={(e) => setSelected({ ...selected, title: e.target.value })} /></label>
                <label>Inicio<input type="datetime-local" disabled={readonly} value={selected.startsAt.slice(0, 16)} onChange={(e) => setSelected({ ...selected, startsAt: new Date(e.target.value).toISOString() })} /></label>
                <label>Equipo
                  <select disabled={readonly} value={selected.teamId ?? ''} onChange={(e) => setSelected({ ...selected, teamId: e.target.value || undefined })}>
                    <option value="">—</option>
                    {teams.map((t) => <option key={t.id} value={t.id}>[{t.tag}] {t.name}</option>)}
                  </select>
                </label>
                <label>Notas<textarea disabled={readonly} rows={3} value={selected.notes} onChange={(e) => setSelected({ ...selected, notes: e.target.value })} /></label>
                {!readonly && <button type="button" className="primary" onClick={() => void save()}>Guardar</button>}

                <div className="card-head" style={{ marginTop: 8 }}><h3>Bloques</h3></div>
                {!readonly && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(['aim', 'strats', 'review', 'scrim', 'vod'] as const).map((b) => (
                      <button key={b} type="button" className="secondary" onClick={() => void addBlock(b)}>{b}</button>
                    ))}
                  </div>
                )}
                <ul className="nl-plain-list">
                  {blocks.map((b) => <li key={b.id}><b>{b.title}</b><span>{b.blockType}{b.durationMin ? ` · ${b.durationMin} min` : ''}</span></li>)}
                </ul>

                <div className="card-head" style={{ marginTop: 8 }}><h3>Asistencia</h3></div>
                <ul className="nl-plain-list">
                  {players.slice(0, 12).map((p) => {
                    const row = attendance.find((a) => a.playerId === p.id)
                    return (
                      <li key={p.id}>
                        <b>{p.nickname}</b>
                        <span>{row?.status ?? 'sin marcar'}</span>
                        {!readonly && (
                          <select
                            value={row?.status ?? ''}
                            onChange={(e) => void markAttendance(p.id, e.target.value as 'present' | 'late' | 'absent' | 'excused')}
                          >
                            <option value="" disabled>—</option>
                            {['present', 'late', 'absent', 'excused'].map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Disponibilidad semanal</h3>
              {!readonly && <button type="button" className="secondary" onClick={() => void seedAvailability()}>Registrar</button>}
            </div>
            <ul className="nl-plain-list">
              {availability.map((a) => (
                <li key={a.id}>
                  <b>{playerName.get(a.playerId) ?? a.playerId}</b>
                  <span>semana {a.weekStart} · {JSON.stringify(a.slots)}</span>
                </li>
              ))}
              {availability.length === 0 && <li><span>Sin disponibilidad cargada</span></li>}
            </ul>

            <div className="card-head" style={{ marginTop: 16 }}>
              <h3>Incidencias</h3>
              {!readonly && <button type="button" className="secondary" onClick={() => void addIncident()}><Plus size={14} />Incidencia</button>}
            </div>
            <ul className="nl-plain-list">
              {incidents.map((i) => (
                <li key={i.id}>
                  <b>{i.title}</b>
                  <span>{i.kind} · {i.severity} · {new Date(i.occurredAt).toLocaleDateString('es-MX')}</span>
                </li>
              ))}
              {incidents.length === 0 && <li><span>Sin incidencias</span></li>}
            </ul>
          </div>
        </div>
      )}
    </NlPageShell>
  )
}
