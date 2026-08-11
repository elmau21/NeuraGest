import { supabase } from '@/services/supabase'
import { DEFAULT_ORG_ID } from '@/services/org'
import { isTauri } from '@/services/twitch'

export function requireLeagueClient() {
  if (!isTauri) throw new Error('NeuraLeague requiere la app de escritorio.')
  if (!supabase) throw new Error('No hay conexión con el almacenamiento en la nube.')
  return supabase
}

export const NL_ORG = DEFAULT_ORG_ID

export async function softDelete(table: string, id: string): Promise<void> {
  const client = requireLeagueClient()
  const { error } = await client
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', NL_ORG)
  if (error) throw new Error(error.message)
}

export async function restoreSoftDeleted(table: string, id: string): Promise<void> {
  const client = requireLeagueClient()
  const { error } = await client
    .from(table)
    .update({ deleted_at: null })
    .eq('id', id)
    .eq('organization_id', NL_ORG)
  if (error) throw new Error(error.message)
}

export type NlSeasonStatus = 'draft' | 'open' | 'active' | 'closed' | 'archived'

export type NlSeason = {
  id: string
  name: string
  slug: string
  status: NlSeasonStatus
  startsAt?: string
  endsAt?: string
  rulesMd: string
  notes: string
  publicTournamentId?: string
  createdAt: string
  updatedAt: string
}

export type NlGame = {
  id: string
  name: string
  slug: string
  agentLabel: string
  mapLabel: string
  iconUrl?: string
}

export type NlTeam = {
  id: string
  name: string
  tag: string
  gameId: string
  seasonId?: string
  divisionId?: string
  logoUrl?: string
  region?: string
  status: 'active' | 'inactive' | 'disbanded'
  socials: Record<string, string>
  notes: string
}

export type NlPlayer = {
  id: string
  nickname: string
  realName?: string
  country?: string
  region?: string
  bio: string
  avatarUrl?: string
  socials: Record<string, string>
  primaryRole?: string
  talentId?: string
  appUserId?: string
  status: 'active' | 'inactive' | 'alumni' | 'banned'
  joinedAt?: string
  notes: string
}

export type NlRosterEntry = {
  id: string
  teamId: string
  playerId: string
  seasonId?: string
  slot: 'starter' | 'sub' | 'trial' | 'inactive'
  inGameRole?: string
  isCaptain: boolean
  notes: string
}

export type NlStaffAssignment = {
  id: string
  teamId: string
  playerId?: string
  appUserId?: string
  seasonId?: string
  staffRole: 'coach' | 'assistant' | 'manager' | 'analyst' | 'other'
  displayName?: string
  notes: string
}

export type NlEvent = {
  id: string
  seasonId?: string
  teamId?: string
  gameId?: string
  eventType: 'scrim' | 'match' | 'training' | 'review' | 'tryout' | 'other'
  title: string
  opponent?: string
  startsAt: string
  endsAt?: string
  status: 'scheduled' | 'live' | 'done' | 'cancelled' | 'no_show'
  location?: string
  streamUrl?: string
  notes: string
}

export type NlPlayerStat = {
  id: string
  eventId?: string
  playerId: string
  teamId?: string
  mapName?: string
  agentOrChamp?: string
  kills: number
  deaths: number
  assists: number
  rating?: number
  adr?: number
  acs?: number
  notes: string
}

export type NlVod = {
  id: string
  seasonId?: string
  teamId?: string
  eventId?: string
  title: string
  url: string
  kind: 'vod' | 'demo' | 'clip' | 'other'
  mapName?: string
  recordedAt?: string
  notes: string
}

export type NlVodNote = {
  id: string
  vodId: string
  timestampSec: number
  body: string
  authorId?: string
  createdAt: string
}

export type NlMatchReport = {
  id: string
  eventId: string
  teamId?: string
  scoreUs?: string
  scoreThem?: string
  summary: string
  whatWentWell: string
  whatToImprove: string
  individualNotes: string
  nextFocus: string
}

export type NlObjective = {
  id: string
  seasonId?: string
  teamId?: string
  playerId?: string
  weekStart: string
  scope: 'team' | 'player'
  title: string
  description: string
  status: 'open' | 'done' | 'missed' | 'cancelled'
  metricBefore?: string
  metricAfter?: string
}

export type NlTraining = {
  id: string
  teamId?: string
  seasonId?: string
  eventId?: string
  title: string
  startsAt: string
  endsAt?: string
  status: 'scheduled' | 'done' | 'cancelled'
  notes: string
}

export type NlPracticeBlock = {
  id: string
  trainingId: string
  blockType: 'aim' | 'strats' | 'review' | 'scrim' | 'vod' | 'other'
  title: string
  durationMin?: number
  sortOrder: number
  notes: string
}

export type NlAttendance = {
  id: string
  trainingId: string
  playerId: string
  status: 'present' | 'late' | 'absent' | 'excused'
  arrivedAt?: string
  notes: string
}

export type NlAvailability = {
  id: string
  playerId: string
  weekStart: string
  slots: Record<string, unknown>
  notes: string
}

export type NlIncident = {
  id: string
  playerId?: string
  teamId?: string
  seasonId?: string
  kind: 'no_show' | 'toxicity' | 'lateness' | 'warning' | 'sanction' | 'other'
  severity: 'low' | 'medium' | 'high'
  title: string
  body: string
  occurredAt: string
  resolvedAt?: string
}

export type NlContract = {
  id: string
  playerId: string
  documentId?: string
  title: string
  externalUrl?: string
  status: 'draft' | 'active' | 'expired' | 'terminated'
  startsOn?: string
  endsOn?: string
  notes: string
}

export type NlTryout = {
  id: string
  seasonId?: string
  teamId?: string
  gameId?: string
  title: string
  status: 'open' | 'closed' | 'cancelled'
  opensAt?: string
  closesAt?: string
  description: string
  contactChannel?: string
}

export type NlCandidate = {
  id: string
  tryoutId?: string
  teamId?: string
  gameId?: string
  nickname: string
  realName?: string
  contact?: string
  contactChannel?: string
  roleInterest?: string
  pipelineStage: 'applied' | 'screening' | 'trial' | 'decision' | 'accepted' | 'rejected' | 'waitlist'
  socials: Record<string, string>
  notes: string
  scouting: boolean
  playerId?: string
}

export type NlTrialEval = {
  id: string
  candidateId: string
  eventId?: string
  score?: number
  mechanics?: number
  gamesense?: number
  communication?: number
  attitude?: number
  recommendation?: 'accept' | 'reject' | 'waitlist' | 'retrial'
  body: string
}

export type NlTask = {
  id: string
  teamId?: string
  seasonId?: string
  eventId?: string
  title: string
  description: string
  assigneeUserId?: string
  status: 'todo' | 'doing' | 'done' | 'cancelled'
  dueAt?: string
  kind: 'general' | 'scrim' | 'vod' | 'announce' | 'checklist' | 'other'
}

export type NlAnnouncement = {
  id: string
  teamId?: string
  seasonId?: string
  title: string
  body: string
  pinned: boolean
  publishedAt: string
}

export type NlChecklist = {
  id: string
  eventId?: string
  teamId?: string
  phase: 'pre' | 'post'
  title: string
}

export type NlChecklistItem = {
  id: string
  checklistId: string
  label: string
  done: boolean
  sortOrder: number
  assigneeUserId?: string
}

export type NlDivision = {
  id: string
  seasonId: string
  gameId: string
  name: string
  tier?: string
  maxTeams?: number
  notes: string
}

export const PRE_MATCH_DEFAULTS = [
  'Lineup confirmado',
  'Cuentas / ranks listos',
  'Overlays / escena OK',
  'Hora y lobby confirmados',
  'Coms / Discord listo',
]

export const POST_MATCH_DEFAULTS = [
  'VOD / demo subido',
  'Stats cargadas',
  'Informe post-partida',
  'Anuncio de resultado',
  'Objetivos de la semana actualizados',
]

export function exportLeagueBoardPack(input: {
  season?: NlSeason | null
  teams: NlTeam[]
  players: NlPlayer[]
  events: NlEvent[]
  candidates: NlCandidate[]
}): string {
  const lines = [
    '# NeuraLeague — Board pack',
    '',
    `Temporada: ${input.season?.name ?? '—'} (${input.season?.status ?? '—'})`,
    `Equipos: ${input.teams.length}`,
    `Jugadores: ${input.players.length}`,
    `Eventos: ${input.events.length}`,
    `Candidatos: ${input.candidates.length}`,
    '',
    '## Equipos',
    ...input.teams.map((t) => `- [${t.tag}] ${t.name}${t.region ? ` · ${t.region}` : ''}`),
    '',
    '## Próximos eventos',
    ...input.events
      .slice()
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
      .slice(0, 20)
      .map((e) => `- ${new Date(e.startsAt).toLocaleString('es-MX')} · ${e.eventType} · ${e.title}`),
    '',
    '## Pipeline reclutamiento',
    ...input.candidates.map((c) => `- ${c.nickname} · ${c.pipelineStage}${c.scouting ? ' · scouting' : ''}`),
  ]
  return lines.join('\n')
}
