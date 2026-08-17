import { useCallback, useEffect, useState } from 'react'
import { Plus, RefreshCw, Trash2 } from '@/components/icons'
import {
  deleteVod,
  listTeams,
  listVodNotes,
  listVods,
  saveVod,
  saveVodNote,
  type NlVod,
  type NlVodNote,
} from '@/services/neuraleague'
import { canMutateLeague } from '@/services/permissions'
import { isTauri } from '@/services/twitch'
import { useAuthStore } from '@/stores/auth-store'
import { toastError, toastSuccess } from '@/stores/toast-store'
import { NlPageShell } from './NeuraLeagueShell'

function formatTs(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function NeuraLeagueVodsPage() {
  const roles = useAuthStore((s) => s.roles)
  const login = useAuthStore((s) => s.session)?.login
  const readonly = !canMutateLeague(roles, login)

  const [vods, setVods] = useState<NlVod[]>([])
  const [teams, setTeams] = useState<Awaited<ReturnType<typeof listTeams>>>([])
  const [selected, setSelected] = useState<NlVod | null>(null)
  const [notes, setNotes] = useState<NlVodNote[]>([])
  const [noteDraft, setNoteDraft] = useState({ timestampSec: 0, body: '' })
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!isTauri) return
    setLoading(true)
    try {
      const [v, t] = await Promise.all([listVods(), listTeams()])
      setVods(v)
      setTeams(t)
      setSelected((prev) => (prev ? v.find((x) => x.id === prev.id) ?? v[0] ?? null : v[0] ?? null))
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Error al cargar VODs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!selected) {
      setNotes([])
      return
    }
    void listVodNotes(selected.id)
      .then(setNotes)
      .catch((err) => toastError(err instanceof Error ? err.message : 'Error notas'))
  }, [selected])

  const create = async () => {
    if (readonly) return
    try {
      const saved = await saveVod({
        title: 'Nuevo VOD',
        url: 'https://',
        kind: 'vod',
        notes: '',
        teamId: teams[0]?.id,
      })
      setSelected(saved)
      toastSuccess('VOD creado')
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo crear')
    }
  }

  const save = async () => {
    if (!selected || readonly) return
    try {
      const saved = await saveVod(selected)
      setSelected(saved)
      toastSuccess('VOD guardado')
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo guardar')
    }
  }

  const remove = async () => {
    if (!selected || readonly) return
    try {
      await deleteVod(selected.id)
      setSelected(null)
      toastSuccess('VOD archivado')
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo archivar')
    }
  }

  const addNote = async () => {
    if (!selected || readonly || !noteDraft.body.trim()) return
    try {
      await saveVodNote({ vodId: selected.id, ...noteDraft })
      setNoteDraft({ timestampSec: 0, body: '' })
      toastSuccess('Nota añadida')
      setNotes(await listVodNotes(selected.id))
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo añadir nota')
    }
  }

  return (
    <NlPageShell
      title="VODs"
      description="Biblioteca de VODs/demos y notas de review con timestamp."
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="secondary" onClick={() => void reload()}><RefreshCw size={15} />Actualizar</button>
          {!readonly && <button type="button" className="primary" onClick={() => void create()}><Plus size={15} />VOD</button>}
        </div>
      }
    >
      {loading ? <div className="card empty-state">Cargando…</div> : (
        <div className="nl-split">
          <div className="card">
            <div className="nl-list">
              {vods.map((v) => (
                <button key={v.id} type="button" className={selected?.id === v.id ? 'selected' : ''} onClick={() => setSelected(v)}>
                  <b>{v.title}</b>
                  <small>{v.kind}{v.mapName ? ` · ${v.mapName}` : ''}</small>
                </button>
              ))}
              {vods.length === 0 && <p className="empty-state">Sin VODs.</p>}
            </div>
          </div>

          <div className="card">
            {!selected ? <p className="empty-state">Selecciona un VOD.</p> : (
              <div className="nl-form">
                <label>Título<input disabled={readonly} value={selected.title} onChange={(e) => setSelected({ ...selected, title: e.target.value })} /></label>
                <label>URL<input disabled={readonly} value={selected.url} onChange={(e) => setSelected({ ...selected, url: e.target.value })} /></label>
                <label>Tipo
                  <select disabled={readonly} value={selected.kind} onChange={(e) => setSelected({ ...selected, kind: e.target.value as NlVod['kind'] })}>
                    {['vod', 'demo', 'clip', 'other'].map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </label>
                <label>Equipo
                  <select disabled={readonly} value={selected.teamId ?? ''} onChange={(e) => setSelected({ ...selected, teamId: e.target.value || undefined })}>
                    <option value="">—</option>
                    {teams.map((t) => <option key={t.id} value={t.id}>[{t.tag}] {t.name}</option>)}
                  </select>
                </label>
                <label>Mapa<input disabled={readonly} value={selected.mapName ?? ''} onChange={(e) => setSelected({ ...selected, mapName: e.target.value })} /></label>
                <label>Notas<textarea disabled={readonly} rows={3} value={selected.notes} onChange={(e) => setSelected({ ...selected, notes: e.target.value })} /></label>
                <a className="secondary" href={selected.url} target="_blank" rel="noreferrer" style={{ width: 'fit-content' }}>Abrir VOD</a>
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
            <div className="card-head"><h3>Notas de coach</h3></div>
            {!readonly && selected && (
              <div className="nl-form" style={{ marginBottom: 12 }}>
                <div className="nl-inline">
                  <label>Segundo<input type="number" value={noteDraft.timestampSec} onChange={(e) => setNoteDraft({ ...noteDraft, timestampSec: Number(e.target.value) })} /></label>
                  <label>Nota<input value={noteDraft.body} onChange={(e) => setNoteDraft({ ...noteDraft, body: e.target.value })} /></label>
                </div>
                <button type="button" className="secondary" onClick={() => void addNote()}><Plus size={14} />Nota</button>
              </div>
            )}
            <ul className="nl-plain-list">
              {notes.map((n) => (
                <li key={n.id}>
                  <b>{formatTs(n.timestampSec)}</b>
                  <span>{n.body}</span>
                </li>
              ))}
              {notes.length === 0 && <li><span>Sin notas de review</span></li>}
            </ul>
          </div>
        </div>
      )}
    </NlPageShell>
  )
}
