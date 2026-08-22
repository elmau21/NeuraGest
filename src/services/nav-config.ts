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
    title: 'Tu día',
    items: [
      ['/control', 'Centro de control', LayoutDashboard],
      ['/', 'Resumen', PanelsTopLeft],
      ['/tareas', 'Tareas', ListTodo],
      ['/talentos', 'Talentos', Users],
    ],
  },
  {
    title: 'Operación',
    items: [
      ['/war-room', 'War Room', Scan],
      ['/calendario', 'Calendario', CalendarDays],
      ['/pipeline', 'Pipeline', Columns3],
      ['/crm', 'CRM', Handshake],
      ['/schedule', 'Cumplimiento', CalendarCheck],
      ['/comisiones', 'Comisiones', Wallet],
      ['/portal', 'Portal', PanelRight],
    ],
  },
  {
    title: 'Contenido',
    items: [
      ['/rate-card', 'Tarifas', Percent],
      ['/brief', 'Brief', PenLine],
      ['/assets', 'Recursos', Image],
      ['/handoff', 'Entrega', Forward],
      ['/media-kit', 'Media Kit', Contact],
      ['/media-kit/comparar', 'Comparar kits', GitCompare],
      ['/vod-digest', 'Resumen VOD', Film],
      ['/board-pack', 'Board pack', Package],
      ['/onboarding', 'Onboarding', Sparkles],
      ['/wiki', 'Wiki', BookOpen],
      ['/documentos', 'Documentos', FileText],
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
      ['/neuralleague/calendario', 'Calendario liga', CalendarDays],
      ['/neuralleague/stats', 'Estadísticas liga', ChartColumn],
      ['/neuralleague/vods', 'VODs', Film],
      ['/neuralleague/entrenamientos', 'Entrenamientos', Activity],
      ['/neuralleague/reclutamiento', 'Reclutamiento', UserSearch],
      ['/neuralleague/operacion', 'Operación liga', ListChecks],
    ],
  },
  {
    title: 'Datos',
    items: [
      ['/analitica', 'Analítica', PieChart],
      ['/estadisticas', 'Estadísticas', ChartColumn],
      ['/inteligencia', 'Inteligencia Twitch', Brain],
      ['/ciencia-datos', 'Ciencia de datos', Beaker],
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

/** Sección legacy del sidebar (compatibilidad con preferencias guardadas). */
export const LEGACY_NAV_SECTION_ALIASES: Record<string, string> = {
  Operaciones: 'Tu día',
  Análisis: 'Datos',
}

export function resolveNavSectionTitle(title: string): string {
  return LEGACY_NAV_SECTION_ALIASES[title] ?? title
}
