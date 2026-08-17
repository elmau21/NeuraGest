import {
  Activity, Award, Beaker, BookOpen, Brain, CalendarCheck, CalendarDays, ChartColumn,
  Columns3, Contact, FileText, Film, Forward, GitCompare, Handshake, Image, LayoutDashboard,
  LayoutGrid, LayoutTemplate, ListChecks, ListTodo, Package, Paintbrush, PanelRight, PanelsTopLeft,
  PenLine, Percent, PieChart, Scan, Settings, Shield, Sparkles, UserSearch, Users, Wallet,
} from '@/components/icons'
import type { PlatformIcon } from '@/components/icons'

export type NavItem = readonly [path: string, label: string, icon: PlatformIcon]

export type NavSection = { title: string; items: readonly NavItem[] }

export const navSections: readonly NavSection[] = [
  {
    title: 'Ops',
    items: [
      ['/control', 'Centro de control', LayoutDashboard],
      ['/', 'Dashboard', PanelsTopLeft],
      ['/war-room', 'War Room', Scan],
      ['/talentos', 'Talentos', Users],
      ['/pipeline', 'Pipeline', Columns3],
      ['/crm', 'CRM', Handshake],
      ['/schedule', 'Schedule', CalendarCheck],
      ['/comisiones', 'Comisiones', Wallet],
      ['/portal', 'Portal', PanelRight],
    ],
  },
  {
    title: 'Contenido',
    items: [
      ['/rate-card', 'Rate Card', Percent],
      ['/brief', 'Brief', PenLine],
      ['/assets', 'Assets', Image],
      ['/handoff', 'Handoff', Forward],
      ['/media-kit', 'Media Kit', Contact],
      ['/media-kit/comparar', 'Comparar kits', GitCompare],
      ['/vod-digest', 'VOD digest', Film],
      ['/board-pack', 'Board pack', Package],
      ['/onboarding', 'Onboarding', Sparkles],
      ['/tareas', 'Tareas', ListTodo],
      ['/wiki', 'Wiki', BookOpen],
      ['/documentos', 'Documentos', FileText],
      ['/calendario', 'Calendario', CalendarDays],
    ],
  },
  {
    title: 'Diseño',
    items: [
      ['/diseno', 'Diseño gráfico', Paintbrush],
      ['/diseno/huecos', 'Huecos de canal', LayoutTemplate],
      ['/diseno/briefs', 'Briefs creativos', ListChecks],
    ],
  },
  {
    title: 'NeuraLeague',
    items: [
      ['/neuralleague', 'Temporada', LayoutGrid],
      ['/neuralleague/equipos', 'Equipos', Award],
      ['/neuralleague/jugadores', 'Jugadores', Users],
      ['/neuralleague/calendario', 'Calendario', CalendarDays],
      ['/neuralleague/stats', 'Stats', ChartColumn],
      ['/neuralleague/vods', 'VODs', Film],
      ['/neuralleague/entrenamientos', 'Entrenamientos', Activity],
      ['/neuralleague/reclutamiento', 'Reclutamiento', UserSearch],
      ['/neuralleague/operacion', 'Operación', ListChecks],
    ],
  },
  {
    title: 'Datos',
    items: [
      ['/inteligencia', 'Inteligencia', Brain],
      ['/ciencia-datos', 'Ciencia de datos', Beaker],
      ['/estadisticas', 'Estadísticas', ChartColumn],
      ['/analitica', 'Analítica', PieChart],
      ['/auditoria', 'Auditoría', Shield],
    ],
  },
]

export const settingsNav: NavItem = ['/ajustes', 'Ajustes', Settings]

export const navTourIds: Record<string, string> = {
  '/war-room': 'nav-war-room',
  '/crm': 'nav-crm',
  '/inteligencia': 'nav-inteligencia',
  '/ciencia-datos': 'nav-ml',
  '/ml': 'nav-ml',
  '/ajustes': 'nav-ajustes',
}

export const allNavItems: NavItem[] = [...navSections.flatMap((section) => section.items), settingsNav]
