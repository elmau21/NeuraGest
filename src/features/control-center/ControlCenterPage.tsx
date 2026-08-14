import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  Award,
  Bell,
  Brain,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Database,
  LayoutTemplate,
  ListChecks,
  ListTodo,
  Paintbrush,
  Radio,
  Scan,
  Settings,
  Shield,
  StickyNote,
  UserCheck,
  Users,
  Volume2,
  AlertTriangle,
  MessageSquare,
  UserCog,
} from 'lucide-react'
import { ActiveUsersPanel } from '@/features/presence/ActiveUsersPanel'
import { PermissionsPanel } from '@/features/settings/PermissionsPanel'
import { fetchAuditActivity } from '@/services/audit'
import type { ActivityItem } from '@/services/activity'
import { canAssignStrongRoles, canManageAppRoles, STRONG_APP_ROLES } from '@/services/permissions'
import {
  listEvents,
  listTryouts,
  listVods,
  listContracts,
} from '@/services/neuraleague'
import type { NlEvent, NlTryout, NlVod } from '@/services/neuraleague/types'
import {
  listTalentManagers,
  listSponsorshipDeals,
  type TalentManagerRecord,
} from '@/services/agency'
import { listDesignBriefs, saveDesignBrief, type DesignBrief } from '@/services/design-briefs'
import {
  buildChannelGaps,
  type TalentChannelGap,
} from '@/services/channel-gaps'
import {
  findTalentRootFolder,
  listAllDriveItems,
} from '@/services/creative-drive'
import { listCalendarEventsOps, type CalendarEventOps } from '@/services/ops'
import { fetchTasks, moveTaskStatus, type TaskRecord } from '@/services/tasks'
import {
  buildControlInbox,
  buildOpsAlerts,
  INBOX_PRIORITY_LABELS,
  INBOX_TYPE_LABELS,
  type ControlInboxItem,
  type OpsAlert,
} from '@/services/control-center-inbox'
import {
  claimOpsCoverage,
  clearOpsCoverage,
  fetchOpsCoverage,
  fetchOpsDayNote,
  handoffOpsCoverage,
  opsTodayDate,
  saveOpsDayNote,
  type OpsCoverage,
  type OpsDayNote,
} from '@/services/ops-coverage'
import { postOpsDiscordAlert } from '@/services/discord'
import { listAppUsers, setAppUserRoles, type AppRole, type AppUserRecord } from '@/services/app-users'
import { isTauri } from '@/services/twitch'
import { useAppStore } from '@/stores/app-store'
import { useAuthStore } from '@/stores/auth-store'
import { toastError, toastInfo, toastSuccess } from '@/stores/toast-store'

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'ahora'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  return new Date(iso).toLocaleDateString('es-MX')
}

function actorLine(item: ActivityItem): string | null {
  if (item.actorLogin) {
    const name = item.actorName?.trim()
    if (name && name.toLowerCase() !== item.actorLogin.toLowerCase()) {
      return `${name} · @${item.actorLogin}`
    }
    return `@${item.actorLogin}`
  }
  return item.actorName ?? null
}

function Shortcut({ to, label, icon: Icon }: { to: string; label: string; icon: typeof Scan }) {
  return (
    <Link to={to} className="cc-shortcut">
      <Icon size={14} strokeWidth={1.6} />
      <span>{label}</span>
      <ArrowRight size={12} className="cc-shortcut-arrow" />
    </Link>
  )
}

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
  action,
  className = '',
}: {
  title: string
  description: string
  icon: typeof Scan
  children: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <section className={`card cc-section ${className}`.trim()}>
      <div className="cc-section-head">
        <div className="cc-section-title">
          <Icon size={16} strokeWidth={1.6} />
          <div>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
        </div>
        {action}
      </div>
      <div className="cc-section-body">{children}</div>
    </section>
  )
}

function CollapsibleShortcuts({
  title,
  description,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string
  description: string
  icon: typeof Scan
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="card cc-section cc-collapse">
      <button type="button" className="cc-collapse-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <div className="cc-section-title">
          <Icon size={16} strokeWidth={1.6} />
          <div>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
        </div>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {open ? <div className="cc-section-body">{children}</div> : null}
    </section>
  )
}

const ASSIGNABLE_ROLES: AppRole[] = ['admin', 'manager', 'staff', 'assistant', 'designer', 'dev']

export function ControlCenterPage() {
  const roles = useAuthStore((s) => s.roles)
  const session = useAuthStore((s) => s.session)
  const talents = useAppStore((s) => s.talents)
  const helixStatus = useAppStore((s) => s.helixStatus)
  const lastTwitchUpdate = useAppStore((s) => s.lastTwitchUpdate)
  const manageRoles = canManageAppRoles(roles, session?.login)
  const canStrong = canAssignStrongRoles(roles, session?.login)
  const hideStrongRoles = canStrong ? [] : STRONG_APP_ROLES

  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [events, setEvents] = useState<NlEvent[]>([])
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [briefs, setBriefs] = useState<DesignBrief[]>([])
  const [tryouts, setTryouts] = useState<NlTryout[]>([])
  const [managers, setManagers] = useState<TalentManagerRecord[]>([])
  const [gaps, setGaps] = useState<TalentChannelGap[]>([])
  const [vods, setVods] = useState<NlVod[]>([])
  const [calendar, setCalendar] = useState<CalendarEventOps[]>([])
  const [contractEnds, setContractEnds] = useState<Array<{ id: string; title: string; endsOn: string; href?: string }>>([])
  const [coverage, setCoverage] = useState<OpsCoverage | null>(null)
  const [dayNote, setDayNote] = useState<OpsDayNote | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [noteEditing, setNoteEditing] = useState(false)
  const [appUsers, setAppUsers] = useState<AppUserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [rolePickerFor, setRolePickerFor] = useState<string | null>(null)
  const [roleTargetId, setRoleTargetId] = useState('')
  const [handoffLogin, setHandoffLogin] = useState('')
  const noteEditingRef = useRef(false)

  const today = opsTodayDate()
  const myLogin = session?.login?.toLowerCase() ?? ''
  const onDuty = Boolean(coverage && coverage.login.toLowerCase() === myLogin)

  const liveTalents = useMemo(() => talents.filter((t) => t.isLive), [talents])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const soft = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback)
      const roster = useAppStore.getState().talents

      const [
        audit,
        nlEvents,
        taskRows,
        briefRows,
        tryoutRows,
        managerRows,
        vodRows,
        coverageRow,
        noteRow,
        calRows,
        nlContracts,
        deals,
        driveItems,
        users,
      ] = await Promise.all([
        soft(fetchAuditActivity('all', 12), [] as ActivityItem[]),
        soft(listEvents(), [] as NlEvent[]),
        soft(fetchTasks(), [] as TaskRecord[]),
        isTauri ? soft(listDesignBriefs(), [] as DesignBrief[]) : Promise.resolve([] as DesignBrief[]),
        soft(listTryouts(), [] as NlTryout[]),
        isTauri ? soft(listTalentManagers(), [] as TalentManagerRecord[]) : Promise.resolve([] as TalentManagerRecord[]),
        soft(listVods(), [] as NlVod[]),
        soft(fetchOpsCoverage(today), null),
        soft(fetchOpsDayNote(today), null),
        isTauri ? soft(listCalendarEventsOps(), [] as CalendarEventOps[]) : Promise.resolve([] as CalendarEventOps[]),
        soft(listContracts(), []),
        isTauri ? soft(listSponsorshipDeals(), []) : Promise.resolve([]),
        isTauri ? soft(listAllDriveItems(), []) : Promise.resolve([]),
        isTauri ? soft(listAppUsers(), [] as AppUserRecord[]) : Promise.resolve([] as AppUserRecord[]),
      ])

      setActivity(audit)
      setEvents(nlEvents)
      setTasks(taskRows)
      setBriefs(briefRows)
      setTryouts(tryoutRows)
      setManagers(managerRows)
      setVods(vodRows)
      setCoverage(coverageRow)
      setDayNote(noteRow)
      if (!noteEditingRef.current) setNoteDraft(noteRow?.body ?? '')
      setCalendar(calRows)
      setAppUsers(users)

      const ends: Array<{ id: string; title: string; endsOn: string; href?: string }> = []
      for (const c of nlContracts) {
        if (c.endsOn && (c.status === 'active' || c.status === 'draft')) {
          ends.push({ id: `nl-${c.id}`, title: c.title, endsOn: c.endsOn.slice(0, 10), href: '/neuralleague' })
        }
      }
      for (const d of deals) {
        if (d.endDate && (d.status === 'active' || d.status === 'negotiating')) {
          ends.push({
            id: `deal-${d.id}`,
            title: d.brandName,
            endsOn: d.endDate.slice(0, 10),
            href: '/crm',
          })
        }
      }
      setContractEnds(ends)

      if (driveItems.length > 0 || roster.length > 0) {
        setGaps(
          buildChannelGaps({
            talents: roster.map((t) => ({
              id: t.id,
              login: t.login,
              displayName: t.displayName,
              avatar: t.avatar,
              offlineImageUrl: t.offlineImageUrl,
            })),
            driveItems,
            findFolder: (login, name) => findTalentRootFolder(driveItems, login, name),
          }),
        )
      } else {
        setGaps([])
      }
    } finally {
      setLoading(false)
    }
  }, [today])

  useEffect(() => {
    noteEditingRef.current = noteEditing
  }, [noteEditing])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const inbox = useMemo(
    () =>
      buildControlInbox({
        tasks,
        talents,
        managers,
        briefs,
        tryouts,
        gaps,
        events,
      }),
    [tasks, talents, managers, briefs, tryouts, gaps, events],
  )

  const scheduledStreams = useMemo(() => {
    const { start, end } = (() => {
      const n = new Date()
      const s = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime()
      return { start: s, end: s + 86400000 - 1 }
    })()
    return calendar
      .filter((e) => {
        const t = Date.parse(e.startsAt)
        if (Number.isNaN(t) || t < start || t > end) return false
        return e.eventType === 'stream' || !e.eventType
      })
      .filter((e) => Boolean(e.talentLogin))
      .map((e) => ({
        talentLogin: e.talentLogin!,
        title: e.title,
        startsAt: e.startsAt,
      }))
  }, [calendar])

  const alerts: OpsAlert[] = useMemo(
    () =>
      buildOpsAlerts({
        helixStatus,
        talents,
        events,
        vods,
        contractEnds,
        scheduledStreams,
      }),
    [helixStatus, talents, events, vods, contractEnds, scheduledStreams],
  )

  const syncLabel =
    helixStatus === 'connected'
      ? `Twitch OK${lastTwitchUpdate ? ` · ${new Date(lastTwitchUpdate).toLocaleTimeString('es-MX')}` : ''}`
      : helixStatus === 'connecting'
        ? 'Sincronizando Twitch…'
        : helixStatus === 'error'
          ? 'Error de sync Twitch'
          : 'Sync pendiente'

  const toggleDuty = async () => {
    if (!session?.login) {
      toastError('Necesitas iniciar sesión para cubrir el turno.')
      return
    }
    setBusyAction('duty')
    try {
      if (onDuty) {
        const ok = await clearOpsCoverage(today)
        if (!ok) {
          toastError('No se pudo soltar la guardia.')
          return
        }
        setCoverage(null)
        toastSuccess('Ya no estás de guardia en War Room.')
      } else {
        const row = await claimOpsCoverage({
          login: session.login,
          displayName: session.displayName ?? session.login,
        })
        if (!row) {
          toastError('No se pudo marcar la guardia. Revisa permisos o conexión.')
          return
        }
        setCoverage(row)
        toastSuccess('Quedaste de guardia en War Room hoy.')
      }
    } finally {
      setBusyAction(null)
    }
  }

  const doHandoff = async () => {
    const target = appUsers.find((u) => u.twitchLogin.toLowerCase() === handoffLogin.toLowerCase())
      ?? appUsers.find((u) => u.id === handoffLogin)
    const login = target?.twitchLogin ?? handoffLogin.trim()
    if (!login) {
      toastInfo('Elige a quién pasas la cobertura.')
      return
    }
    setBusyAction('handoff')
    try {
      const row = await handoffOpsCoverage({
        login,
        displayName: target?.displayName ?? login,
        notes: session?.login ? `Handoff desde @${session.login}` : '',
      })
      if (!row) {
        toastError('No se pudo pasar la cobertura.')
        return
      }
      setCoverage(row)
      setHandoffLogin('')
      toastSuccess(`Cobertura pasada a @${row.login}.`)
    } finally {
      setBusyAction(null)
    }
  }

  const saveNote = async () => {
    setBusyAction('note')
    try {
      const row = await saveOpsDayNote({ body: noteDraft, login: session?.login })
      if (!row) {
        toastError('No se pudo guardar la nota del día.')
        return
      }
      setDayNote(row)
      setNoteEditing(false)
      toastSuccess('Nota del día guardada.')
    } finally {
      setBusyAction(null)
    }
  }

  const runDiscord = async (item: ControlInboxItem) => {
    setBusyAction(`discord:${item.id}`)
    try {
      const result = await postOpsDiscordAlert(
        `📌 **Centro de control** · ${INBOX_TYPE_LABELS[item.type]}\n**${item.title}**\n${item.detail}`,
      )
      if (result === 'ok') toastSuccess('Aviso enviado a Discord.')
      else if (result === 'disabled') {
        toastInfo('Discord no está configurado. Activa el webhook en Ajustes para avisar al equipo.')
      } else toastError('No se pudo enviar el aviso a Discord.')
    } finally {
      setBusyAction(null)
    }
  }

  const markDone = async (item: ControlInboxItem) => {
    if (!item.taskId) return
    setBusyAction(`done:${item.id}`)
    try {
      const ok = await moveTaskStatus(item.taskId, 'done')
      if (!ok) {
        toastError('No se pudo marcar la tarea como hecha.')
        return
      }
      setTasks((prev) => prev.map((t) => (t.id === item.taskId ? { ...t, status: 'done' } : t)))
      toastSuccess('Tarea marcada como hecha.')
    } finally {
      setBusyAction(null)
    }
  }

  const quickBrief = async (item: ControlInboxItem) => {
    if (!isTauri) {
      toastInfo('Los briefs rápidos requieren la app de escritorio.')
      return
    }
    setBusyAction(`brief:${item.id}`)
    try {
      const title = item.talentLogin
        ? `Brief rápido · @${item.talentLogin}`
        : `Brief rápido · ${item.title}`
      await saveDesignBrief({
        title,
        talentLogin: item.talentLogin,
        body: `Creado desde Centro de control.\n\nContexto: ${item.detail}\nOrigen: ${item.title}`,
        assetChecklist: [],
        status: 'draft',
      })
      toastSuccess('Brief borrador creado. Ábrelo en Diseño → Briefs.')
      const next = await listDesignBriefs().catch(() => null)
      if (next) setBriefs(next)
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo crear el brief.')
    } finally {
      setBusyAction(null)
    }
  }

  const applyRole = async (userId: string, role: AppRole) => {
    if (role === 'owner') {
      toastError('No se puede asignar Owner desde aquí.')
      return
    }
    if (role === 'dev' && !canStrong) {
      toastError('Solo un owner o dev puede gestionar el rol Dev.')
      return
    }
    const user = appUsers.find((u) => u.id === userId)
    if (!user) return
    setBusyAction(`role:${userId}`)
    try {
      const has = user.roles.includes(role)
      const next = has ? user.roles.filter((r) => r !== role) : [...user.roles, role]
      const updated = await setAppUserRoles(userId, next)
      setAppUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, roles: updated } : u)))
      toastSuccess(has ? `Quitado rol ${role} a @${user.twitchLogin}` : `Asignado ${role} a @${user.twitchLogin}`)
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'No se pudo cambiar el rol.')
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div className="control-center">
      <div className="page-title">
        <div>
          <h1>Centro de control</h1>
          <p>Qué hacer hoy, cobertura del War Room y alertas del equipo — en un solo lugar.</p>
        </div>
      </div>

      <SectionCard
        className="cc-inbox-hero"
        title="Qué hacer hoy"
        description="Cola unificada del día: tareas, lives, diseño y NeuraLeague."
        icon={ListTodo}
        action={
          <button type="button" className="cc-inline-btn" onClick={() => void loadAll()} disabled={loading}>
            Actualizar
          </button>
        }
      >
        {loading ? (
          <p className="empty-state cc-empty">Cargando bandeja…</p>
        ) : inbox.length === 0 ? (
          <p className="empty-state cc-empty">Nada urgente por ahora. Buen día.</p>
        ) : (
          <ul className="cc-inbox">
            {inbox.map((item) => (
              <li key={item.id} className={`cc-inbox-item prio-${item.priority}`}>
                <div className="cc-inbox-main">
                  <div className="cc-inbox-meta">
                    <span className="cc-pill type">{INBOX_TYPE_LABELS[item.type]}</span>
                    <span className={`cc-pill prio prio-${item.priority}`}>{INBOX_PRIORITY_LABELS[item.priority]}</span>
                  </div>
                  <b>{item.title}</b>
                  <em>{item.detail}</em>
                </div>
                <div className="cc-inbox-actions">
                  {item.actions.includes('mark_done') ? (
                    <button
                      type="button"
                      disabled={busyAction === `done:${item.id}`}
                      onClick={() => void markDone(item)}
                      title="Marcar hecha"
                    >
                      <Check size={13} /> Hecha
                    </button>
                  ) : null}
                  {item.actions.includes('quick_brief') ? (
                    <button
                      type="button"
                      disabled={busyAction === `brief:${item.id}`}
                      onClick={() => void quickBrief(item)}
                    >
                      <Paintbrush size={13} /> Brief
                    </button>
                  ) : null}
                  {item.actions.includes('discord') ? (
                    <button
                      type="button"
                      disabled={busyAction === `discord:${item.id}`}
                      onClick={() => void runDiscord(item)}
                    >
                      <MessageSquare size={13} /> Discord
                    </button>
                  ) : null}
                  {manageRoles ? (
                    <button
                      type="button"
                      onClick={() => {
                        setRolePickerFor(rolePickerFor === item.id ? null : item.id)
                        setRoleTargetId('')
                      }}
                    >
                      <UserCog size={13} /> Rol
                    </button>
                  ) : null}
                  {item.href ? (
                    <Link to={item.href} className="cc-inbox-link">
                      Ir <ArrowRight size={12} />
                    </Link>
                  ) : null}
                </div>
                {rolePickerFor === item.id && manageRoles ? (
                  <div className="cc-role-picker">
                    <label>
                      Persona
                      <select value={roleTargetId} onChange={(e) => setRoleTargetId(e.target.value)}>
                        <option value="">Elegir…</option>
                        {appUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            @{u.twitchLogin}{u.displayName ? ` · ${u.displayName}` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    {roleTargetId ? (
                      <div className="cc-role-chips">
                        {ASSIGNABLE_ROLES.filter((r) => !hideStrongRoles.includes(r)).map((role) => {
                          const user = appUsers.find((u) => u.id === roleTargetId)
                          const active = user?.roles.includes(role)
                          return (
                            <button
                              key={role}
                              type="button"
                              className={active ? 'active' : ''}
                              disabled={busyAction === `role:${roleTargetId}`}
                              onClick={() => void applyRole(roleTargetId, role)}
                            >
                              {role}
                            </button>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <div className="cc-grid cc-grid-ops">
        <SectionCard
          title="Turno / cobertura"
          description="Quién cubre War Room hoy."
          icon={UserCheck}
        >
          <div className="cc-coverage">
            {coverage ? (
              <div className="cc-coverage-who">
                <b>@{coverage.login}</b>
                <span>{coverage.displayName || coverage.login}</span>
                {coverage.notes ? <em>{coverage.notes}</em> : null}
              </div>
            ) : (
              <p className="empty-state cc-empty">Nadie marcado de guardia hoy.</p>
            )}
            <div className="cc-coverage-actions">
              <button
                type="button"
                className={onDuty ? 'primary' : 'secondary'}
                disabled={busyAction === 'duty' || !session?.login}
                onClick={() => void toggleDuty()}
              >
                {onDuty ? 'Soltar guardia' : 'Estoy de guardia'}
              </button>
            </div>
            <div className="cc-handoff">
              <label>
                Pasar cobertura a
                {appUsers.length > 0 ? (
                  <select value={handoffLogin} onChange={(e) => setHandoffLogin(e.target.value)}>
                    <option value="">Elegir manager…</option>
                    {appUsers.map((u) => (
                      <option key={u.id} value={u.twitchLogin}>
                        @{u.twitchLogin}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={handoffLogin}
                    onChange={(e) => setHandoffLogin(e.target.value)}
                    placeholder="@login"
                  />
                )}
              </label>
              <button type="button" className="secondary" disabled={busyAction === 'handoff'} onClick={() => void doHandoff()}>
                Handoff
              </button>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Notas del día"
          description="Pizarra compartida owner ↔ asistente."
          icon={StickyNote}
          action={
            !noteEditing ? (
              <button type="button" className="cc-inline-btn" onClick={() => setNoteEditing(true)}>
                {dayNote?.body ? 'Editar' : 'Escribir'}
              </button>
            ) : null
          }
        >
          {noteEditing ? (
            <div className="cc-day-note-edit">
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                rows={5}
                placeholder="Prioridades, recordatorios, contexto para el turno…"
              />
              <div className="cc-day-note-actions">
                <button type="button" className="primary" disabled={busyAction === 'note'} onClick={() => void saveNote()}>
                  Guardar
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setNoteDraft(dayNote?.body ?? '')
                    setNoteEditing(false)
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : dayNote?.body ? (
            <div className="cc-day-note">
              <p>{dayNote.body}</p>
              <small>
                {dayNote.updatedByLogin ? `@${dayNote.updatedByLogin} · ` : ''}
                {dayNote.updatedAt ? relativeTime(dayNote.updatedAt) : today}
              </small>
            </div>
          ) : (
            <p className="empty-state cc-empty">Sin notas para hoy. Escribe lo que el turno necesita saber.</p>
          )}
        </SectionCard>

        <SectionCard
          title="Alertas operativas"
          description="Cosas que requieren mirada ahora."
          icon={AlertTriangle}
        >
          {alerts.length === 0 ? (
            <p className="empty-state cc-empty">Sin alertas. Sync y contratos en orden.</p>
          ) : (
            <ul className="cc-alerts">
              {alerts.map((a) => (
                <li key={a.id} className={`tone-${a.tone}`}>
                  <div>
                    <b>{a.title}</b>
                    <em>{a.detail}</em>
                  </div>
                  {a.href ? (
                    <Link to={a.href}>
                      Ver <ArrowRight size={12} />
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Ahora" description="Quién está en la app y lives." icon={Radio}>
          <ActiveUsersPanel compact />
          <div className="cc-now-lives">
            <div className="cc-stat">
              <b>{liveTalents.length}</b>
              <span>en directo</span>
            </div>
            <div className="cc-stat">
              <b>{talents.length}</b>
              <span>talentos</span>
            </div>
          </div>
          {liveTalents.length === 0 ? (
            <p className="empty-state cc-empty">Sin emisiones en este momento.</p>
          ) : (
            <ul className="cc-list">
              {liveTalents.slice(0, 5).map((t) => (
                <li key={t.id}>
                  <Link to={`/talento/${t.login}`}>
                    {t.avatar ? <img src={t.avatar} alt="" /> : <span className="avatar-placeholder">{t.displayName.slice(0, 2)}</span>}
                    <div>
                      <b>{t.displayName}</b>
                      <em>{t.viewers.toLocaleString('es-MX')} viewers · {t.category || 'Sin categoría'}</em>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="cc-grid">
        <SectionCard
          title="Equipo"
          description="Usuarios y roles (Owner/Dev solo con privilegio fuerte)."
          icon={Users}
          action={
            manageRoles ? (
              <Link to="/ajustes?tab=permisos" className="cc-inline-link">
                Permisos →
              </Link>
            ) : null
          }
        >
          {manageRoles ? (
            <PermissionsPanel compact hideRoles={hideStrongRoles} />
          ) : (
            <p className="empty-state cc-empty">Tu rol no puede gestionar permisos. Pide acceso a un owner.</p>
          )}
        </SectionCard>

        <SectionCard
          title="Actividad"
          description="Auditoría reciente."
          icon={Shield}
          action={<Link to="/auditoria" className="cc-inline-link">Ver todo →</Link>}
        >
          {loading ? (
            <p className="empty-state cc-empty">Cargando…</p>
          ) : activity.length === 0 ? (
            <p className="empty-state cc-empty">Sin actividad reciente.</p>
          ) : (
            <ul className="cc-activity">
              {activity.slice(0, 8).map((item) => {
                const who = actorLine(item)
                return (
                  <li key={item.id}>
                    <span>{relativeTime(item.createdAt)}</span>
                    <p>{item.label}</p>
                    {who ? <small>{who}</small> : null}
                  </li>
                )
              })}
            </ul>
          )}
        </SectionCard>

        <CollapsibleShortcuts title="Atajos · Ops" description="War Room, tareas, calendario." icon={Scan}>
          <div className="cc-shortcuts">
            <Shortcut to="/war-room" label="War Room" icon={Scan} />
            <Shortcut to="/talentos" label="Talentos" icon={Users} />
            <Shortcut to="/tareas" label="Tareas" icon={ListTodo} />
            <Shortcut to="/calendario" label="Calendario" icon={CalendarDays} />
          </div>
        </CollapsibleShortcuts>

        <CollapsibleShortcuts title="Atajos · Diseño" description="Briefs, huecos y entrega." icon={Paintbrush}>
          <div className="cc-shortcuts">
            <Shortcut to="/diseno/briefs" label="Briefs" icon={ListChecks} />
            <Shortcut to="/diseno/huecos" label="Huecos" icon={LayoutTemplate} />
            <Shortcut to="/diseno" label="Drive" icon={Paintbrush} />
            <Shortcut to="/assets" label="Assets" icon={Activity} />
            <Shortcut to="/handoff" label="Handoff" icon={ArrowRight} />
          </div>
        </CollapsibleShortcuts>

        <CollapsibleShortcuts title="Atajos · NeuraLeague" description="Calendario y operación." icon={Award} defaultOpen={false}>
          <div className="cc-shortcuts">
            <Shortcut to="/neuralleague" label="Temporada" icon={Award} />
            <Shortcut to="/neuralleague/calendario" label="Calendario NL" icon={CalendarDays} />
            <Shortcut to="/neuralleague/operacion" label="Operación" icon={ListChecks} />
          </div>
        </CollapsibleShortcuts>

        <CollapsibleShortcuts title="Datos y ajustes" description="Sync, analítica y alertas." icon={Database}>
          <div className={`cc-sync ${helixStatus}`}>
            <span className={helixStatus === 'connected' ? 'online-dot' : helixStatus === 'error' ? 'offline-dot' : 'pending-dot'} />
            <div>
              <b>{syncLabel}</b>
              <span>Monitoreo público + caché local</span>
            </div>
          </div>
          <div className="cc-shortcuts">
            <Shortcut to="/analitica" label="Analítica" icon={Activity} />
            <Shortcut to="/inteligencia" label="Inteligencia" icon={Brain} />
            <Shortcut to="/ajustes" label="Alertas Windows" icon={Bell} />
            <Shortcut to="/ajustes" label="Discord" icon={Radio} />
            <Shortcut to="/ajustes" label="Sonido de live" icon={Volume2} />
            <Shortcut to="/ajustes" label="Ajustes" icon={Settings} />
          </div>
        </CollapsibleShortcuts>
      </div>
    </div>
  )
}
