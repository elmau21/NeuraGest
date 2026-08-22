import { supabase } from '@/services/supabase'
import { currentActorMeta, logActivity } from '@/services/activity-log'
import { DEFAULT_ORG_ID } from '@/services/org'
import { readCache, writeCache } from '@/services/offline-cache'
import { useOfflineStore } from '@/stores/offline-store'
import type { Database } from '@/types/supabase'

export type DirectivaAprobacion = 'si' | 'no' | 'pendiente'
export type EventFichaEstado = 'idea' | 'planificacion' | 'produccion' | 'publicado' | 'cerrado'

export type EventFicha = {
  id: string
  nombre: string
  objetivo: string
  fecha?: string
  responsable: string
  participantes: string
  contenidoNecesario: string
  promocion: string
  recursos: string
  aprobacionDirectiva: DirectivaAprobacion
  estado: EventFichaEstado
  createdBy?: string
  createdByLogin?: string
  updatedBy?: string
  updatedByLogin?: string
  createdAt: string
  updatedAt: string
}

export type EventFichaInput = {
  nombre: string
  objetivo?: string
  fecha?: string
  responsable?: string
  participantes?: string
  contenidoNecesario?: string
  promocion?: string
  recursos?: string
  aprobacionDirectiva?: DirectivaAprobacion
  estado?: EventFichaEstado
}

type FichaRow = {
  id: string
  nombre: string
  objetivo: string
  fecha: string | null
  responsable: string
  participantes: string
  contenido_necesario: string
  promocion: string
  recursos: string
  aprobacion_directiva: DirectivaAprobacion
  estado: EventFichaEstado
  created_by: string | null
  created_by_login: string | null
  updated_by: string | null
  updated_by_login: string | null
  created_at: string
  updated_at: string
}

const SELECT =
  'id,nombre,objetivo,fecha,responsable,participantes,contenido_necesario,promocion,recursos,aprobacion_directiva,estado,created_by,created_by_login,updated_by,updated_by_login,created_at,updated_at'

export const APROBACION_LABELS: Record<DirectivaAprobacion, string> = {
  si: 'Sí',
  no: 'No',
  pendiente: 'Pendiente',
}

export const ESTADO_LABELS: Record<EventFichaEstado, string> = {
  idea: 'Idea',
  planificacion: 'Planificación',
  produccion: 'Producción',
  publicado: 'Publicado',
  cerrado: 'Cerrado',
}

function mapRow(row: FichaRow): EventFicha {
  return {
    id: row.id,
    nombre: row.nombre,
    objetivo: row.objetivo ?? '',
    fecha: row.fecha ? row.fecha.slice(0, 10) : undefined,
    responsable: row.responsable ?? '',
    participantes: row.participantes ?? '',
    contenidoNecesario: row.contenido_necesario ?? '',
    promocion: row.promocion ?? '',
    recursos: row.recursos ?? '',
    aprobacionDirectiva: row.aprobacion_directiva,
    estado: row.estado,
    createdBy: row.created_by ?? undefined,
    createdByLogin: row.created_by_login ?? undefined,
    updatedBy: row.updated_by ?? undefined,
    updatedByLogin: row.updated_by_login ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

type FichaInsert = Database['public']['Tables']['ops_event_fichas']['Insert']
function payloadFromInput(input: EventFichaInput): Omit<FichaInsert, 'organization_id'> {
  return {
    nombre: input.nombre.trim(),
    objetivo: input.objetivo?.trim() ?? '',
    fecha: input.fecha?.trim() || null,
    responsable: input.responsable?.trim() ?? '',
    participantes: input.participantes?.trim() ?? '',
    contenido_necesario: input.contenidoNecesario?.trim() ?? '',
    promocion: input.promocion?.trim() ?? '',
    recursos: input.recursos?.trim() ?? '',
    aprobacion_directiva: input.aprobacionDirectiva ?? 'pendiente',
    estado: input.estado ?? 'idea',
  }
}

async function actorFields() {
  if (!supabase) return { created_by: null, created_by_login: null, updated_by: null, updated_by_login: null }
  const { data: auth } = await supabase.auth.getUser()
  const actor = await currentActorMeta()
  const userId = auth.user?.id ?? null
  const login = actor.actorLogin ?? null
  return {
    created_by: userId,
    created_by_login: login,
    updated_by: userId,
    updated_by_login: login,
  }
}

export async function listEventFichas(): Promise<EventFicha[]> {
  const setCacheMode = useOfflineStore.getState().setUsingCache
  if (!supabase) {
    const cached = readCache<EventFicha[]>('event-fichas')
    setCacheMode(Boolean(cached?.length))
    return cached ?? []
  }
  try {
    const { data, error } = await supabase
      .from('ops_event_fichas')
      .select(SELECT)
      .eq('organization_id', DEFAULT_ORG_ID)
      .order('updated_at', { ascending: false })
    if (error || !data) {
      const cached = readCache<EventFicha[]>('event-fichas')
      setCacheMode(Boolean(cached?.length))
      return cached ?? []
    }
    const mapped = (data as FichaRow[]).map(mapRow)
    writeCache('event-fichas', mapped)
    setCacheMode(false)
    return mapped
  } catch {
    const cached = readCache<EventFicha[]>('event-fichas')
    setCacheMode(Boolean(cached?.length))
    return cached ?? []
  }
}

export async function fetchEventFicha(id: string): Promise<EventFicha | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('ops_event_fichas')
    .select(SELECT)
    .eq('organization_id', DEFAULT_ORG_ID)
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return null
  return mapRow(data as FichaRow)
}

export async function createEventFicha(input: EventFichaInput): Promise<EventFicha | null> {
  if (!supabase) return null
  const nombre = input.nombre.trim()
  if (!nombre) throw new Error('Escribe un nombre para la campaña o evento.')

  const actor = await actorFields()
  const payload = {
    organization_id: DEFAULT_ORG_ID,
    ...payloadFromInput(input),
    created_by: actor.created_by,
    created_by_login: actor.created_by_login,
    updated_by: actor.updated_by,
    updated_by_login: actor.updated_by_login,
  }

  const { data, error } = await supabase
    .from('ops_event_fichas')
    .insert(payload as FichaInsert)
    .select(SELECT)
    .single()

  if (error || !data) return null

  const row = mapRow(data as FichaRow)
  await logActivity('event_ficha', 'created', { title: row.nombre, estado: row.estado }, row.id)
  return row
}

export async function updateEventFicha(id: string, input: EventFichaInput): Promise<EventFicha | null> {
  if (!supabase) return null
  const nombre = input.nombre.trim()
  if (!nombre) throw new Error('Escribe un nombre para la campaña o evento.')

  const actor = await actorFields()
  const payload = {
    ...payloadFromInput(input),
    updated_by: actor.updated_by,
    updated_by_login: actor.updated_by_login,
  }

  const { data, error } = await supabase
    .from('ops_event_fichas')
    .update(payload)
    .eq('organization_id', DEFAULT_ORG_ID)
    .eq('id', id)
    .select(SELECT)
    .single()

  if (error || !data) return null

  const row = mapRow(data as FichaRow)
  await logActivity('event_ficha', 'updated', { title: row.nombre, estado: row.estado }, row.id)
  return row
}

export async function deleteEventFicha(id: string, nombre?: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('ops_event_fichas')
    .delete()
    .eq('organization_id', DEFAULT_ORG_ID)
    .eq('id', id)
  if (error) return false
  await logActivity('event_ficha', 'deleted', { title: nombre ?? '' }, id)
  return true
}
