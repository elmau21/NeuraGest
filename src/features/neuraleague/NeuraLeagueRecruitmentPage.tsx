import { useCallback, useEffect, useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import {
  listCandidates,
  listTrialEvals,
  listTryouts,
  saveCandidate,
  saveTrialEval,
  saveTryout,
  type NlCandidate,
  type NlTrialEval,
  type NlTryout,
} from '@/services/neuraleague'
import { canMutateLeague } from '@/services/permissions'
import { isTauri } from '@/services/twitch'
import { useAuthStore } from '@/stores/auth-store'
import { toastError, toastSuccess } from '@/stores/toast-store'
import { NlPageShell } from './NeuraLeagueShell'

const STAGES: NlCandidate['pipelineStage'][] = [
  'applied', 'screening', 'trial', 'decision', 'accepted', 'rejected', 'waitlist',
]

const STAGE_LABEL: Record<NlCandidate['pipelineStage'], string> = {
  applied: 'Aplicado',
  screening: 'Filtro',
  trial: 'Prueba',
  decision: 'Decisión',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  waitlist: 'Lista espera',
}

export function NeuraLeagueRecruitmentPage() {
  const roles = useAuthStore((s) => s.roles)
  const login = useAuthStore((s) => s.session)?.login
  const readonly = !canMutateLeague(roles, login)

  const [tryouts, setTryouts] = useState<NlTryout[]>([])
  const [candidates, setCandidates] = useState<NlCandidate[]>([])
  const [selected, setSelected] = useState<NlCandidate | null>(null)
  const [evals, setEvals] = useState<NlTrialEval[]>([])
  const [evalDraft, setEvalDraft] = useState({ score: 7, body: '', recommendation: 'retrial' as NlTrialEval['recommendation'] })
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!isTauri) return
    setLoading(true)
    try {
      const [t, c] = await Promise.all([listTryouts(), listCandidates()])
      setTryouts(t)
      setCandidates(c)
      setSelected((prev) => (prev ? c.find((x) => x.id === prev.id) ?? c[0] ?? null : c[0] ?? null))
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Error reclutamiento')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!selected) {
      setEvals([])
      return
    }
    void listTrialEvals(selected.id).then(setEvals).catch(() => setEvals([]))
  }, [selected])

  const createTryout = async () => {
    if (readonly) return
    try {
      await saveTryout({
        title: 'Tryout abierto',
        status: 'open',
        description: 'Pruebas abiertas NeuraLeague',
        contactChannel: 'Discord',
      })
      toastSuccess('Tryout creado')
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Error tryout')
    }
  }

  const createCandidate = async () => {
    if (readonly) return
    try {
      const saved = await saveCandidate({
        nickname: 'Candidato',
        pipelineStage: 'applied',
        notes: '',
        socials: {},
        scouting: false,
        tryoutId: tryouts[0]?.id,
        contactChannel: 'Discord',
      })
      setSelected(saved)
      toastSuccess('Candidato añadido')
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Error candidato')
    }
  }

  const save = async () => {
    if (!selected || readonly) return
    try {
      const saved = await saveCandidate(selected)
      setSelected(saved)
      toastSuccess('Candidato guardado')
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo guardar')
    }
  }

  const addEval = async () => {
    if (!selected || readonly) return
    try {
      await saveTrialEval({
        candidateId: selected.id,
        score: evalDraft.score,
        body: evalDraft.body,
        recommendation: evalDraft.recommendation,
      })
      toastSuccess('Evaluación guardada')
      setEvals(await listTrialEvals(selected.id))
      setEvalDraft({ score: 7, body: '', recommendation: 'retrial' })
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Error evaluación')
    }
  }

  return (
    <NlPageShell
      title="Reclutamiento"
      description="Tryouts, pipeline de candidatos, scouting y evaluaciones."
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="secondary" onClick={() => void reload()}><RefreshCw size={15} />Actualizar</button>
          {!readonly && (
            <>
              <button type="button" className="secondary" onClick={() => void createTryout()}>Tryout</button>
              <button type="button" className="primary" onClick={() => void createCandidate()}><Plus size={15} />Candidato</button>
            </>
          )}
        </div>
      }
    >
      {loading ? <div className="card empty-state">Cargando…</div> : (
        <>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-head"><h3>Tryouts</h3></div>
            <ul className="nl-plain-list">
              {tryouts.map((t) => (
                <li key={t.id}><b>{t.title}</b><span>{t.status}{t.contactChannel ? ` · ${t.contactChannel}` : ''}</span></li>
              ))}
              {tryouts.length === 0 && <li><span>Sin tryouts abiertos</span></li>}
            </ul>
          </div>

          <div className="nl-pipeline">
            {STAGES.map((stage) => {
              const cols = candidates.filter((c) => c.pipelineStage === stage)
              return (
                <div key={stage} className="nl-pipeline-col">
                  <div className="column-head"><span>{STAGE_LABEL[stage]}</span><b>{cols.length}</b></div>
                  {cols.map((c) => (
                    <button key={c.id} type="button" className={`task-card${selected?.id === c.id ? ' selected' : ''}`} onClick={() => setSelected(c)}>
                      <h4>{c.nickname}</h4>
                      <p>{c.roleInterest ?? 'sin rol'}{c.scouting ? ' · scouting' : ''}</p>
                    </button>
                  ))}
                </div>
              )
            })}
          </div>

          <div className="nl-split" style={{ marginTop: 14 }}>
            <div className="card">
              {!selected ? <p className="empty-state">Selecciona un candidato.</p> : (
                <div className="nl-form">
                  <label>Nickname<input disabled={readonly} value={selected.nickname} onChange={(e) => setSelected({ ...selected, nickname: e.target.value })} /></label>
                  <label>Contacto<input disabled={readonly} value={selected.contact ?? ''} onChange={(e) => setSelected({ ...selected, contact: e.target.value })} /></label>
                  <label>Canal<input disabled={readonly} value={selected.contactChannel ?? ''} onChange={(e) => setSelected({ ...selected, contactChannel: e.target.value })} /></label>
                  <label>Rol interés<input disabled={readonly} value={selected.roleInterest ?? ''} onChange={(e) => setSelected({ ...selected, roleInterest: e.target.value })} /></label>
                  <label>Etapa
                    <select disabled={readonly} value={selected.pipelineStage} onChange={(e) => setSelected({ ...selected, pipelineStage: e.target.value as NlCandidate['pipelineStage'] })}>
                      {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
                    </select>
                  </label>
                  <label className="toggle-row">
                    <span>Lista de interés / scouting</span>
                    <input type="checkbox" disabled={readonly} checked={selected.scouting} onChange={(e) => setSelected({ ...selected, scouting: e.target.checked })} />
                  </label>
                  <label>Notas<textarea disabled={readonly} rows={4} value={selected.notes} onChange={(e) => setSelected({ ...selected, notes: e.target.value })} /></label>
                  {!readonly && <button type="button" className="primary" onClick={() => void save()}>Guardar</button>}
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-head"><h3>Evaluaciones de trial</h3></div>
              {!readonly && selected && (
                <div className="nl-form" style={{ marginBottom: 12 }}>
                  <div className="nl-inline">
                    <label>Score<input type="number" min={1} max={10} value={evalDraft.score} onChange={(e) => setEvalDraft({ ...evalDraft, score: Number(e.target.value) })} /></label>
                    <label>Recomendación
                      <select value={evalDraft.recommendation ?? 'retrial'} onChange={(e) => setEvalDraft({ ...evalDraft, recommendation: e.target.value as NlTrialEval['recommendation'] })}>
                        {['accept', 'reject', 'waitlist', 'retrial'].map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </label>
                  </div>
                  <label>Comentario<textarea rows={3} value={evalDraft.body} onChange={(e) => setEvalDraft({ ...evalDraft, body: e.target.value })} /></label>
                  <button type="button" className="secondary" onClick={() => void addEval()}><Plus size={14} />Evaluación</button>
                </div>
              )}
              <ul className="nl-plain-list">
                {evals.map((ev) => (
                  <li key={ev.id}>
                    <b>{ev.score ?? '—'}/10 · {ev.recommendation ?? '—'}</b>
                    <span>{ev.body || 'Sin comentario'}</span>
                  </li>
                ))}
                {evals.length === 0 && <li><span>Sin evaluaciones</span></li>}
              </ul>
            </div>
          </div>
        </>
      )}
    </NlPageShell>
  )
}
