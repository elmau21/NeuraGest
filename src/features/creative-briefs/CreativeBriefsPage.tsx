import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  Check,
  ClipboardList,
  FolderPlus,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { listDbTalents, listSponsorshipDeals, type DbTalent, type SponsorshipDeal } from '@/services/agency'
import { listCalendarEventsOps } from '@/services/ops'
import {
  buildDesignBriefDraft,
  deleteDesignBrief,
  ensureBriefDriveFolder,
  listDesignBriefs,
  saveDesignBrief,
  upcomingStreamEvents,
  type DesignBrief,
} from '@/services/design-briefs'
import { isTauri } from '@/services/twitch'
import { canMutateDesign } from '@/services/permissions'
import { useAuthStore } from '@/stores/auth-store'
import { toastError, toastSuccess } from '@/stores/toast-store'

export function CreativeBriefsPage() {
  const navigate = useNavigate()
  const roles = useAuthStore((s) => s.roles)
  const session = useAuthStore((s) => s.session)
  const readonly = !canMutateDesign(roles, session?.login)

  const [briefs, setBriefs] = useState<DesignBrief[]>([])
  const [talents, setTalents] = useState<DbTalent[]>([])
  const [deals, setDeals] = useState<SponsorshipDeal[]>([])
  const [upcoming, setUpcoming] = useState<ReturnType<typeof upcomingStreamEvents>>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<DesignBrief | null>(null)
  const [error, setError] = useState<string | null>(null)

  const talentById = useMemo(() => new Map(talents.map((t) => [t.id, t])), [talents])
  const talentByLogin = useMemo(
    () => new Map(talents.map((t) => [t.login.toLowerCase(), t])),
    [talents],
  )

  const reload = useCallback(async () => {
    if (!isTauri) return
    setLoading(true)
    setError(null)
    try {
      const [briefRows, dbTalents, dealRows, events] = await Promise.all([
        listDesignBriefs().catch((err) => {
          throw err
        }),
        listDbTalents().catch(() => []),
        listSponsorshipDeals().catch(() => []),
        listCalendarEventsOps().catch(() => []),
      ])
      setBriefs(briefRows)
      setTalents(dbTalents)
      setDeals(dealRows)
      setUpcoming(upcomingStreamEvents(events).slice(0, 12))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const generateFromEvent = async (eventId: string) => {
    if (readonly) return
    const event = upcoming.find((e) => e.id === eventId)
    if (!event) return
    setBusy(true)
    try {
      const talent =
        (event.talentId ? talentById.get(event.talentId) : undefined)
        ?? (event.talentLogin ? talentByLogin.get(event.talentLogin.toLowerCase()) : undefined)
      const draft = buildDesignBriefDraft({ event, talent, deals })
      const existing = briefs.find((b) => b.calendarEventId === event.id)
      const saved = await saveDesignBrief({
        ...draft,
        id: existing?.id,
        status: existing?.status ?? 'draft',
        driveFolderId: existing?.driveFolderId,
      })
      toastSuccess(existing ? 'Brief actualizado' : 'Brief generado')
      setSelected(saved)
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo generar el brief')
    } finally {
      setBusy(false)
    }
  }

  const saveSelected = async () => {
    if (!selected || readonly) return
    setBusy(true)
    try {
      const saved = await saveDesignBrief(selected)
      setSelected(saved)
      toastSuccess('Brief guardado')
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setBusy(false)
    }
  }

  const createFolder = async () => {
    if (!selected || readonly) return
    setBusy(true)
    try {
      const talent =
        (selected.talentId ? talentById.get(selected.talentId) : undefined)
        ?? (selected.talentLogin ? talentByLogin.get(selected.talentLogin.toLowerCase()) : undefined)
      const { brief, folder } = await ensureBriefDriveFolder(
        selected,
        talent?.displayName ?? selected.talentLogin ?? 'Talento',
      )
      setSelected(brief)
      toastSuccess('Carpeta creada en Drive')
      await reload()
      navigate(`/diseno?folder=${folder.id}`)
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo crear la carpeta')
    } finally {
      setBusy(false)
    }
  }

  const removeBrief = async (id: string) => {
    if (readonly) return
    if (!window.confirm('¿Eliminar este brief creativo?')) return
    setBusy(true)
    try {
      await deleteDesignBrief(id)
      if (selected?.id === id) setSelected(null)
      toastSuccess('Brief eliminado')
      await reload()
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo eliminar')
    } finally {
      setBusy(false)
    }
  }

  if (!isTauri) {
    return (
      <div className="card agency-gate">
        <p>Briefs creativos requieren la app de escritorio NeuraGest.</p>
      </div>
    )
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Briefs creativos</h1>
          <p>Textos y checklist de assets a partir de próximos streams y collabs.</p>
        </div>
        <div className="page-actions">
          <button className="secondary" disabled={loading || busy} onClick={() => void reload()}>
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {readonly && (
        <p className="integration-note staff-readonly-banner">
          Modo solo lectura: puedes ver briefs, pero no generar ni editar.
        </p>
      )}
      {error && <p className="integration-note">{error}</p>}

      <div className="dg-briefs-layout">
        <section className="card dg-briefs-side">
          <h3><CalendarDays size={15} /> Próximos briefs</h3>
          {loading ? (
            <p className="empty-state">Cargando agenda…</p>
          ) : upcoming.length === 0 ? (
            <p className="empty-state">No hay streams próximos en el calendario.</p>
          ) : (
            <ul className="dg-upcoming-list">
              {upcoming.map((ev) => {
                const hasBrief = briefs.some((b) => b.calendarEventId === ev.id)
                const when = new Date(ev.startsAt).toLocaleString('es-MX', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
                return (
                  <li key={ev.id}>
                    <div>
                      <b>{ev.title}</b>
                      <small>
                        {when}
                        {ev.talentLogin ? ` · @${ev.talentLogin}` : ''}
                        {hasBrief ? ' · brief listo' : ''}
                      </small>
                    </div>
                    {!readonly && (
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() => void generateFromEvent(ev.id)}
                      >
                        <Sparkles size={14} /> {hasBrief ? 'Actualizar' : 'Generar'}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          <h3 className="dg-briefs-saved-title"><ClipboardList size={15} /> Guardados</h3>
          {briefs.length === 0 ? (
            <p className="empty-state">Aún no hay briefs creativos.</p>
          ) : (
            <ul className="dg-brief-list">
              {briefs.map((b) => (
                <li key={b.id} className={selected?.id === b.id ? 'is-active' : undefined}>
                  <button type="button" onClick={() => setSelected(b)}>
                    <b>{b.title}</b>
                    <small>
                      {b.streamStartsAt
                        ? new Date(b.streamStartsAt).toLocaleString('es-MX', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Sin fecha'}
                      {' · '}
                      {b.status === 'done' ? 'Hecho' : b.status === 'ready' ? 'Listo' : 'Borrador'}
                    </small>
                  </button>
                  {!readonly && (
                    <button
                      type="button"
                      className="icon-btn"
                      title="Eliminar"
                      onClick={() => void removeBrief(b.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card dg-briefs-editor">
          {!selected ? (
            <div className="cd-empty">
              <ClipboardList size={36} />
              <b>Elige o genera un brief</b>
              <span>Partimos del calendario: título del stream, talento y collabs CRM si hay.</span>
            </div>
          ) : (
            <>
              <label>
                Título
                <input
                  value={selected.title}
                  disabled={readonly}
                  onChange={(e) => setSelected({ ...selected, title: e.target.value })}
                />
              </label>
              <label>
                Brief para diseño
                <textarea
                  rows={14}
                  value={selected.body}
                  disabled={readonly}
                  onChange={(e) => setSelected({ ...selected, body: e.target.value })}
                />
              </label>
              <div className="dg-checklist">
                <b>Checklist de assets</b>
                <ul>
                  {selected.assetChecklist.map((item) => (
                    <li key={item}><Check size={13} /> {item}</li>
                  ))}
                </ul>
              </div>
              <label>
                Estado
                <select
                  value={selected.status}
                  disabled={readonly}
                  onChange={(e) => setSelected({
                    ...selected,
                    status: e.target.value as DesignBrief['status'],
                  })}
                >
                  <option value="draft">Borrador</option>
                  <option value="ready">Listo para diseñar</option>
                  <option value="done">Entregado</option>
                </select>
              </label>
              <div className="agency-modal-actions dg-brief-actions">
                {!readonly && (
                  <>
                    <button className="secondary" disabled={busy} onClick={() => void createFolder()}>
                      <FolderPlus size={15} /> Carpeta en Drive
                    </button>
                    <button className="primary" disabled={busy} onClick={() => void saveSelected()}>
                      Guardar
                    </button>
                  </>
                )}
                {selected.driveFolderId && (
                  <button
                    className="secondary"
                    onClick={() => navigate(`/diseno?folder=${selected.driveFolderId}`)}
                  >
                    Abrir carpeta
                  </button>
                )}
                <button className="secondary" onClick={() => navigate('/assets')}>
                  Ir a Assets
                </button>
                <button className="secondary" onClick={() => navigate('/handoff')}>
                  Ir a Handoff
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  )
}
