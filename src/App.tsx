import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Activity, ChevronDown, ChevronLeft, ChevronRight, Loader2, LogOut, Menu, Search, UserRound, X,
} from '@/components/icons'
import { PageTransition } from '@/components/PageTransition'
import { ToastHost } from '@/components/ToastHost'
import { GlobalSearch } from '@/components/GlobalSearch'
import { ShortcutsModal } from '@/components/ShortcutsModal'
import { OfflineBanner } from '@/components/OfflineBanner'
import { PermissionGate } from '@/components/PermissionGate'
import { TalentsSkeleton } from '@/components/Skeleton'
import { toastError, toastSuccess } from '@/stores/toast-store'
import { Dashboard } from '@/features/dashboard/Dashboard'
import { Analytics } from '@/features/analytics/Analytics'
import { PlatformStatsPage } from '@/features/platform-stats/PlatformStatsPage'
import { TwitchIntelligencePage } from '@/features/twitch-intelligence/TwitchIntelligencePage'
import { Documents } from '@/features/documents/Documents'
import { LoginScreen } from '@/features/auth/LoginScreen'
import { SplashScreen } from '@/features/auth/SplashScreen'
import { neuraliveLogotype } from '@/assets/brand'
import { useAppStore } from '@/stores/app-store'
import { OAuthWaitingPanel } from '@/features/auth/OAuthWaitingPanel'
import { NoRoleWaitingPage } from '@/features/auth/NoRoleWaitingPage'
import { PermissionsPanel } from '@/features/settings/PermissionsPanel'
import { OwnerAssistantPanel } from '@/features/settings/OwnerAssistantPanel'
import { SupabaseStatusCard } from '@/features/settings/SupabaseStatusCard'
import { DiscordSettings } from '@/features/settings/DiscordSettings'
import { DiscordPresenceSync } from '@/features/settings/DiscordPresenceSync'
import { OrgPresenceSync } from '@/features/presence/OrgPresenceSync'
import { ActiveUsersBadge } from '@/features/presence/ActiveUsersBadge'
import { GoogleCalendarSettings } from '@/features/settings/GoogleCalendarSettings'
import { TwitchHelixSettings } from '@/features/settings/TwitchHelixSettings'
import { BackfillPanel } from '@/features/settings/BackfillPanel'
import { TwitchTrackerPanel } from '@/features/settings/TwitchTrackerPanel'
import { UpdaterPanel } from '@/features/settings/UpdaterPanel'
import { BackgroundUpdater } from '@/features/settings/BackgroundUpdater'
import { ManagerTour } from '@/features/onboarding/ManagerTour'
import { OnboardingModal } from '@/features/onboarding/OnboardingModal'
import { NativeAlertSettings } from '@/features/settings/NativeAlertSettings'
import { LiveSoundSettings } from '@/features/settings/LiveSoundSettings'
import { NavVisibilitySettings } from '@/features/settings/NavVisibilitySettings'
import { TemplatesPanel } from '@/features/templates/TemplatesPanel'
import { TasksPage } from '@/features/tasks/TasksPage'
import { CalendarPage } from '@/features/calendar/CalendarPage'
import { PipelinePage } from '@/features/pipeline/PipelinePage'
import { CrmPage } from '@/features/crm/CrmPage'
import { OnboardingPage } from '@/features/onboarding/OnboardingPage'
import { WikiPage } from '@/features/wiki/WikiPage'
import { RateCardPage } from '@/features/rate-card/RateCardPage'
import { BriefPage } from '@/features/brief/BriefPage'
import { AssetsPage } from '@/features/assets/AssetsPage'
import { CreativeDrivePage } from '@/features/creative-drive/CreativeDrivePage'
import { ChannelGapsPage } from '@/features/channel-gaps/ChannelGapsPage'
import { CreativeBriefsPage } from '@/features/creative-briefs/CreativeBriefsPage'
import { NeuraLeagueOverviewPage } from '@/features/neuraleague/NeuraLeagueOverviewPage'
import { NeuraLeagueTeamsPage } from '@/features/neuraleague/NeuraLeagueTeamsPage'
import { NeuraLeaguePlayersPage } from '@/features/neuraleague/NeuraLeaguePlayersPage'
import { NeuraLeagueCalendarPage } from '@/features/neuraleague/NeuraLeagueCalendarPage'
import { NeuraLeagueStatsPage } from '@/features/neuraleague/NeuraLeagueStatsPage'
import { NeuraLeagueVodsPage } from '@/features/neuraleague/NeuraLeagueVodsPage'
import { NeuraLeagueTrainingPage } from '@/features/neuraleague/NeuraLeagueTrainingPage'
import { NeuraLeagueRecruitmentPage } from '@/features/neuraleague/NeuraLeagueRecruitmentPage'
import { NeuraLeagueOperationsPage } from '@/features/neuraleague/NeuraLeagueOperationsPage'
import { HandoffPage } from '@/features/handoff/HandoffPage'
import { AuditPage } from '@/features/audit/AuditPage'
import { ControlCenterPage } from '@/features/control-center/ControlCenterPage'
import { AssistantTasksPage } from '@/features/control-center/AssistantTasksPage'
import { EventFichasPage } from '@/features/control-center/EventFichasPage'
import { ActivityInbox } from '@/features/activity/ActivityInbox'
import { MediaKitPage } from '@/features/media-kit/MediaKitPage'
import { WarRoomPage } from '@/features/war-room/WarRoomPage'
import { ScheduleCompliancePage } from '@/features/schedule/ScheduleCompliancePage'
import { CommissionsPage } from '@/features/commissions/CommissionsPage'
import { PortalPage } from '@/features/portal/PortalPage'
import { MediaKitComparePage } from '@/features/media-kit/MediaKitComparePage'
import { VodDigestPage } from '@/features/vod-digest/VodDigestPage'
import { BoardPackPage } from '@/features/board-pack/BoardPackPage'
import { useAuthStore } from '@/stores/auth-store'
import {
  canAccessControlCenter,
  canAccessDatosNav,
  canAccessPath,
  canAdminMutate,
  canManageAppRoles,
  canMutateCrm,
  defaultPathForRoles,
  getControlCenterDenial,
  getDatosDenial,
  isBasicSettingsOnly,
  isNoRoleUser,
} from '@/services/permissions'
import { navSections, navTourIds, settingsNav, type NavItem } from '@/services/nav-config'
import {
  isNavItemHidden,
  NAV_VISIBILITY_CHANGED,
  readNavVisibilityPrefs,
  type NavVisibilityPrefs,
} from '@/services/nav-preferences'
import { canViewAudit } from '@/services/audit'
import type { AppRole } from '@/services/app-users'

const MlPage = lazy(() => import('@/features/ml/MlPage'))
const TalentProfilePage = lazy(() => import('@/features/talent-profile/TalentProfilePage'))

const SIDEBAR_COLLAPSED_KEY = 'neuragest-sidebar-collapsed'
const SIDEBAR_SECTIONS_KEY = 'neuragest-sidebar-sections'

type SidebarSectionState = Record<string, boolean>

/** `true` / missing = colapsada; `false` = expandida. Por defecto todas colapsadas. */
function readSidebarSections(): SidebarSectionState {
  try {
    const raw = localStorage.getItem(SIDEBAR_SECTIONS_KEY)
    return raw ? (JSON.parse(raw) as SidebarSectionState) : {}
  } catch {
    return {}
  }
}

function isSidebarSectionCollapsed(state: SidebarSectionState, title: string) {
  return state[title] !== false
}

function writeSidebarSections(state: SidebarSectionState) {
  try {
    localStorage.setItem(SIDEBAR_SECTIONS_KEY, JSON.stringify(state))
  } catch { /* ignore */ }
}

function filterNavItems(
  sectionTitle: string,
  items: readonly NavItem[],
  roles: AppRole[],
  login: string | undefined,
  navPrefs: NavVisibilityPrefs,
  showAudit: boolean,
  showControlCenter: boolean,
): NavItem[] {
  if (sectionTitle === 'Datos' && !canAccessDatosNav(roles, login)) return []
  return items.filter(([to]) => {
    if (to === '/auditoria' && !showAudit) return false
    if (to === '/control' && !showControlCenter) return false
    if (!canAccessPath(roles, to, login)) return false
    if (isNavItemHidden(navPrefs, to, sectionTitle)) return false
    return true
  })
}

function readSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>
}

function PageTitle({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-title"><div><h1>{title}</h1><p>{description}</p></div>{action}</div>
}

function Talents() {
  const talents = useAppStore((s) => s.talents)
  const loading = useAppStore((s) => s.twitchLoading)
  const hasCompletedSync = useAppStore((s) => s.hasCompletedTwitchSync)
  const refreshTalentData = useAppStore((s) => s.refreshTalentData)
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const filtered = talents.filter((t) => t.displayName.toLowerCase().includes(query.toLowerCase()))
  const showSkeleton = !hasCompletedSync && (loading || talents.every((t) => t.id.startsWith('pending-')))

  const onRefresh = async () => {
    await refreshTalentData()
    const err = useAppStore.getState().twitchError
    if (err) toastError('No se pudo actualizar Twitch')
    else toastSuccess('Sincronizado')
  }

  if (showSkeleton) return <TalentsSkeleton />

  return <><PageTitle title="Talentos" description="Rendimiento, actividad y perfiles de la agencia." action={<button className="primary" disabled={loading} onClick={() => void onRefresh()}><Activity size={16}/>{loading ? 'Actualizando…' : 'Actualizar Twitch'}</button>}/>
    <Card><div className="toolbar"><label className="search"><Search size={16}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar talento..."/></label><button className="secondary">Todos los estados</button></div>
      <div className="talent-table"><div className="table-header"><span>Talento</span><span>Estado</span><span>Categoría</span><span>Followers</span><span>Viewers</span></div>
        {filtered.map((t) => <div className="table-row talent-row-clickable" key={t.id} role="button" tabIndex={0} onClick={() => navigate(`/talento/${t.login}`)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/talento/${t.login}`) } }}><div className="talent-cell">{t.avatar ? <img src={t.avatar} alt=""/> : <div className="avatar-placeholder">{t.displayName.slice(0, 2).toUpperCase()}</div>}<div><b>{t.displayName}</b><span>@{t.login}</span></div></div><span className={t.isLive ? 'status live' : 'status'}>{t.isLive ? '● En directo' : t.id.startsWith('pending-') ? 'Consultando…' : 'Offline'}</span><span>{t.category}</span><span>{t.followers > 0 ? t.followers.toLocaleString() : '—'}</span><span>{t.viewers.toLocaleString()} <ChevronRight size={15}/></span></div>)}
        {hasCompletedSync && !loading && filtered.length === 0 && <p className="empty-state">No hay talentos que coincidan con la búsqueda.</p>}
      </div>
    </Card></>
}

const SESSION_ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  staff: 'Staff',
  assistant: 'Asistente',
  dev: 'Dev',
  designer: 'Diseñador',
  league_manager: 'Manager Liga',
  coach: 'Coach',
  analyst: 'Analyst',
  player: 'Jugador',
}

function SettingsPage() {
  const helixStatus = useAppStore((s) => s.helixStatus)
  const twitchError = useAppStore((s) => s.twitchError)
  const lastTwitchUpdate = useAppStore((s) => s.lastTwitchUpdate)
  const refreshTalentData = useAppStore((s) => s.refreshTalentData)
  const session = useAuthStore((s) => s.session)
  const roles = useAuthStore((s) => s.roles)
  const canAdmin = useAuthStore((s) => s.canAdmin)
  const identityError = useAuthStore((s) => s.identityError)
  const logout = useAuthStore((s) => s.logout)
  const startTwitchLogin = useAuthStore((s) => s.startTwitchLogin)
  const oauthFlow = useAuthStore((s) => s.oauthFlow)
  const cancelOAuthFlow = useAuthStore((s) => s.cancelOAuthFlow)
  const authError = useAuthStore((s) => s.error)
  const isReconnecting = oauthFlow === 'opening' || oauthFlow === 'waiting'
  const crmReadonly = !canMutateCrm(roles, session?.login)
  const manageRoles = canManageAppRoles(roles, session?.login)
  const showSecrets = canAdminMutate(roles, session?.login)
  const basicOnly = isBasicSettingsOnly(roles, session?.login)
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [settingsTab, setSettingsTab] = useState<'general' | 'permisos' | 'plantillas'>(
    tabParam === 'permisos' && manageRoles ? 'permisos' : tabParam === 'plantillas' ? 'plantillas' : 'general',
  )

  useEffect(() => {
    if (tabParam === 'permisos' && manageRoles) setSettingsTab('permisos')
    else if (tabParam === 'plantillas') setSettingsTab('plantillas')
  }, [tabParam, manageRoles])

  const selectTab = (tab: 'general' | 'permisos' | 'plantillas') => {
    setSettingsTab(tab)
    if (tab === 'general') {
      searchParams.delete('tab')
      setSearchParams(searchParams, { replace: true })
    } else {
      setSearchParams({ tab }, { replace: true })
    }
  }

  const helixLabel = helixStatus === 'connected'
    ? 'Conexión Twitch activa'
    : helixStatus === 'connecting' ? 'Conectando con Twitch…' : helixStatus === 'error' ? 'Error de conexión Twitch' : 'Conexión Twitch pendiente'

  return <><PageTitle title="Ajustes" description={basicOnly ? 'Preferencias personales y sesión.' : 'Integraciones, seguridad y preferencias.'}/>
    {!basicOnly && (
      <div className="view-tabs settings-tabs">
        <button className={settingsTab === 'general' ? 'active' : ''} onClick={() => selectTab('general')}>General</button>
        {manageRoles && <button className={settingsTab === 'permisos' ? 'active' : ''} onClick={() => selectTab('permisos')} disabled={crmReadonly && !manageRoles} title={crmReadonly && !canAdmin ? 'Sin permisos CRM' : undefined}>Permisos</button>}
        <button className={settingsTab === 'plantillas' ? 'active' : ''} onClick={() => selectTab('plantillas')}>Plantillas</button>
      </div>
    )}
    {!basicOnly && settingsTab === 'permisos' && manageRoles ? (
      <PermissionsPanel />
    ) : !basicOnly && settingsTab === 'plantillas' ? (
      <TemplatesPanel/>
    ) : (
    <div className="settings-grid">
    <Card className="settings-panel-card twitch-session-card">
      <div className="settings-panel-head">
        <div>
          <h3><UserRound size={16} strokeWidth={1.6} /> Sesión Twitch</h3>
          <p>Tu identidad en NeuraGest está vinculada a tu cuenta de Twitch.</p>
        </div>
      </div>

      <div className="session-profile-row">
        <div className="session-avatar-wrap" aria-hidden>
          {session?.avatarUrl
            ? <img src={session.avatarUrl} alt="" className="session-avatar" />
            : <div className="avatar-placeholder">{session?.displayName?.slice(0, 2).toUpperCase() ?? 'NL'}</div>}
        </div>
        <div className="session-profile-info">
          <b>{session?.displayName ?? 'Sin sesión'}</b>
          <span>{session ? `@${session.login}` : 'Inicia sesión con Twitch para continuar'}</span>
        </div>
      </div>

      {roles.length > 0 && (
        <div className="session-roles">
          <span className="session-roles-label">Roles</span>
          <div className="session-role-chips">
            {roles.map((role) => (
              <span key={role} className="session-role-chip">{SESSION_ROLE_LABELS[role] ?? role}</span>
            ))}
          </div>
        </div>
      )}

      <div className="settings-panel-divider" aria-hidden />

      <div className="settings-session-actions">
        <button className="twitch-button" disabled={isReconnecting} onClick={() => void startTwitchLogin()}>
          {isReconnecting ? 'Esperando autorización…' : session ? 'Reconectar cuenta' : 'Iniciar sesión'}
        </button>
        {session && (
          <button type="button" className="secondary ghost-btn" onClick={() => void logout()}>
            <LogOut size={15} strokeWidth={1.6} /> Cerrar sesión
          </button>
        )}
      </div>

      {authError && oauthFlow === 'idle' && <p className="integration-note settings-panel-note">{authError}</p>}
      {identityError && <p className="integration-note settings-panel-note">Sincronización de cuenta: {identityError}</p>}
      {crmReadonly && roles.includes('staff') && (
        <p className="integration-note settings-panel-note staff-readonly-banner">
          Staff: CRM, permisos y wiki crítica en solo lectura.
        </p>
      )}
      {oauthFlow !== 'idle' && (
        <OAuthWaitingPanel
          phase={oauthFlow}
          error={authError}
          onCancel={cancelOAuthFlow}
          onRetry={() => void startTwitchLogin()}
        />
      )}
    </Card>
    {(roles.includes('owner') || roles.includes('admin')) && (
      <OwnerAssistantPanel />
    )}
    {basicOnly ? (
      <>
        <NavVisibilitySettings/>
        <NativeAlertSettings/>
        <LiveSoundSettings/>
        <DiscordSettings personalOnly/>
      </>
    ) : (
      <>
        <NavVisibilitySettings/>
        <Card className="settings-panel-card">
          <div className="settings-panel-head">
            <div>
              <h3><Activity size={16} strokeWidth={1.6} /> Monitoreo Twitch</h3>
              <p>Métricas públicas de talentos en tiempo casi real.</p>
            </div>
          </div>
          <div className={`connection helix-connection ${helixStatus}`}>
            <div className={helixStatus === 'connected' ? 'online-dot' : helixStatus === 'error' ? 'offline-dot' : 'pending-dot'} />
            <div>
              <b>{helixLabel}</b>
              <span>{helixStatus === 'connected' ? `Monitoreo activo${lastTwitchUpdate ? ` · actualizado ${new Date(lastTwitchUpdate).toLocaleTimeString()}` : ''}` : twitchError ?? 'Preparando consulta de métricas públicas'}</span>
            </div>
            <button className="secondary" onClick={() => void refreshTalentData().then(() => {
              const err = useAppStore.getState().twitchError
              if (err) toastError('No pudimos actualizar los datos de Twitch. Inténtalo de nuevo.')
              else toastSuccess('Datos de Twitch actualizados.')
            })}>Reintentar</button>
          </div>
        </Card>
        {showSecrets && <TwitchHelixSettings/>}
        <BackfillPanel/>
        <TwitchTrackerPanel/>
        <SupabaseStatusCard/>
        <NativeAlertSettings/>
        <LiveSoundSettings/>
        <DiscordSettings/>
        <GoogleCalendarSettings/>
        <UpdaterPanel/>
      </>
    )}
  </div>
    )}
  </>
}

function CommandPalette() {
  const open = useAppStore((s) => s.commandOpen)
  const setOpen = useAppStore((s) => s.setCommandOpen)
  return <GlobalSearch open={open} onClose={() => setOpen(false)} />
}

function ShortcutsHelp() {
  const open = useAppStore((s) => s.shortcutsOpen)
  const setOpen = useAppStore((s) => s.setShortcutsOpen)
  return <ShortcutsModal open={open} onClose={() => setOpen(false)} />
}

function RoleRouteGuard() {
  const roles = useAuthStore((s) => s.roles)
  const login = useAuthStore((s) => s.session)?.login
  const location = useLocation()
  const path = location.pathname
  const inlinePermissionRoutes = [
    '/control',
    '/inteligencia',
    '/ciencia-datos',
    '/ml',
    '/estadisticas',
    '/analitica',
    '/auditoria',
  ]
  if (inlinePermissionRoutes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return null
  }
  if (!canAccessPath(roles, location.pathname, login)) {
    return <Navigate to={defaultPathForRoles(roles, login)} replace />
  }
  return null
}

function Shell() {
  const [mobile, setMobile] = useState(false)
  const [isNarrow, setIsNarrow] = useState(false)
  const [collapsed, setCollapsed] = useState(readSidebarCollapsed)
  const [sectionCollapsed, setSectionCollapsed] = useState<SidebarSectionState>(readSidebarSections)
  const demo = useAppStore((s) => s.demoMode)
  const helixStatus = useAppStore((s) => s.helixStatus)
  const refreshTalentData = useAppStore((s) => s.refreshTalentData)
  const setCommandOpen = useAppStore((s) => s.setCommandOpen)
  const setShortcutsOpen = useAppStore((s) => s.setShortcutsOpen)
  const session = useAuthStore((s) => s.session)
  const roles = useAuthStore((s) => s.roles)
  const logout = useAuthStore((s) => s.logout)
  const login = session?.login
  const location = useLocation()
  const noRole = isNoRoleUser(roles, login)
  const showAudit = canViewAudit(roles)
  const showControlCenter = canAccessControlCenter(roles, login)
  const showSettingsNav = canAccessPath(roles, '/ajustes', login) && !noRole
  const [navPrefs, setNavPrefs] = useState(() => readNavVisibilityPrefs(login))
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  useEffect(() => {
    setNavPrefs(readNavVisibilityPrefs(login))
    const onChange = () => setNavPrefs(readNavVisibilityPrefs(login))
    window.addEventListener(NAV_VISIBILITY_CHANGED, onChange)
    return () => window.removeEventListener(NAV_VISIBILITY_CHANGED, onChange)
  }, [login])

  useEffect(() => {
    if (noRole) return
    const section = navSections.find((s) =>
      s.items.some(([to]) => (to === '/' ? location.pathname === '/' : location.pathname === to || location.pathname.startsWith(`${to}/`))),
    )
    if (!section) return
    setSectionCollapsed((prev) => {
      if (!isSidebarSectionCollapsed(prev, section.title)) return prev
      const next = { ...prev, [section.title]: false }
      writeSidebarSections(next)
      return next
    })
  }, [location.pathname, noRole])

  useEffect(() => {
    if (noRole) return
    const mq = window.matchMedia('(max-width: 1024px)')
    const update = () => {
      setIsNarrow(mq.matches)
      if (!mq.matches) setMobile(false)
    }
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [noRole])

  useEffect(() => {
    if (noRole) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing = target?.closest('input, textarea, select, [contenteditable="true"]')
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setCommandOpen(true) }
      if (!typing && e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setShortcutsOpen(true)
      }
      if (e.key === 'Escape') { setCommandOpen(false); setShortcutsOpen(false); setUserMenuOpen(false); setMobile(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setCommandOpen, setShortcutsOpen, noRole])

  useEffect(() => {
    if (noRole) return
    if (!userMenuOpen) return
    const close = () => setUserMenuOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [userMenuOpen, noRole])

  useEffect(() => {
    if (noRole) return
    void refreshTalentData()
    const polling = window.setInterval(() => { void refreshTalentData() }, 60_000)
    return () => window.clearInterval(polling)
  }, [refreshTalentData, noRole])

  if (noRole) {
    if (location.pathname !== '/') {
      return <Navigate to="/" replace />
    }
    return (
      <div className="app-shell no-role-shell">
        <NoRoleWaitingPage />
      </div>
    )
  }

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0') } catch { /* ignore */ }
      return next
    })
  }
  const toggleSection = (title: string) => {
    setSectionCollapsed((prev) => {
      const next = { ...prev, [title]: prev[title] === false }
      writeSidebarSections(next)
      return next
    })
  }
  const sidebarLabel = demo ? 'Requiere app de escritorio' : helixStatus === 'connected' ? 'Twitch conectado' : helixStatus === 'error' ? 'Error de conexión Twitch' : 'Conectando con Twitch…'
  const sidebarDot = demo || helixStatus === 'error' ? 'offline-dot' : helixStatus === 'connected' ? 'online-dot' : 'pending-dot'
  const avatarLabel = session?.displayName.slice(0, 2).toUpperCase() ?? 'NL'
  const shellClass = [collapsed ? 'app-shell vision-ui sidebar-collapsed' : 'app-shell vision-ui', isNarrow ? 'is-narrow' : ''].filter(Boolean).join(' ')
  const asideClass = [mobile ? 'open' : '', collapsed && !isNarrow ? 'collapsed' : ''].filter(Boolean).join(' ')
  const renderNavLink = (item: NavItem) => {
    const [to, label, Icon] = item
    const tourId = navTourIds[to]
    return (
      <NavLink
        key={to}
        to={to}
        end={to === '/' || to === '/diseno' || to === '/neuralleague' || to === '/control'}
        onClick={() => setMobile(false)}
        title={collapsed ? label : undefined}
        data-nav-label={label}
        data-tour={tourId}
        className={to === '/control' ? 'nav-control-center' : undefined}
      >
        <Icon className="sidebar-icon" size={16} strokeWidth={1.6} absoluteStrokeWidth />
        <span className="sidebar-link-label">{label}</span>
      </NavLink>
    )
  }
  return <div className={shellClass}><DiscordPresenceSync /><OrgPresenceSync /><aside className={asideClass}>
    <div className="sidebar-brand-header">
      <div className="brand">
        <div className="brand-mark" aria-hidden>NG</div>
        <img src={neuraliveLogotype} alt="NeuraGest by NeuraLive" className="brand-logotype" draggable={false} />
        <button type="button" className="sidebar-mobile-close" onClick={() => setMobile(false)} aria-label="Cerrar menú"><X size={16} strokeWidth={1.6} /></button>
      </div>
      <small className="brand-app-name">NeuraGest</small>
    </div>
    <button type="button" className="sidebar-collapse-btn" onClick={toggleCollapsed} aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'} aria-expanded={!collapsed}>
      {collapsed ? <ChevronRight size={14} strokeWidth={1.6} /> : <ChevronLeft size={14} strokeWidth={1.6} />}
    </button>
    <nav>
      {navSections.map((section) => {
        const visibleItems = filterNavItems(
          section.title,
          section.items,
          roles,
          login,
          navPrefs,
          showAudit,
          showControlCenter,
        )
        if (visibleItems.length === 0) return null
        const isSectionCollapsed = isSidebarSectionCollapsed(sectionCollapsed, section.title)
        return (
          <div
            className={`sidebar-section${isSectionCollapsed ? ' sidebar-section-collapsed' : ''}`}
            key={section.title}
          >
            <button
              type="button"
              className="sidebar-section-toggle"
              onClick={() => toggleSection(section.title)}
              aria-expanded={!isSectionCollapsed}
              aria-label={`${section.title} — ${isSectionCollapsed ? 'expandir' : 'colapsar'} sección`}
            >
              <span className="sidebar-section-label">{section.title}</span>
              <ChevronDown
                size={12}
                strokeWidth={1.6}
                className={`sidebar-section-chevron${isSectionCollapsed ? ' collapsed' : ''}`}
              />
            </button>
            <div className="sidebar-section-body" inert={!collapsed && isSectionCollapsed ? true : undefined} aria-hidden={isSectionCollapsed && !collapsed}>
              <div className="sidebar-section-body-inner">
                {visibleItems.map(renderNavLink)}
              </div>
            </div>
          </div>
        )
      })}
      {showSettingsNav && !isNavItemHidden(navPrefs, settingsNav[0], 'Ajustes') && (
        <div className="sidebar-section sidebar-section-settings">
          {renderNavLink(settingsNav)}
        </div>
      )}
    </nav>
    <div className="sidebar-footer" title={collapsed ? sidebarLabel : undefined}>
      <div className={sidebarDot} />
      <span>{sidebarLabel}<small>Monitoreo público + caché local</small></span>
    </div>
  </aside>
    <main><header className="app-header"><button className="mobile-menu" onClick={() => setMobile(true)} aria-label="Abrir menú"><Menu/></button><button className="quick-search" onClick={() => setCommandOpen(true)}><Search size={16}/>Buscar en NeuraGest<kbd>Ctrl K</kbd></button><div className="header-actions"><ActiveUsersBadge/><ActivityInbox/><div className="user-menu-wrap"><div className="header-user-block"><div className="header-user-text"><b>{session?.displayName ?? 'Usuario'}</b><span>@{session?.login ?? 'twitch'}</span></div><button className="user-avatar" onClick={(e) => { e.stopPropagation(); setUserMenuOpen((open) => !open) }} aria-label="Menú de usuario">{session?.avatarUrl ? <img src={session.avatarUrl} alt="" /> : avatarLabel}</button></div>{userMenuOpen && <div className="user-menu" onClick={(e) => e.stopPropagation()}><div className="user-menu-head"><b>{session?.displayName ?? 'Usuario'}</b><span>@{session?.login ?? 'twitch'}</span></div><button onClick={() => { setUserMenuOpen(false); void logout() }}><LogOut size={15}/>Cerrar sesión</button></div>}</div></div></header><OfflineBanner /><div className="content"><RoleRouteGuard/><PageTransition><Routes location={location}><Route path="/" element={<Dashboard/>}/><Route path="/control" element={<PermissionGate allowed={showControlCenter} denial={getControlCenterDenial(roles)}><ControlCenterPage/></PermissionGate>}/><Route path="/control/tareas" element={<PermissionGate allowed={showControlCenter} denial={getControlCenterDenial(roles)}><AssistantTasksPage/></PermissionGate>}/><Route path="/control/fichas" element={<PermissionGate allowed={showControlCenter} denial={getControlCenterDenial(roles)}><EventFichasPage/></PermissionGate>}/><Route path="/asistente" element={<Navigate to="/control" replace />}/><Route path="/war-room" element={<WarRoomPage/>}/><Route path="/talentos" element={<Talents/>}/><Route path="/talento/:login" element={<Suspense fallback={<div className="ml-loading" style={{padding:40,textAlign:'center'}}><Loader2 size={20} className="ml-spin"/> Cargando perfil…</div>}><TalentProfilePage/></Suspense>}/><Route path="/pipeline" element={<PipelinePage/>}/><Route path="/crm" element={<CrmPage/>}/><Route path="/rate-card" element={<RateCardPage/>}/><Route path="/brief" element={<BriefPage/>}/><Route path="/assets" element={<AssetsPage/>}/><Route path="/diseno" element={<CreativeDrivePage/>}/><Route path="/diseno/huecos" element={<ChannelGapsPage/>}/><Route path="/diseno/briefs" element={<CreativeBriefsPage/>}/><Route path="/neuralleague" element={<NeuraLeagueOverviewPage/>}/><Route path="/neuralleague/equipos" element={<NeuraLeagueTeamsPage/>}/><Route path="/neuralleague/jugadores" element={<NeuraLeaguePlayersPage/>}/><Route path="/neuralleague/calendario" element={<NeuraLeagueCalendarPage/>}/><Route path="/neuralleague/stats" element={<NeuraLeagueStatsPage/>}/><Route path="/neuralleague/vods" element={<NeuraLeagueVodsPage/>}/><Route path="/neuralleague/entrenamientos" element={<NeuraLeagueTrainingPage/>}/><Route path="/neuralleague/reclutamiento" element={<NeuraLeagueRecruitmentPage/>}/><Route path="/neuralleague/operacion" element={<NeuraLeagueOperationsPage/>}/><Route path="/handoff" element={<HandoffPage/>}/><Route path="/comisiones" element={<CommissionsPage/>}/><Route path="/portal" element={<PortalPage/>}/><Route path="/portal/:login" element={<PortalPage/>}/><Route path="/media-kit" element={<MediaKitPage/>}/><Route path="/media-kit/comparar" element={<MediaKitComparePage/>}/><Route path="/vod-digest" element={<VodDigestPage/>}/><Route path="/board-pack" element={<BoardPackPage/>}/><Route path="/schedule" element={<ScheduleCompliancePage/>}/><Route path="/onboarding" element={<OnboardingPage/>}/><Route path="/tareas" element={<TasksPage/>}/><Route path="/wiki" element={<WikiPage/>}/><Route path="/documentos" element={<Documents/>}/><Route path="/calendario" element={<CalendarPage/>}/><Route path="/inteligencia" element={<PermissionGate allowed={canAccessDatosNav(roles, login)} denial={getDatosDenial(roles)}><TwitchIntelligencePage/></PermissionGate>}/><Route path="/ciencia-datos" element={<PermissionGate allowed={canAccessDatosNav(roles, login)} denial={getDatosDenial(roles)}><Suspense fallback={<div className="ml-loading" style={{padding:40,textAlign:'center'}}><Loader2 size={20} className="ml-spin"/> Cargando ML…</div>}><MlPage/></Suspense></PermissionGate>}/><Route path="/ml" element={<PermissionGate allowed={canAccessDatosNav(roles, login)} denial={getDatosDenial(roles)}><Suspense fallback={<div className="ml-loading" style={{padding:40,textAlign:'center'}}><Loader2 size={20} className="ml-spin"/> Cargando ML…</div>}><MlPage/></Suspense></PermissionGate>}/><Route path="/estadisticas" element={<PermissionGate allowed={canAccessDatosNav(roles, login)} denial={getDatosDenial(roles)}><PlatformStatsPage/></PermissionGate>}/><Route path="/analitica" element={<PermissionGate allowed={canAccessDatosNav(roles, login)} denial={getDatosDenial(roles)}><Analytics/></PermissionGate>}/><Route path="/auditoria" element={<PermissionGate allowed={showAudit && canAccessDatosNav(roles, login)} denial={getDatosDenial(roles)}><AuditPage/></PermissionGate>}/><Route path="/ajustes" element={<SettingsPage/>}/></Routes></PageTransition></div></main><CommandPalette/><ShortcutsHelp/><BackgroundUpdater/><OnboardingModal/><ManagerTour/></div>
}

function AppGate() {
  const status = useAuthStore((s) => s.status)
  const initialize = useAuthStore((s) => s.initialize)
  const [minSplashElapsed, setMinSplashElapsed] = useState(false)
  const [authBootstrapDone, setAuthBootstrapDone] = useState(false)

  useEffect(() => {
    const minTimer = window.setTimeout(() => setMinSplashElapsed(true), 1200)
    return () => window.clearTimeout(minTimer)
  }, [])

  useEffect(() => {
    void initialize().finally(() => setAuthBootstrapDone(true))
  }, [initialize])

  const showSplash = !minSplashElapsed || !authBootstrapDone

  if (showSplash) {
    return <SplashScreen />
  }

  if (status !== 'authenticated') {
    return <LoginScreen />
  }

  return <Shell />
}

export default function App() {
  return <BrowserRouter><ToastHost /><AppGate/></BrowserRouter>
}
