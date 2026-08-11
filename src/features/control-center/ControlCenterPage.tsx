import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  Award,
  Bell,
  Brain,
  CalendarDays,
  Database,
  LayoutTemplate,
  ListChecks,
  ListTodo,
  Paintbrush,
  Radio,
  Scan,
  Settings,
  Shield,
  Users,
  Volume2,
} from 'lucide-react'
import { ActiveUsersPanel } from '@/features/presence/ActiveUsersPanel'
import { PermissionsPanel } from '@/features/settings/PermissionsPanel'
import { fetchAuditActivity } from '@/services/audit'
import type { ActivityItem } from '@/services/activity'
import { canAssignOwnerRole, canManageAppRoles } from '@/services/permissions'
import { listEvents } from '@/services/neuraleague'
import type { NlEvent } from '@/services/neuraleague/types'
import { useAppStore } from '@/stores/app-store'
import { useAuthStore } from '@/stores/auth-store'

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
}: {
  title: string
  description: string
  icon: typeof Scan
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className="card cc-section">
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

export function ControlCenterPage() {
  const roles = useAuthStore((s) => s.roles)
  const session = useAuthStore((s) => s.session)
  const talents = useAppStore((s) => s.talents)
  const helixStatus = useAppStore((s) => s.helixStatus)
  const lastTwitchUpdate = useAppStore((s) => s.lastTwitchUpdate)
  const manageRoles = canManageAppRoles(roles, session?.login)
  const hideOwnerChip = !canAssignOwnerRole(roles, session?.login)

  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [events, setEvents] = useState<NlEvent[]>([])
  const [loadingExtras, setLoadingExtras] = useState(true)

  const liveTalents = useMemo(() => talents.filter((t) => t.isLive), [talents])

  const loadExtras = useCallback(async () => {
    setLoadingExtras(true)
    try {
      const [audit, nlEvents] = await Promise.all([
        fetchAuditActivity('all', 12),
        listEvents().catch(() => [] as NlEvent[]),
      ])
      setActivity(audit)
      setEvents(nlEvents)
    } finally {
      setLoadingExtras(false)
    }
  }, [])

  useEffect(() => {
    void loadExtras()
  }, [loadExtras])

  const upcoming = useMemo(
    () =>
      events
        .filter((e) => e.status === 'scheduled' || e.status === 'live')
        .filter((e) => Date.parse(e.startsAt) >= Date.now() - 60 * 60 * 1000)
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
        .slice(0, 4),
    [events],
  )

  const syncLabel =
    helixStatus === 'connected'
      ? `Twitch OK${lastTwitchUpdate ? ` · ${new Date(lastTwitchUpdate).toLocaleTimeString('es-MX')}` : ''}`
      : helixStatus === 'connecting'
        ? 'Sincronizando Twitch…'
        : helixStatus === 'error'
          ? 'Error de sync Twitch'
          : 'Sync pendiente'

  return (
    <div className="control-center">
      <div className="page-title">
        <div>
          <h1>Centro de control</h1>
          <p>Vista operativa de NeuraGest: equipo, contenido, liga y actividad en un solo lugar.</p>
        </div>
      </div>

      <div className="cc-grid">
        <SectionCard
          title="Ahora"
          description="Quién está en la app, lives y pulso reciente."
          icon={Radio}
        >
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
          <div className="cc-shortcuts">
            <Shortcut to="/" label="Dashboard" icon={Activity} />
            <Shortcut to="/auditoria" label="Actividad" icon={Shield} />
          </div>
        </SectionCard>

        <SectionCard
          title="Equipo"
          description="Usuarios y roles (sin asignar Owner)."
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
            <PermissionsPanel compact hideRoles={hideOwnerChip ? ['owner'] : []} />
          ) : (
            <p className="empty-state cc-empty">Tu rol no puede gestionar permisos. Pide acceso a un owner.</p>
          )}
        </SectionCard>

        <SectionCard title="Talentos & Ops" description="Atajos de operación diaria." icon={Scan}>
          <div className="cc-shortcuts">
            <Shortcut to="/war-room" label="War Room" icon={Scan} />
            <Shortcut to="/talentos" label="Talentos" icon={Users} />
            <Shortcut to="/tareas" label="Tareas" icon={ListTodo} />
            <Shortcut to="/calendario" label="Calendario" icon={CalendarDays} />
          </div>
        </SectionCard>

        <SectionCard title="Contenido & Diseño" description="Briefs, huecos y entrega creativa." icon={Paintbrush}>
          <div className="cc-shortcuts">
            <Shortcut to="/diseno/briefs" label="Briefs" icon={ListChecks} />
            <Shortcut to="/diseno/huecos" label="Huecos" icon={LayoutTemplate} />
            <Shortcut to="/diseno" label="Drive" icon={Paintbrush} />
            <Shortcut to="/assets" label="Assets" icon={Activity} />
            <Shortcut to="/handoff" label="Handoff" icon={ArrowRight} />
          </div>
        </SectionCard>

        <SectionCard
          title="NeuraLeague"
          description="Próximos scrims y eventos."
          icon={Award}
          action={<Link to="/neuralleague" className="cc-inline-link">Temporada →</Link>}
        >
          {loadingExtras ? (
            <p className="empty-state cc-empty">Cargando eventos…</p>
          ) : upcoming.length === 0 ? (
            <p className="empty-state cc-empty">Sin scrims/eventos próximos.</p>
          ) : (
            <ul className="cc-list cc-list-plain">
              {upcoming.map((e) => (
                <li key={e.id}>
                  <div>
                    <b>{e.title}</b>
                    <em>
                      {e.eventType} · {new Date(e.startsAt).toLocaleString('es-MX')}
                    </em>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="cc-shortcuts">
            <Shortcut to="/neuralleague/calendario" label="Calendario NL" icon={CalendarDays} />
            <Shortcut to="/neuralleague/operacion" label="Operación" icon={ListChecks} />
          </div>
        </SectionCard>

        <SectionCard title="Datos" description="Estado de sync y módulos de inteligencia." icon={Database}>
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
          </div>
        </SectionCard>

        <SectionCard
          title="Actividad"
          description="Auditoría reciente con actor."
          icon={Shield}
          action={<Link to="/auditoria" className="cc-inline-link">Ver todo →</Link>}
        >
          {loadingExtras ? (
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

        <SectionCard title="Ajustes rápidos" description="Alertas, Discord y sonido." icon={Settings}>
          <div className="cc-shortcuts">
            <Shortcut to="/ajustes" label="Alertas Windows" icon={Bell} />
            <Shortcut to="/ajustes" label="Discord presence" icon={Radio} />
            <Shortcut to="/ajustes" label="Sonido de live" icon={Volume2} />
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
