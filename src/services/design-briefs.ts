import { supabase } from '@/services/supabase'
import { DEFAULT_ORG_ID } from '@/services/org'
import { isTauri } from '@/services/twitch'
import type { CalendarEventOps } from '@/services/ops'
import type { SponsorshipDeal, DbTalent } from '@/services/agency'
import { CHANNEL_ASSET_SPECS } from '@/services/twitch-asset-rules'
import { createDriveFolder, findTalentRootFolder, listAllDriveItems, type CreativeDriveItem } from '@/services/creative-drive'

export type DesignBriefStatus = 'draft' | 'ready' | 'done'

export type DesignBrief = {
  id: string
  title: string
  talentId?: string
  talentLogin?: string
  calendarEventId?: string
  dealId?: string
  streamTitle?: string
  streamStartsAt?: string
  body: string
  assetChecklist: string[]
  driveFolderId?: string
  status: DesignBriefStatus
  createdAt: string
  updatedAt: string
}

type BriefRow = {
  id: string
  title: string
  talent_id: string | null
  talent_login: string | null
  calendar_event_id: string | null
  deal_id: string | null
  stream_title: string | null
  stream_starts_at: string | null
  body: string
  asset_checklist: string[] | null
  drive_folder_id: string | null
  status: string
  created_at: string
  updated_at: string
}

const BRIEF_SELECT =
  'id,title,talent_id,talent_login,calendar_event_id,deal_id,stream_title,stream_starts_at,body,asset_checklist,drive_folder_id,status,created_at,updated_at'

function requireClient() {
  if (!isTauri) throw new Error('Briefs creativos requieren la app de escritorio.')
  if (!supabase) throw new Error('No hay conexión con el almacenamiento en la nube.')
  return supabase
}

function mapRow(row: BriefRow): DesignBrief {
  return {
    id: row.id,
    title: row.title,
    talentId: row.talent_id ?? undefined,
    talentLogin: row.talent_login ?? undefined,
    calendarEventId: row.calendar_event_id ?? undefined,
    dealId: row.deal_id ?? undefined,
    streamTitle: row.stream_title ?? undefined,
    streamStartsAt: row.stream_starts_at ?? undefined,
    body: row.body ?? '',
    assetChecklist: row.asset_checklist ?? [],
    driveFolderId: row.drive_folder_id ?? undefined,
    status: (['draft', 'ready', 'done'].includes(row.status) ? row.status : 'draft') as DesignBriefStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const STREAM_TYPES = new Set(['stream', 'tournament', 'campaign'])

export function upcomingStreamEvents(events: CalendarEventOps[], now = Date.now()): CalendarEventOps[] {
  return events
    .filter((e) => {
      const start = Date.parse(e.startsAt)
      if (Number.isNaN(start) || start < now) return false
      return STREAM_TYPES.has(e.eventType) || !e.eventType
    })
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
}

export function buildDesignBriefDraft(input: {
  event: CalendarEventOps
  talent?: DbTalent
  deals?: SponsorshipDeal[]
}): Omit<DesignBrief, 'id' | 'createdAt' | 'updatedAt' | 'status'> {
  const login = input.event.talentLogin ?? input.talent?.login
  const name = input.talent?.displayName ?? login ?? 'Talento'
  const when = new Date(input.event.startsAt)
  const whenLabel = when.toLocaleString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  const relatedDeals = (input.deals ?? []).filter((d) => {
    if (d.status !== 'active' && d.status !== 'negotiating') return false
    if (input.talent && d.talentId === input.talent.id) return true
    if (login && d.talentLogin?.toLowerCase() === login.toLowerCase()) return true
    return false
  })
  const dealLines = relatedDeals.length
    ? relatedDeals.map((d) => `· ${d.brandName}${d.deliverables ? ` — ${d.deliverables}` : ''}`).join('\n')
    : '· Sin collab CRM activa vinculada (revisar si aplica).'

  const checklist = [
    ...CHANNEL_ASSET_SPECS.map((s) => s.label),
    'Variante para anuncio / Discord (opcional)',
  ]

  const body = [
    `Brief creativo — ${name}`,
    ``,
    `Stream: ${input.event.title}`,
    `Cuándo: ${whenLabel}`,
    login ? `Canal: @${login}` : '',
    ``,
    `Objetivo`,
    `Preparar assets de canal listos para el stream (offline, paneles, banner / thumbnail según haga falta).`,
    ``,
    `Contexto CRM / collabs`,
    dealLines,
    ``,
    `Notas para diseño`,
    `· Mantener identidad visual del talento.`,
    `· Entregar en Diseño gráfico (Drive) dentro de la carpeta del talento.`,
    `· Marcar «Listo para Twitch» cuando pase validación de tamaño/formato.`,
    `· Cerrar el flujo en Assets o Handoff si el manager lo pide.`,
  ].filter(Boolean).join('\n')

  return {
    title: `Diseño · ${name} · ${input.event.title}`,
    talentId: input.talent?.id ?? input.event.talentId,
    talentLogin: login,
    calendarEventId: input.event.id,
    dealId: relatedDeals[0]?.id,
    streamTitle: input.event.title,
    streamStartsAt: input.event.startsAt,
    body,
    assetChecklist: checklist,
  }
}

export async function listDesignBriefs(): Promise<DesignBrief[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('design_briefs')
    .select(BRIEF_SELECT)
    .eq('organization_id', DEFAULT_ORG_ID)
    .is('deleted_at', null)
    .order('stream_starts_at', { ascending: true, nullsFirst: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as BriefRow[]).map(mapRow)
}

export async function saveDesignBrief(
  input: Omit<DesignBrief, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
): Promise<DesignBrief> {
  const client = requireClient()
  const payload = {
    organization_id: DEFAULT_ORG_ID,
    title: input.title.trim(),
    talent_id: input.talentId ?? null,
    talent_login: input.talentLogin ?? null,
    calendar_event_id: input.calendarEventId ?? null,
    deal_id: input.dealId ?? null,
    stream_title: input.streamTitle ?? null,
    stream_starts_at: input.streamStartsAt ?? null,
    body: input.body,
    asset_checklist: input.assetChecklist,
    drive_folder_id: input.driveFolderId ?? null,
    status: input.status,
  }

  if (input.id) {
    const { data, error } = await client
      .from('design_briefs')
      .update(payload)
      .eq('id', input.id)
      .is('deleted_at', null)
      .select(BRIEF_SELECT)
      .single()
    if (error) throw new Error(error.message)
    return mapRow(data as unknown as BriefRow)
  }

  const { data, error } = await client
    .from('design_briefs')
    .insert(payload)
    .select(BRIEF_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapRow(data as unknown as BriefRow)
}

export async function deleteDesignBrief(id: string): Promise<void> {
  const client = requireClient()
  const { error } = await client
    .from('design_briefs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

/** Asegura carpeta del talento (+ subcarpeta del brief) y enlaza el brief. */
export async function ensureBriefDriveFolder(
  brief: DesignBrief,
  displayName: string,
): Promise<{ brief: DesignBrief; folder: CreativeDriveItem }> {
  const all = await listAllDriveItems()
  const login = brief.talentLogin ?? 'talento'
  let root = findTalentRootFolder(all, login, displayName)
  if (!root) {
    root = await createDriveFolder(login, null, '/')
  }
  const stamp = brief.streamStartsAt
    ? new Date(brief.streamStartsAt).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10)
  const safeTitle = (brief.streamTitle ?? brief.title)
    .replace(/[^\w\-áéíóúüñÁÉÍÓÚÜÑ ]+/gi, '')
    .trim()
    .slice(0, 40) || 'brief'
  const folderName = `${stamp} ${safeTitle}`
  const existing = all.find(
    (i) => i.kind === 'folder' && i.parentId === root!.id && i.name.toLowerCase() === folderName.toLowerCase(),
  )
  const folder = existing ?? await createDriveFolder(folderName, root.id, root.path)
  const saved = await saveDesignBrief({
    ...brief,
    id: brief.id,
    driveFolderId: folder.id,
    status: brief.status === 'draft' ? 'ready' : brief.status,
  })
  return { brief: saved, folder }
}
