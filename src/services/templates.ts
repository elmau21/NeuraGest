import { createCalendarEvent } from '@/services/calendar'
import { createTask } from '@/services/tasks'
import { supabase } from '@/services/supabase'

export type TemplateKind = 'tournament' | 'campaign' | 'new_talent'

export type TemplateDefinition = {
  id: TemplateKind
  title: string
  description: string
  tasks: Array<{ title: string; description: string; daysOffset: number; estimate: number }>
  events: Array<{ title: string; type: 'tournament' | 'campaign' | 'meeting' | 'delivery' | 'stream'; daysOffset: number; hours: number }>
}

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'tournament',
    title: 'Torneo',
    description: 'Checklist operativo para torneos internos o con marcas.',
    tasks: [
      { title: 'Definir reglas y formato', description: 'Bracket, horarios y premios.', daysOffset: -14, estimate: 2 },
      { title: 'Briefing a talentos', description: 'Comunicar fechas y requisitos técnicos.', daysOffset: -10, estimate: 1 },
      { title: 'Assets y overlays', description: 'Gráficos, alertas y escenas OBS.', daysOffset: -7, estimate: 4 },
      { title: 'Ensayo general', description: 'Prueba de conexión y moderación.', daysOffset: -1, estimate: 2 },
    ],
    events: [
      { title: 'Kick-off torneo', type: 'meeting', daysOffset: -14, hours: 11 },
      { title: 'Día del torneo', type: 'tournament', daysOffset: 0, hours: 18 },
    ],
  },
  {
    id: 'campaign',
    title: 'Campaña',
    description: 'Lanzamiento de campaña con entregables y fechas clave.',
    tasks: [
      { title: 'Brief de campaña', description: 'Objetivos, KPIs y mensajes.', daysOffset: -21, estimate: 3 },
      { title: 'Calendario de contenidos', description: 'Streams, clips y redes.', daysOffset: -14, estimate: 2 },
      { title: 'Materiales de marca', description: 'Aprobación de assets del patrocinador.', daysOffset: -7, estimate: 2 },
      { title: 'Reporte post-campaña', description: 'Métricas y aprendizajes.', daysOffset: 7, estimate: 2 },
    ],
    events: [
      { title: 'Inicio campaña', type: 'campaign', daysOffset: 0, hours: 12 },
      { title: 'Cierre y reporte', type: 'delivery', daysOffset: 7, hours: 17 },
    ],
  },
  {
    id: 'new_talent',
    title: 'Nuevo talento',
    description: 'Onboarding operativo para incorporar un talento a la agencia.',
    tasks: [
      { title: 'Revisión de contrato', description: 'Legal y condiciones comerciales.', daysOffset: -7, estimate: 1 },
      { title: 'Setup técnico', description: 'OBS, bots, alertas y permisos.', daysOffset: -5, estimate: 3 },
      { title: 'Brand kit personal', description: 'Overlays, emotes y guía de tono.', daysOffset: -3, estimate: 2 },
      { title: 'Stream de debut', description: 'Acompañamiento en directo.', daysOffset: 0, estimate: 4 },
    ],
    events: [
      { title: 'Reunión de bienvenida', type: 'meeting', daysOffset: -7, hours: 16 },
      { title: 'Debut oficial', type: 'stream', daysOffset: 0, hours: 19 },
    ],
  },
]

function addDays(base: Date, days: number, hours: number): { start: Date; end: Date } {
  const start = new Date(base)
  start.setDate(start.getDate() + days)
  start.setHours(hours, 0, 0, 0)
  const end = new Date(start)
  end.setHours(start.getHours() + 1)
  return { start, end }
}

export async function applyTemplate(kind: TemplateKind): Promise<{ tasks: number; events: number } | null> {
  const template = TEMPLATES.find((item) => item.id === kind)
  if (!template) return null
  const base = new Date()
  let taskCount = 0
  let eventCount = 0

  for (const taskDef of template.tasks) {
    const due = new Date(base)
    due.setDate(due.getDate() + taskDef.daysOffset)
    const created = await createTask({
      title: taskDef.title,
      description: taskDef.description,
      dueDate: due.toISOString().slice(0, 10),
      estimate: taskDef.estimate,
      status: 'backlog',
      priority: 'medium',
    })
    if (created) taskCount += 1
  }

  for (const eventDef of template.events) {
    const { start, end } = addDays(base, eventDef.daysOffset, eventDef.hours)
    const created = await createCalendarEvent({
      title: eventDef.title,
      type: eventDef.type,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      description: `Generado desde plantilla «${template.title}»`,
    })
    if (created) eventCount += 1
  }

  if (supabase) {
    await supabase.rpc('log_activity', {
      p_entity_type: 'template',
      p_entity_id: null,
      p_action: 'applied',
      p_metadata: { template: template.title, tasks: taskCount, events: eventCount },
    })
  }

  return { tasks: taskCount, events: eventCount }
}
