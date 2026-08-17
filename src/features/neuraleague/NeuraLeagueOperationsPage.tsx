import { useCallback, useEffect, useState } from 'react'
import { Plus, RefreshCw } from '@/components/icons'
import {
  listAnnouncements,
  listLeagueTasks,
  listTeams,
  saveAnnouncement,
  saveLeagueTask,
  type NlAnnouncement,
  type NlTask,
} from '@/services/neuraleague'
import { canMutateLeague } from '@/services/permissions'
import { isTauri } from '@/services/twitch'
import { useAuthStore } from '@/stores/auth-store'
import { toastError, toastSuccess } from '@/stores/toast-store'
import { NlPageShell } from './NeuraLeagueShell'

export function NeuraLeagueOperationsPage() {
  const roles = useAuthStore((s) => s.roles)
  const login = useAuthStore((s) => s.session)?.login
  const readonly = !canMutateLeague(roles, login)

  const [tasks, setTasks] = useState<NlTask[]>([])
  const [announcements, setAnnouncements] = useState<NlAnnouncement[]>([])
  const [teams, setTeams] = useState<Awaited<ReturnType<typeof listTeams>>>([])
  const [taskDraft, setTaskDraft] = useState({ title: '', kind: 'general' as NlTask['kind'], description: '' })
  const [annDraft, setAnnDraft] = useState({ title: '', body: '', pinned: false })
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!isTauri) return
    setLoading(true)
    try {
      const [t, a, teamsRows] = await Promise.all([listLeagueTasks(), listAnnouncements(), listTeams()])
      setTasks(t)
      setAnnouncements(a)
      setTeams(teamsRows)
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Error operación')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const addTask = async () => {
    if (readonly || !taskDraft.title.trim()) return
    try {
      await saveLeagueTask({
        title: taskDraft.title,
        kind: taskDraft.kind,
        description: taskDraft.description,
        status: 'todo',
        teamId: teams[0]?.id,
      })
      setTaskDraft({ title: '', kind: 'general', description: '' })
      toastSuccess('Tarea creada')
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Error tarea')
    }
  }

  const setTaskStatus = async (task: NlTask, status: NlTask['status']) => {
    if (readonly) return
    try {
      await saveLeagueTask({ ...task, status })
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Error estado')
    }
  }

  const addAnnouncement = async () => {
    if (readonly || !annDraft.title.trim()) return
    try {
      await saveAnnouncement({
        title: annDraft.title,
        body: annDraft.body,
        pinned: annDraft.pinned,
        teamId: teams[0]?.id,
      })
      setAnnDraft({ title: '', body: '', pinned: false })
      toastSuccess('Anuncio publicado')
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Error anuncio')
    }
  }

  return (
    <NlPageShell
      title="Operación"
      description="Tareas, responsables y anuncios internos del equipo."
      action={<button type="button" className="secondary" onClick={() => void reload()}><RefreshCw size={15} />Actualizar</button>}
    >
      {loading ? <div className="card empty-state">Cargando…</div> : (
        <div className="nl-split-2">
          <div className="card">
            <div className="card-head"><h3>Tareas</h3></div>
            {!readonly && (
              <div className="nl-form" style={{ marginBottom: 12 }}>
                <label>Título<input value={taskDraft.title} onChange={(e) => setTaskDraft({ ...taskDraft, title: e.target.value })} /></label>
                <label>Tipo
                  <select value={taskDraft.kind} onChange={(e) => setTaskDraft({ ...taskDraft, kind: e.target.value as NlTask['kind'] })}>
                    {['general', 'scrim', 'vod', 'announce', 'checklist', 'other'].map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </label>
                <label>Detalle<textarea rows={2} value={taskDraft.description} onChange={(e) => setTaskDraft({ ...taskDraft, description: e.target.value })} /></label>
                <button type="button" className="primary" onClick={() => void addTask()}><Plus size={14} />Tarea</button>
              </div>
            )}
            <ul className="nl-plain-list">
              {tasks.map((t) => (
                <li key={t.id}>
                  <b>{t.title}</b>
                  <span>{t.kind} · {t.status}</span>
                  {!readonly && (
                    <select value={t.status} onChange={(e) => void setTaskStatus(t, e.target.value as NlTask['status'])}>
                      {['todo', 'doing', 'done', 'cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                </li>
              ))}
              {tasks.length === 0 && <li><span>Sin tareas</span></li>}
            </ul>
          </div>

          <div className="card">
            <div className="card-head"><h3>Anuncios internos</h3></div>
            {!readonly && (
              <div className="nl-form" style={{ marginBottom: 12 }}>
                <label>Título<input value={annDraft.title} onChange={(e) => setAnnDraft({ ...annDraft, title: e.target.value })} /></label>
                <label>Cuerpo<textarea rows={3} value={annDraft.body} onChange={(e) => setAnnDraft({ ...annDraft, body: e.target.value })} /></label>
                <label className="toggle-row">
                  <span>Fijado</span>
                  <input type="checkbox" checked={annDraft.pinned} onChange={(e) => setAnnDraft({ ...annDraft, pinned: e.target.checked })} />
                </label>
                <button type="button" className="primary" onClick={() => void addAnnouncement()}><Plus size={14} />Publicar</button>
              </div>
            )}
            <ul className="nl-plain-list">
              {announcements.map((a) => (
                <li key={a.id}>
                  <b>{a.pinned ? '[Fijado] ' : ''}{a.title}</b>
                  <span>{new Date(a.publishedAt).toLocaleString('es-MX')} · {a.body.slice(0, 120)}</span>
                </li>
              ))}
              {announcements.length === 0 && <li><span>Sin anuncios</span></li>}
            </ul>
          </div>
        </div>
      )}
    </NlPageShell>
  )
}
