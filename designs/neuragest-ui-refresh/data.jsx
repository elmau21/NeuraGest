/* Nav mirror of src/services/nav-config.ts + explorer screen catalog */

const NAV_SECTIONS = [
  {
    id: 'tu-dia',
    title: 'Tu día',
    icon: 'Layout',
    items: [
      { id: 'control', path: '/control', label: 'Centro de control', icon: 'Layout' },
      { id: 'dash', path: '/', label: 'Resumen', icon: 'Panels' },
      { id: 'tareas', path: '/tareas', label: 'Tareas', icon: 'ListTodo' },
      { id: 'talentos', path: '/talentos', label: 'Talentos', icon: 'Users' },
    ],
  },
  {
    id: 'operacion',
    title: 'Operación',
    icon: 'Scan',
    items: [
      { id: 'war-room', path: '/war-room', label: 'War Room', icon: 'Scan' },
      { id: 'calendario', path: '/calendario', label: 'Calendario', icon: 'Calendar' },
      { id: 'pipeline', path: '/pipeline', label: 'Pipeline', icon: 'Columns' },
      { id: 'crm', path: '/crm', label: 'CRM', icon: 'Handshake' },
      { id: 'schedule', path: '/schedule', label: 'Cumplimiento', icon: 'CalendarCheck' },
      { id: 'comisiones', path: '/comisiones', label: 'Comisiones', icon: 'Wallet' },
      { id: 'portal', path: '/portal', label: 'Portal', icon: 'Panel' },
    ],
  },
  {
    id: 'contenido',
    title: 'Contenido',
    icon: 'Package',
    items: [
      { id: 'rate-card', path: '/rate-card', label: 'Tarifas', icon: 'Percent' },
      { id: 'brief', path: '/brief', label: 'Brief', icon: 'Pen' },
      { id: 'assets', path: '/assets', label: 'Recursos', icon: 'Image' },
      { id: 'handoff', path: '/handoff', label: 'Entrega', icon: 'Forward' },
      { id: 'media-kit', path: '/media-kit', label: 'Media Kit', icon: 'Contact' },
      { id: 'media-kit-compare', path: '/media-kit/comparar', label: 'Comparar kits', icon: 'Compare' },
      { id: 'vod-digest', path: '/vod-digest', label: 'Resumen VOD', icon: 'Film' },
      { id: 'board-pack', path: '/board-pack', label: 'Board pack', icon: 'Package' },
      { id: 'onboarding', path: '/onboarding', label: 'Onboarding', icon: 'Sparkles' },
      { id: 'wiki', path: '/wiki', label: 'Wiki', icon: 'Book' },
      { id: 'documentos', path: '/documentos', label: 'Documentos', icon: 'File' },
    ],
  },
  {
    id: 'diseno-sec',
    title: 'Diseño',
    icon: 'Paint',
    items: [
      { id: 'diseno', path: '/diseno', label: 'Diseño gráfico', icon: 'Paint' },
      { id: 'huecos', path: '/diseno/huecos', label: 'Huecos de canal', icon: 'Template' },
      { id: 'briefs', path: '/diseno/briefs', label: 'Briefs creativos', icon: 'Checks' },
    ],
  },
  {
    id: 'neuralleague',
    title: 'NeuraLeague',
    icon: 'Award',
    items: [
      { id: 'nl-temp', path: '/neuralleague', label: 'Temporada', icon: 'Grid' },
      { id: 'nl-teams', path: '/neuralleague/equipos', label: 'Equipos', icon: 'Award' },
      { id: 'nl-players', path: '/neuralleague/jugadores', label: 'Jugadores', icon: 'Users' },
      { id: 'nl-cal', path: '/neuralleague/calendario', label: 'Calendario liga', icon: 'Calendar' },
      { id: 'nl-stats', path: '/neuralleague/stats', label: 'Estadísticas liga', icon: 'Chart' },
      { id: 'nl-vods', path: '/neuralleague/vods', label: 'VODs', icon: 'Film' },
      { id: 'nl-train', path: '/neuralleague/entrenamientos', label: 'Entrenamientos', icon: 'Activity' },
      { id: 'nl-recruit', path: '/neuralleague/reclutamiento', label: 'Reclutamiento', icon: 'UserSearch' },
      { id: 'nl-ops', path: '/neuralleague/operacion', label: 'Operación liga', icon: 'Checks' },
    ],
  },
  {
    id: 'datos',
    title: 'Datos',
    icon: 'Pie',
    items: [
      { id: 'analitica', path: '/analitica', label: 'Analítica', icon: 'Pie' },
      { id: 'estadisticas', path: '/estadisticas', label: 'Estadísticas', icon: 'Chart' },
      { id: 'inteligencia', path: '/inteligencia', label: 'Inteligencia Twitch', icon: 'Brain' },
      { id: 'ciencia', path: '/ciencia-datos', label: 'Ciencia de datos', icon: 'Beaker' },
      { id: 'auditoria', path: '/auditoria', label: 'Auditoría', icon: 'Shield' },
    ],
  },
];

const SETTINGS_NAV = { id: 'ajustes', path: '/ajustes', label: 'Ajustes', icon: 'Settings', sectionId: 'sistema' };
const SISTEMA_SECTION = { id: 'sistema', title: 'Sistema', icon: 'Settings', items: [SETTINGS_NAV] };

function findNavSection(navId) {
  if (navId === SETTINGS_NAV.id) return SISTEMA_SECTION;
  return NAV_SECTIONS.find((s) => s.items.some((i) => i.id === navId)) || NAV_SECTIONS[0];
}

const ALL_NAV_ITEMS = [...NAV_SECTIONS.flatMap((s) => s.items), SETTINGS_NAV];

const AUTH_SCREENS = [
  { id: 'login', label: 'Login', group: 'auth' },
  { id: 'waiting', label: 'Waiting', group: 'auth' },
  { id: 'norole', label: 'Sin rol', group: 'auth' },
];

const MODULE_SCREENS = ALL_NAV_ITEMS.map((item) => ({
  id: item.id,
  label: item.label,
  group: 'module',
  path: item.path,
}));

const PAGE_META = {
  control: { title: 'Centro de control', sub: 'Inbox operativo · atajos · fichas del día' },
  dash: { title: 'Resumen', sub: 'Señal del roster · KPIs · actividad reciente' },
  tareas: { title: 'Tareas', sub: 'Asignaciones multi-owner · estados · adjuntos' },
  talentos: { title: 'Talentos', sub: 'Roster Twitch · managers · estado de contrato' },
  'war-room': { title: 'War Room', sub: 'Mosaico multi-stream · chat · señal en vivo' },
  calendario: { title: 'Calendario', sub: 'Eventos de agencia · streams · entregas' },
  pipeline: { title: 'Pipeline', sub: 'Columnas de deals · etapas comerciales' },
  crm: { title: 'CRM', sub: 'Marcas · deals · follow-ups' },
  schedule: { title: 'Cumplimiento', sub: 'Horario vs emisión · gaps · alertas' },
  comisiones: { title: 'Comisiones', sub: 'Liquidaciones · % · periodos' },
  portal: { title: 'Portal', sub: 'Vista talento · materiales · checklist' },
  'rate-card': { title: 'Tarifas', sub: 'Rate card por formato y audiencia' },
  brief: { title: 'Brief', sub: 'Briefs de campaña · brief packs' },
  assets: { title: 'Recursos', sub: 'Assets reutilizables · tags · versiones' },
  handoff: { title: 'Entrega', sub: 'Handoff creativo · checklist de cierre' },
  'media-kit': { title: 'Media Kit', sub: 'Kits por talento · export PDF' },
  'media-kit-compare': { title: 'Comparar kits', sub: 'Side-by-side de perfiles comerciales' },
  'vod-digest': { title: 'Resumen VOD', sub: 'Digest de VODs · highlights candidatos' },
  'board-pack': { title: 'Board pack', sub: 'Pack ejecutivo · métricas de periodo' },
  onboarding: { title: 'Onboarding', sub: 'Tours · checklist de alta' },
  wiki: { title: 'Wiki', sub: 'Playbooks internos · SOPs' },
  documentos: { title: 'Documentos', sub: 'Drive · contratos · carpetas por rol' },
  diseno: { title: 'Diseño gráfico', sub: 'Creative Drive · carpetas · assets' },
  huecos: { title: 'Huecos de canal', sub: 'Gaps de branding · resolución' },
  briefs: { title: 'Briefs creativos', sub: 'Cola de briefs · estados de diseño' },
  'nl-temp': { title: 'NeuraLeague · Temporada', sub: 'Overview de temporada activa' },
  'nl-teams': { title: 'Equipos', sub: 'Roster de equipos de liga' },
  'nl-players': { title: 'Jugadores', sub: 'Plantilla · roles · disponibilidad' },
  'nl-cal': { title: 'Calendario liga', sub: 'Partidos · bloques de práctica' },
  'nl-stats': { title: 'Estadísticas liga', sub: 'Tabla · forma · líderes' },
  'nl-vods': { title: 'VODs liga', sub: 'Replays · tags de partido' },
  'nl-train': { title: 'Entrenamientos', sub: 'Sesiones · asistencia' },
  'nl-recruit': { title: 'Reclutamiento', sub: 'Pipeline de scouting' },
  'nl-ops': { title: 'Operación liga', sub: 'Checklist ops · incidencias' },
  analitica: { title: 'Analítica', sub: 'BI · tendencias · backfill' },
  estadisticas: { title: 'Estadísticas', sub: 'Platform stats · comparación' },
  inteligencia: { title: 'Inteligencia Twitch', sub: 'Heatmaps · clips · compliance' },
  ciencia: { title: 'Ciencia de datos', sub: 'ML · forecasting · scores' },
  auditoria: { title: 'Auditoría', sub: 'Actividad · presencia · cambios' },
  ajustes: { title: 'Ajustes', sub: 'Cuenta · permisos · integraciones · nav' },
};

Object.assign(window, {
  NAV_SECTIONS,
  SETTINGS_NAV,
  SISTEMA_SECTION,
  ALL_NAV_ITEMS,
  AUTH_SCREENS,
  MODULE_SCREENS,
  PAGE_META,
  findNavSection,
});
