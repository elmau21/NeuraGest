import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, RefreshCw, Trash2 } from '@/components/icons'
import {
  deleteEvent,
  ensureEventChecklists,
  getMatchReport,
  listChecklistItems,
  listEventPlayerIds,
  listEvents,
  listPlayers,
  listTeams,
  saveEvent,
  saveMatchReport,
  setEventPlayers,
  toggleChecklistItem,
  type NlChecklistItem,
  type NlEvent,
  type NlMatchReport,
} from '@/services/neuraleague'
import { canMutateLeague } from '@/services/permissions'
import { isTauri } from '@/services/twitch'
import { useAuthStore } from '@/stores/auth-store'
import { toastError, toastSuccess } from '@/stores/toast-store'
import { NlPageShell } from './NeuraLeagueShell'

export function NeuraLeagueCalendarPage() {
  const roles = useAuthStore((s) => s.roles)
  const login = useAuthStore((s) => s.session)?.login
  const readonly = !canMutateLeague(roles, login)

  const [events, setEvents] = useState<NlEvent[]>([])
  const [teams, setTeams] = useState<Awaited<ReturnType<typeof listTeams>>>([])
  const [players, setPlayers] = useState<Awaited<ReturnType<typeof listPlayers>>>([])
  const [selected, setSelected] = useState<NlEvent | null>(null)
  const [eventPlayerIds, setEventPlayerIds] = useState<string[]>([])
  const [report, setReport] = useState<NlMatchReport | null>(null)
  const [checklistItems, setChecklistItems] = useState<NlChecklistItem[]>([])
  const [loading, setLoading] = useState(true)

  const teamName = useMemo(() => new Map(teams.map((t) => [t.id, `[${t.tag}] ${t.name}`])), [teams])

  const reload = useCallback(async () => {
    if (!isTauri) return
    setLoading(true)
    try {
      const [e, t, p] = await Promise.all([listEvents(), listTeams(), listPlayers()])
      setEvents(e)
      setTeams(t)
      setPlayers(p)
      setSelected((prev) => (prev ? e.find((x) => x.id === prev.id) ?? e[0] ?? null : e[0] ?? null))
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Error al cargar calendario')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDetail = useCallback(async (event: NlEvent) => {
    try {
      const [pids, rep, checklists] = await Promise.all([
        listEventPlayerIds(event.id),
        getMatchReport(event.id),
        ensureEventChecklists(event.id, event.teamId),
      ])
      setEventPlayerIds(pids)
      setReport(rep ?? {
        id: '',
        eventId: event.id,
        teamId: event.teamId,
        summary: '',
        whatWentWell: '',
        whatToImprove: '',
        individualNotes: '',
        nextFocus: '',
      })
      const items = (await Promise.all(checklists.map((c) => listChecklistItems(c.id)))).flat()
      setChecklistItems(items)
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Error al cargar detalle')
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (selected) void loadDetail(selected)
  }, [selected, loadDetail])

  const create = async () => {
    if (readonly) return
    try {
      const starts = new Date()
      starts.setMinutes(0, 0, 0)
      starts.setHours(starts.getHours() + 2)
      const saved = await saveEvent({
        title: 'Scrim',
        eventType: 'scrim',
        startsAt: starts.toISOString(),
        status: 'scheduled',
        notes: '',
        teamId: teams[0]?.id,
      })
      setSelected(saved)
      toastSuccess('Evento creado')
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo crear')
    }
  }

  const save = async () => {
    if (!selected || readonly) return
    try {
      const saved = await saveEvent(selected)
      await setEventPlayers(saved.id, eventPlayerIds)
      if (report) await saveMatchReport({ ...report, eventId: saved.id, teamId: saved.teamId })
      setSelected(saved)
      toastSuccess('Evento guardado')
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo guardar (¿solape de jugador?)')
    }
  }

  const remove = async () => {
    if (!selected || readonly) return
    try {
      await deleteEvent(selected.id)
      setSelected(null)
      toastSuccess('Evento archivado')
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo archivar')
    }
  }

  return (
    <NlPageShell
      title="Calendario"
      description="Scrims, partidos, checklists e informes post-partida."
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="secondary" onClick={() => void reload()}><RefreshCw size={15} />Actualizar</button>
          {!readonly && <button type="button" className="primary" onClick={() => void create()}><Plus size={15} />Evento</button>}
        </div>
      }
    >
      {loading ? <div className="card empty-state">Cargando…</div> : (
        <div className="nl-split">
          <div className="card">
            <div className="nl-list">
              {events.map((e) => (
                <button key={e.id} type="button" className={selected?.id === e.id ? 'selected' : ''} onClick={() => setSelected(e)}>
                  <b>{e.title}</b>
                  <small>{new Date(e.startsAt).toLocaleString('es-MX')} · {e.eventType} · {e.status}</small>
                </button>
              ))}
              {events.length === 0 && <p className="empty-state">Sin eventos.</p>}
            </div>
          </div>

          <div className="card">
            {!selected ? <p className="empty-state">Selecciona un evento.</p> : (
              <div className="nl-form">
                <label>Título<input disabled={readonly} value={selected.title} onChange={(e) => setSelected({ ...selected, title: e.target.value })} /></label>
                <label>Tipo
                  <select disabled={readonly} value={selected.eventType} onChange={(e) => setSelected({ ...selected, eventType: e.target.value as NlEvent['eventType'] })}>
                    {['scrim', 'match', 'training', 'review', 'tryout', 'other'].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label>Equipo
                  <select disabled={readonly} value={selected.teamId ?? ''} onChange={(e) => setSelected({ ...selected, teamId: e.target.value || undefined })}>
                    <option value="">—</option>
                    {teams.map((t) => <option key={t.id} value={t.id}>{teamName.get(t.id)}</option>)}
                  </select>
                </label>
                <label>Rival<input disabled={readonly} value={selected.opponent ?? ''} onChange={(e) => setSelected({ ...selected, opponent: e.target.value })} /></label>
                <label>Inicio<input type="datetime-local" disabled={readonly} value={selected.startsAt.slice(0, 16)} onChange={(e) => setSelected({ ...selected, startsAt: new Date(e.target.value).toISOString() })} /></label>
                <label>Fin<input type="datetime-local" disabled={readonly} value={selected.endsAt?.slice(0, 16) ?? ''} onChange={(e) => setSelected({ ...selected, endsAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} /></label>
                <label>Estado
                  <select disabled={readonly} value={selected.status} onChange={(e) => setSelected({ ...selected, status: e.target.value as NlEvent['status'] })}>
                    {['scheduled', 'live', 'done', 'cancelled', 'no_show'].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label>Jugadores convocados
                  <select
                    multiple
                    disabled={readonly}
                    value={eventPlayerIds}
                    onChange={(e) => setEventPlayerIds(Array.from(e.target.selectedOptions).map((o) => o.value))}
                    style={{ minHeight: 100 }}
                  >
                    {players.map((p) => <option key={p.id} value={p.id}>{p.nickname}</option>)}
                  </select>
                </label>
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
            <div className="card-head"><h3>Checklists</h3></div>
            <ul className="nl-check-list">
              {checklistItems.map((item) => (
                <li key={item.id}>
                  <label>
                    <input
                      type="checkbox"
                      disabled={readonly}
                      checked={item.done}
                      onChange={(e) => {
                        const done = e.target.checked
                        setChecklistItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, done } : x)))
                        void toggleChecklistItem(item.id, done).catch((err) => toastError(err instanceof Error ? err.message : 'Error'))
                      }}
                    />
                    {item.label}
                  </label>
                </li>
              ))}
            </ul>
            <div className="card-head" style={{ marginTop: 16 }}><h3>Informe post-partida</h3></div>
            {report && (
              <div className="nl-form">
                <div className="nl-inline">
                  <label>Nosotros<input disabled={readonly} value={report.scoreUs ?? ''} onChange={(e) => setReport({ ...report, scoreUs: e.target.value })} /></label>
                  <label>Ellos<input disabled={readonly} value={report.scoreThem ?? ''} onChange={(e) => setReport({ ...report, scoreThem: e.target.value })} /></label>
                </div>
                <label>Resumen<textarea disabled={readonly} rows={2} value={report.summary} onChange={(e) => setReport({ ...report, summary: e.target.value })} /></label>
                <label>Qué salió bien<textarea disabled={readonly} rows={2} value={report.whatWentWell} onChange={(e) => setReport({ ...report, whatWentWell: e.target.value })} /></label>
                <label>Qué mejorar<textarea disabled={readonly} rows={2} value={report.whatToImprove} onChange={(e) => setReport({ ...report, whatToImprove: e.target.value })} /></label>
                <label>Próximo foco<textarea disabled={readonly} rows={2} value={report.nextFocus} onChange={(e) => setReport({ ...report, nextFocus: e.target.value })} /></label>
              </div>
            )}
          </div>
        </div>
      )}
    </NlPageShell>
  )
}
