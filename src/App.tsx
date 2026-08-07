import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import {
  Activity, ArrowRightLeft, BarChart3, BookOpen, CalendarDays, CheckSquare, ChevronDown, ChevronLeft, ChevronRight,
  ClipboardList, DollarSign, FileText, FolderOpen, Handshake, LayoutDashboard, LayoutGrid, Loader2, LogOut, Menu,
  Search, Settings, Shield, Sparkles, Users, Wallet, X, FileDown, CalendarCheck, Radio, Brain,
  Globe, Columns2, Film, Archive, Cpu, LineChart,
} from 'lucide-react'
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
import { PermissionsPanel } from '@/features/settings/PermissionsPanel'
import { SupabaseStatusCard } from '@/features/settings/SupabaseStatusCard'
import { DiscordSettings } from '@/features/settings/DiscordSettings'
import { GoogleCalendarSettings } from '@/features/settings/GoogleCalendarSettings'
import { TwitchHelixSettings } from '@/features/settings/TwitchHelixSettings'
import { BackfillPanel } from '@/features/settings/BackfillPanel'
import { TwitchTrackerPanel } from '@/features/settings/TwitchTrackerPanel'
import { UpdaterPanel } from '@/features/settings/UpdaterPanel'
import { ManagerTour } from '@/features/onboarding/ManagerTour'
import { NativeAlertSettings } from '@/features/settings/NativeAlertSettings'
import { TwitchOAuthDoc } from '@/features/settings/TwitchOAuthDoc'
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
import { HandoffPage } from '@/features/handoff/HandoffPage'
import { AuditPage } from '@/features/audit/AuditPage'
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
import { canMutateCrm } from '@/services/permissions'

const MlPage = lazy(() => import('@/features/ml/MlPage'))
const TalentProfilePage = lazy(() => import('@/features/talent-profile/TalentProfilePage'))

const SIDEBAR_COLLAPSED_KEY = 'neuragest-sidebar-collapsed'
const SIDEBAR_SECTIONS_KEY = 'neuragest-sidebar-sections'

type SidebarSectionState = Record<string, boolean>

function readSidebarSections(): SidebarSectionState {
  try {
    const raw = localStorage.getItem(SIDEBAR_SECTIONS_KEY)
    return raw ? (JSON.parse(raw) as SidebarSectionState) : {}
  } catch {
    return {}
  }
}

function writeSidebarSections(state: SidebarSectionState) {
  try {
    localStorage.setItem(SIDEBAR_SECTIONS_KEY, JSON.stringify(state))
  } catch { /* ignore */ }
}

type NavItem = readonly [string, string, typeof LayoutDashboard]

const navSections: ReadonlyArray<{ title: string; items: readonly NavItem[] }> = [
  {
    title: 'Ops',
    items: [
      ['/', 'Dashboard', LayoutDashboard],
      ['/war-room', 'War Room', Radio],
      ['/talentos', 'Talentos', Users],
      ['/pipeline', 'Pipeline', LayoutGrid],
      ['/crm', 'CRM', Handshake],
      ['/schedule', 'Schedule', CalendarCheck],
      ['/comisiones', 'Comisiones', Wallet],
      ['/portal', 'Portal', Globe],
    ],
  },
  {
    title: 'Contenido',
    items: [
      ['/rate-card', 'Rate Card', DollarSign],
      ['/brief', 'Brief', ClipboardList],
      ['/assets', 'Assets', FolderOpen],
      ['/handoff', 'Handoff', ArrowRightLeft],
      ['/media-kit', 'Media Kit', FileDown],
      ['/media-kit/comparar', 'Comparar kits', Columns2],
      ['/vod-digest', 'VOD digest', Film],
      ['/board-pack', 'Board pack', Archive],
      ['/onboarding', 'Onboarding', Sparkles],
      ['/tareas', 'Tareas', CheckSquare],
      ['/wiki', 'Wiki', BookOpen],
      ['/documentos', 'Documentos', FileText],
      ['/calendario', 'Calendario', CalendarDays],
    ],
  },
  {
    title: 'Datos',
    items: [
      ['/inteligencia', 'Inteligencia', Brain],
      ['/ciencia-datos', 'Ciencia de datos', Cpu],
      ['/estadisticas', 'Estadísticas', LineChart],
      ['/analitica', 'Analítica', BarChart3],
      ['/auditoria', 'Auditoría', Shield],
    ],
  },
] 

const settingsNav: NavItem = ['/ajustes', 'Ajustes', Settings]

const navTourIds: Record<string, string> = {
  '/war-room': 'nav-war-room',
  '/crm': 'nav-crm',
  '/inteligencia': 'nav-inteligencia',
  '/ciencia-datos': 'nav-ml',
  '/ml': 'nav-ml',
  '/ajustes': 'nav-ajustes',
}

const nav: NavItem[] = [...navSections.flatMap((section) => section.items), settingsNav]

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
  return <><PageTitle title="Talentos" description="Rendimiento, actividad y perfiles de la agencia." action={<button className="primary" disabled={loading} onClick={() => void refreshTalentData()}><Activity size={16}/>{loading ? 'Actualizando…' : 'Actualizar Twitch'}</button>}/>
    <Card><div className="toolbar"><label className="search"><Search size={16}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar talento..."/></label><button className="secondary">Todos los estados</button></div>
      <div className="talent-table"><div className="table-header"><span>Talento</span><span>Estado</span><span>Categoría</span><span>Followers</span><span>Viewers</span></div>
        {filtered.map((t) => <div className="table-row talent-row-clickable" key={t.id} role="button" tabIndex={0} onClick={() => navigate(`/talento/${t.login}`)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/talento/${t.login}`) } }}><div className="talent-cell">{t.avatar ? <img src={t.avatar} alt=""/> : <div className="avatar-placeholder">{t.displayName.slice(0, 2).toUpperCase()}</div>}<div><b>{t.displayName}</b><span>@{t.login}</span></div></div><span className={t.isLive ? 'status live' : 'status'}>{t.isLive ? '● En directo' : t.id.startsWith('pending-') ? 'Consultando…' : 'Offline'}</span><span>{t.category}</span><span>{t.followers > 0 ? t.followers.toLocaleString() : '—'}</span><span>{t.viewers.toLocaleString()} <ChevronRight size={15}/></span></div>)}
        {hasCompletedSync && !loading && filtered.length === 0 && <p className="empty-state">No hay talentos que coincidan con la búsqueda.</p>}
      </div>
    </Card></>
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
  const [settingsTab, setSettingsTab] = useState<'general' | 'permisos' | 'plantillas'>('general')

  const helixLabel = helixStatus === 'connected'
    ? 'Conexión Twitch activa'
    : helixStatus === 'connecting' ? 'Conectando con Twitch…' : helixStatus === 'error' ? 'Error de conexión Twitch' : 'Conexión Twitch pendiente'

  return <><PageTitle title="Ajustes" description="Integraciones, seguridad y preferencias."/>
    <div className="view-tabs settings-tabs">
      <button className={settingsTab === 'general' ? 'active' : ''} onClick={() => setSettingsTab('general')}>General</button>
      {canAdmin && <button className={settingsTab === 'permisos' ? 'active' : ''} onClick={() => setSettingsTab('permisos')} disabled={crmReadonly} title={crmReadonly ? 'Sin permisos CRM' : undefined}>Permisos</button>}
      <button className={settingsTab === 'plantillas' ? 'active' : ''} onClick={() => setSettingsTab('plantillas')}>Plantillas</button>
    </div>
    {settingsTab === 'permisos' && canAdmin ? (
      <Card className="permissions-card"><PermissionsPanel/></Card>
    ) : settingsTab === 'plantillas' ? (
      <TemplatesPanel/>
    ) : (
    <div className="settings-grid">
    <Card><h3>Sesión Twitch</h3><p>Tu identidad en NeuraGest está vinculada a tu cuenta de Twitch.</p>
      <div className="connection oauth-connection session-connection">
        {session?.avatarUrl
          ? <img src={session.avatarUrl} alt="" className="session-avatar" />
          : <div className="avatar-placeholder">{session?.displayName.slice(0, 2).toUpperCase() ?? 'NL'}</div>}
        <div><b>{session?.displayName ?? 'Sin sesión'}</b><span>{session ? `@${session.login}` : 'Inicia sesión con Twitch para continuar'}</span></div>
      </div>
      <div className="settings-session-actions">
        <button className="twitch-button" disabled={isReconnecting} onClick={() => void startTwitchLogin()}>
          {isReconnecting ? 'Esperando autorización…' : session ? 'Reconectar cuenta' : 'Iniciar sesión'}
        </button>
        {session && <button className="secondary" onClick={() => void logout()}><LogOut size={15}/>Cerrar sesión</button>}
      </div>
      {authError && oauthFlow === 'idle' && <p className="integration-note">{authError}</p>}
      {identityError && <p className="integration-note">Sincronización de cuenta: {identityError}</p>}
      {roles.length > 0 && <p className="integration-note">Roles: {roles.join(', ')}</p>}
      <TwitchOAuthDoc/>
      {crmReadonly && roles.includes('staff') && <p className="integration-note staff-readonly-banner">Staff: CRM, permisos y wiki crítica en solo lectura.</p>}
      {oauthFlow !== 'idle' && (
        <OAuthWaitingPanel
          phase={oauthFlow}
          error={authError}
          onCancel={cancelOAuthFlow}
          onRetry={() => void startTwitchLogin()}
        />
      )}
    </Card>
    <Card><h3>Monitoreo Twitch</h3><p>Métricas públicas de talentos en tiempo casi real.</p>
      <div className={`connection helix-connection ${helixStatus}`}><div className={helixStatus === 'connected' ? 'online-dot' : helixStatus === 'error' ? 'offline-dot' : 'pending-dot'}/><div><b>{helixLabel}</b><span>{helixStatus === 'connected' ? `Monitoreo activo${lastTwitchUpdate ? ` · actualizado ${new Date(lastTwitchUpdate).toLocaleTimeString()}` : ''}` : twitchError ?? 'Preparando consulta de métricas públicas'}</span></div><button className="secondary" onClick={() => void refreshTalentData()}>Reintentar</button></div>
    </Card>
    <TwitchHelixSettings/>
    <BackfillPanel/>
    <TwitchTrackerPanel/>
    <SupabaseStatusCard/>
    <NativeAlertSettings/>
    <DiscordSettings/>
    <GoogleCalendarSettings/>
    <Card><h3>Preferencias in-app</h3><p>Alertas nativas Windows, avisos a Discord o inbox de actividad.</p></Card>
    <UpdaterPanel/>
  </div>
    )}
  </>
}

function CommandPalette() {
  const open = useAppStore((s) => s.commandOpen)
  const setOpen = useAppStore((s) => s.setCommandOpen)
  const navigate = useNavigate()
  if (!open) return null
  return <div className="modal-backdrop" onClick={() => setOpen(false)}><div className="command-modal" onClick={(e) => e.stopPropagation()}><div><Search size={19}/><input autoFocus placeholder="Buscar talentos, tareas, documentos…"/><kbd>ESC</kbd></div>{nav.filter(([to]) => to !== '/ajustes').map(([to,label,Icon]) => <button key={to} onClick={() => { navigate(to); setOpen(false) }}><Icon size={17}/>{label}<span>Ir a</span></button>)}</div></div>
}

function Shell() {
  const [mobile, setMobile] = useState(false)
  const [collapsed, setCollapsed] = useState(readSidebarCollapsed)
  const [sectionCollapsed, setSectionCollapsed] = useState<SidebarSectionState>(readSidebarSections)
  const demo = useAppStore((s) => s.demoMode)
  const helixStatus = useAppStore((s) => s.helixStatus)
  const refreshTalentData = useAppStore((s) => s.refreshTalentData)
  const setCommandOpen = useAppStore((s) => s.setCommandOpen)
  const session = useAuthStore((s) => s.session)
  const logout = useAuthStore((s) => s.logout)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0') } catch { /* ignore */ }
      return next
    })
  }
  const toggleSection = (title: string) => {
    setSectionCollapsed((prev) => {
      const next = { ...prev, [title]: !prev[title] }
      writeSidebarSections(next)
      return next
    })
  }
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setCommandOpen(true) } if (e.key === 'Escape') { setCommandOpen(false); setUserMenuOpen(false) } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey) }, [setCommandOpen])
  useEffect(() => {
    if (!userMenuOpen) return
    const close = () => setUserMenuOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [userMenuOpen])
  useEffect(() => {
    void refreshTalentData()
    const polling = window.setInterval(() => { void refreshTalentData() }, 60_000)
    return () => window.clearInterval(polling)
  }, [refreshTalentData])
  const sidebarLabel = demo ? 'Requiere app de escritorio' : helixStatus === 'connected' ? 'Twitch conectado' : helixStatus === 'error' ? 'Error de conexión Twitch' : 'Conectando con Twitch…'
  const sidebarDot = demo || helixStatus === 'error' ? 'offline-dot' : helixStatus === 'connected' ? 'online-dot' : 'pending-dot'
  const avatarLabel = session?.displayName.slice(0, 2).toUpperCase() ?? 'NL'
  const shellClass = collapsed ? 'app-shell sidebar-collapsed' : 'app-shell'
  const asideClass = [mobile ? 'open' : '', collapsed ? 'collapsed' : ''].filter(Boolean).join(' ')
  const renderNavLink = (item: NavItem) => {
    const [to, label, Icon] = item
    const tourId = navTourIds[to]
    return (
      <NavLink key={to} to={to} end={to === '/'} onClick={() => setMobile(false)} title={collapsed ? label : undefined} data-tour={tourId}>
        <Icon size={18} />
        <span className="sidebar-link-label">{label}</span>
      </NavLink>
    )
  }
  return <div className={shellClass}><aside className={asideClass}>
    <div className="sidebar-brand-header">
      <div className="brand">
        <div className="brand-mark" aria-hidden>NG</div>
        <img src={neuraliveLogotype} alt="NeuraGest by NeuraLive" className="brand-logotype" draggable={false} />
        <button type="button" className="sidebar-mobile-close" onClick={() => setMobile(false)} aria-label="Cerrar menú"><X /></button>
      </div>
      <small className="brand-app-name">NeuraGest</small>
    </div>
    <button type="button" className="sidebar-collapse-btn" onClick={toggleCollapsed} aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'} aria-expanded={!collapsed}>
      {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
    </button>
    <nav>
      {navSections.map((section) => {
        const isSectionCollapsed = Boolean(sectionCollapsed[section.title])
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
              title={collapsed ? section.title : undefined}
            >
              <span className="sidebar-section-label">{section.title}</span>
              {!collapsed && (
                <ChevronDown
                  size={14}
                  className={`sidebar-section-chevron${isSectionCollapsed ? ' collapsed' : ''}`}
                />
              )}
            </button>
            {!isSectionCollapsed && section.items.map(renderNavLink)}
          </div>
        )
      })}
      <div className="sidebar-section sidebar-section-settings">
        {renderNavLink(settingsNav)}
      </div>
    </nav>
    <div className="sidebar-footer" title={collapsed ? sidebarLabel : undefined}>
      <div className={sidebarDot} />
      <span>{sidebarLabel}<small>Monitoreo público + caché local</small></span>
    </div>
  </aside>
    <main><header><button className="mobile-menu" onClick={() => setMobile(true)}><Menu/></button><button className="quick-search" onClick={() => setCommandOpen(true)}><Search size={16}/>Buscar en NeuraGest<kbd>Ctrl K</kbd></button><div className="header-actions"><ActivityInbox/><div className="user-menu-wrap"><button className="user-avatar" onClick={(e) => { e.stopPropagation(); setUserMenuOpen((open) => !open) }} aria-label="Menú de usuario">{session?.avatarUrl ? <img src={session.avatarUrl} alt="" /> : avatarLabel}</button>{userMenuOpen && <div className="user-menu" onClick={(e) => e.stopPropagation()}><div className="user-menu-head"><b>{session?.displayName ?? 'Usuario'}</b><span>@{session?.login ?? 'twitch'}</span></div><button onClick={() => { setUserMenuOpen(false); void logout() }}><LogOut size={15}/>Cerrar sesión</button></div>}</div></div></header><div className="content"><Routes><Route path="/" element={<Dashboard/>}/><Route path="/war-room" element={<WarRoomPage/>}/><Route path="/talentos" element={<Talents/>}/><Route path="/talento/:login" element={<Suspense fallback={<div className="ml-loading" style={{padding:40,textAlign:'center'}}><Loader2 size={20} className="ml-spin"/> Cargando perfil…</div>}><TalentProfilePage/></Suspense>}/><Route path="/pipeline" element={<PipelinePage/>}/><Route path="/crm" element={<CrmPage/>}/><Route path="/rate-card" element={<RateCardPage/>}/><Route path="/brief" element={<BriefPage/>}/><Route path="/assets" element={<AssetsPage/>}/><Route path="/handoff" element={<HandoffPage/>}/><Route path="/comisiones" element={<CommissionsPage/>}/><Route path="/portal" element={<PortalPage/>}/><Route path="/portal/:login" element={<PortalPage/>}/><Route path="/media-kit" element={<MediaKitPage/>}/><Route path="/media-kit/comparar" element={<MediaKitComparePage/>}/><Route path="/vod-digest" element={<VodDigestPage/>}/><Route path="/board-pack" element={<BoardPackPage/>}/><Route path="/schedule" element={<ScheduleCompliancePage/>}/><Route path="/onboarding" element={<OnboardingPage/>}/><Route path="/tareas" element={<TasksPage/>}/><Route path="/wiki" element={<WikiPage/>}/><Route path="/documentos" element={<Documents/>}/><Route path="/calendario" element={<CalendarPage/>}/><Route path="/inteligencia" element={<TwitchIntelligencePage/>}/><Route path="/ciencia-datos" element={<Suspense fallback={<div className="ml-loading" style={{padding:40,textAlign:'center'}}><Loader2 size={20} className="ml-spin"/> Cargando ML…</div>}><MlPage/></Suspense>}/><Route path="/ml" element={<Suspense fallback={<div className="ml-loading" style={{padding:40,textAlign:'center'}}><Loader2 size={20} className="ml-spin"/> Cargando ML…</div>}><MlPage/></Suspense>}/><Route path="/estadisticas" element={<PlatformStatsPage/>}/><Route path="/analitica" element={<Analytics/>}/><Route path="/auditoria" element={<AuditPage/>}/><Route path="/ajustes" element={<SettingsPage/>}/></Routes></div></main><CommandPalette/><ManagerTour/></div>
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
  return <BrowserRouter><AppGate/></BrowserRouter>
}
