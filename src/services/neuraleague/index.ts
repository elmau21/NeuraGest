import { NL_ORG, requireLeagueClient, softDelete } from './types'
import type {
  NlAnnouncement,
  NlAttendance,
  NlAvailability,
  NlCandidate,
  NlChecklist,
  NlChecklistItem,
  NlContract,
  NlDivision,
  NlEvent,
  NlGame,
  NlIncident,
  NlMatchReport,
  NlObjective,
  NlPlayer,
  NlPlayerStat,
  NlPracticeBlock,
  NlRosterEntry,
  NlSeason,
  NlStaffAssignment,
  NlTask,
  NlTeam,
  NlTraining,
  NlTrialEval,
  NlTryout,
  NlVod,
  NlVodNote,
} from './types'
import { POST_MATCH_DEFAULTS, PRE_MATCH_DEFAULTS } from './types'

export * from './types'

function asRecord(v: unknown): Record<string, string> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  const out: Record<string, string> = {}
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === 'string') out[k] = val
  }
  return out
}

function mapSeason(row: Record<string, unknown>): NlSeason {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    status: row.status as NlSeason['status'],
    startsAt: (row.starts_at as string) ?? undefined,
    endsAt: (row.ends_at as string) ?? undefined,
    rulesMd: String(row.rules_md ?? ''),
    notes: String(row.notes ?? ''),
    publicTournamentId: (row.public_tournament_id as string) ?? undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapGame(row: Record<string, unknown>): NlGame {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    agentLabel: String(row.agent_label ?? 'agente'),
    mapLabel: String(row.map_label ?? 'mapa'),
    iconUrl: (row.icon_url as string) ?? undefined,
  }
}

function mapTeam(row: Record<string, unknown>): NlTeam {
  return {
    id: String(row.id),
    name: String(row.name),
    tag: String(row.tag),
    gameId: String(row.game_id),
    seasonId: (row.season_id as string) ?? undefined,
    divisionId: (row.division_id as string) ?? undefined,
    logoUrl: (row.logo_url as string) ?? undefined,
    region: (row.region as string) ?? undefined,
    status: (row.status as NlTeam['status']) ?? 'active',
    socials: asRecord(row.socials),
    notes: String(row.notes ?? ''),
  }
}

function mapPlayer(row: Record<string, unknown>): NlPlayer {
  return {
    id: String(row.id),
    nickname: String(row.nickname),
    realName: (row.real_name as string) ?? undefined,
    country: (row.country as string) ?? undefined,
    region: (row.region as string) ?? undefined,
    bio: String(row.bio ?? ''),
    avatarUrl: (row.avatar_url as string) ?? undefined,
    socials: asRecord(row.socials),
    primaryRole: (row.primary_role as string) ?? undefined,
    talentId: (row.talent_id as string) ?? undefined,
    appUserId: (row.app_user_id as string) ?? undefined,
    status: (row.status as NlPlayer['status']) ?? 'active',
    joinedAt: (row.joined_at as string) ?? undefined,
    notes: String(row.notes ?? ''),
  }
}

function mapEvent(row: Record<string, unknown>): NlEvent {
  return {
    id: String(row.id),
    seasonId: (row.season_id as string) ?? undefined,
    teamId: (row.team_id as string) ?? undefined,
    gameId: (row.game_id as string) ?? undefined,
    eventType: (row.event_type as NlEvent['eventType']) ?? 'scrim',
    title: String(row.title),
    opponent: (row.opponent as string) ?? undefined,
    startsAt: String(row.starts_at),
    endsAt: (row.ends_at as string) ?? undefined,
    status: (row.status as NlEvent['status']) ?? 'scheduled',
    location: (row.location as string) ?? undefined,
    streamUrl: (row.stream_url as string) ?? undefined,
    notes: String(row.notes ?? ''),
  }
}

async function listRows(table: string, order = 'created_at'): Promise<Record<string, unknown>[]> {
  const client = requireLeagueClient()
  const { data, error } = await client
    .from(table)
    .select('*')
    .eq('organization_id', NL_ORG)
    .is('deleted_at', null)
    .order(order, { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Record<string, unknown>[]
}

export async function listSeasons(): Promise<NlSeason[]> {
  return (await listRows('nl_seasons', 'starts_at')).map(mapSeason)
}

export async function saveSeason(input: Partial<NlSeason> & { name: string; slug: string }): Promise<NlSeason> {
  const client = requireLeagueClient()
  const payload = {
    organization_id: NL_ORG,
    name: input.name,
    slug: input.slug,
    status: input.status ?? 'draft',
    starts_at: input.startsAt ?? null,
    ends_at: input.endsAt ?? null,
    rules_md: input.rulesMd ?? '',
    notes: input.notes ?? '',
    public_tournament_id: input.publicTournamentId ?? null,
    deleted_at: null,
  }
  const q = input.id
    ? client.from('nl_seasons').update(payload).eq('id', input.id).eq('organization_id', NL_ORG)
    : client.from('nl_seasons').insert(payload)
  const { data, error } = await q.select('*').single()
  if (error) throw new Error(error.message)
  return mapSeason(data as Record<string, unknown>)
}

export async function deleteSeason(id: string) {
  return softDelete('nl_seasons', id)
}

export async function listGames(): Promise<NlGame[]> {
  return (await listRows('nl_games', 'name')).map(mapGame)
}

export async function saveGame(input: Partial<NlGame> & { name: string; slug: string }): Promise<NlGame> {
  const client = requireLeagueClient()
  const payload = {
    organization_id: NL_ORG,
    name: input.name,
    slug: input.slug,
    agent_label: input.agentLabel ?? 'agente',
    map_label: input.mapLabel ?? 'mapa',
    icon_url: input.iconUrl ?? null,
    deleted_at: null,
  }
  const q = input.id
    ? client.from('nl_games').update(payload).eq('id', input.id).eq('organization_id', NL_ORG)
    : client.from('nl_games').insert(payload)
  const { data, error } = await q.select('*').single()
  if (error) throw new Error(error.message)
  return mapGame(data as Record<string, unknown>)
}

export async function listDivisions(seasonId?: string): Promise<NlDivision[]> {
  const client = requireLeagueClient()
  let q = client
    .from('nl_divisions')
    .select('*')
    .eq('organization_id', NL_ORG)
    .is('deleted_at', null)
  if (seasonId) q = q.eq('season_id', seasonId)
  const { data, error } = await q.order('name')
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: String(row.id),
    seasonId: String(row.season_id),
    gameId: String(row.game_id),
    name: String(row.name),
    tier: row.tier ?? undefined,
    maxTeams: row.max_teams ?? undefined,
    notes: String(row.notes ?? ''),
  }))
}

export async function saveDivision(
  input: Partial<NlDivision> & { seasonId: string; gameId: string; name: string },
): Promise<NlDivision> {
  const client = requireLeagueClient()
  const payload = {
    organization_id: NL_ORG,
    season_id: input.seasonId,
    game_id: input.gameId,
    name: input.name,
    tier: input.tier ?? null,
    max_teams: input.maxTeams ?? null,
    notes: input.notes ?? '',
    deleted_at: null,
  }
  const q = input.id
    ? client.from('nl_divisions').update(payload).eq('id', input.id)
    : client.from('nl_divisions').insert(payload)
  const { data, error } = await q.select('*').single()
  if (error) throw new Error(error.message)
  return {
    id: String(data.id),
    seasonId: String(data.season_id),
    gameId: String(data.game_id),
    name: String(data.name),
    tier: data.tier ?? undefined,
    maxTeams: data.max_teams ?? undefined,
    notes: String(data.notes ?? ''),
  }
}

export async function listTeams(): Promise<NlTeam[]> {
  return (await listRows('nl_teams', 'name')).map(mapTeam)
}

export async function saveTeam(
  input: Partial<NlTeam> & { name: string; tag: string; gameId: string },
): Promise<NlTeam> {
  const client = requireLeagueClient()
  const payload = {
    organization_id: NL_ORG,
    name: input.name,
    tag: input.tag,
    game_id: input.gameId,
    season_id: input.seasonId ?? null,
    division_id: input.divisionId ?? null,
    logo_url: input.logoUrl ?? null,
    region: input.region ?? null,
    status: input.status ?? 'active',
    socials: input.socials ?? {},
    notes: input.notes ?? '',
    deleted_at: null,
  }
  const q = input.id
    ? client.from('nl_teams').update(payload).eq('id', input.id)
    : client.from('nl_teams').insert(payload)
  const { data, error } = await q.select('*').single()
  if (error) throw new Error(error.message)
  return mapTeam(data as Record<string, unknown>)
}

export async function deleteTeam(id: string) {
  return softDelete('nl_teams', id)
}

export async function listPlayers(): Promise<NlPlayer[]> {
  return (await listRows('nl_players', 'nickname')).map(mapPlayer)
}

export async function savePlayer(input: Partial<NlPlayer> & { nickname: string }): Promise<NlPlayer> {
  const client = requireLeagueClient()
  const payload = {
    organization_id: NL_ORG,
    nickname: input.nickname,
    real_name: input.realName ?? null,
    country: input.country ?? null,
    region: input.region ?? null,
    bio: input.bio ?? '',
    avatar_url: input.avatarUrl ?? null,
    socials: input.socials ?? {},
    primary_role: input.primaryRole ?? null,
    talent_id: input.talentId ?? null,
    app_user_id: input.appUserId ?? null,
    status: input.status ?? 'active',
    joined_at: input.joinedAt ?? null,
    notes: input.notes ?? '',
    deleted_at: null,
  }
  const q = input.id
    ? client.from('nl_players').update(payload).eq('id', input.id)
    : client.from('nl_players').insert(payload)
  const { data, error } = await q.select('*').single()
  if (error) throw new Error(error.message)
  return mapPlayer(data as Record<string, unknown>)
}

export async function deletePlayer(id: string) {
  return softDelete('nl_players', id)
}

export async function listRoster(teamId?: string): Promise<NlRosterEntry[]> {
  const client = requireLeagueClient()
  let q = client.from('nl_roster_entries').select('*').eq('organization_id', NL_ORG).is('deleted_at', null)
  if (teamId) q = q.eq('team_id', teamId)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: String(row.id),
    teamId: String(row.team_id),
    playerId: String(row.player_id),
    seasonId: row.season_id ?? undefined,
    slot: row.slot,
    inGameRole: row.in_game_role ?? undefined,
    isCaptain: Boolean(row.is_captain),
    notes: String(row.notes ?? ''),
  }))
}

export async function saveRosterEntry(
  input: Partial<NlRosterEntry> & { teamId: string; playerId: string },
): Promise<NlRosterEntry> {
  const client = requireLeagueClient()
  const payload = {
    organization_id: NL_ORG,
    team_id: input.teamId,
    player_id: input.playerId,
    season_id: input.seasonId ?? null,
    slot: input.slot ?? 'starter',
    in_game_role: input.inGameRole ?? null,
    is_captain: input.isCaptain ?? false,
    notes: input.notes ?? '',
    deleted_at: null,
  }
  const q = input.id
    ? client.from('nl_roster_entries').update(payload).eq('id', input.id)
    : client.from('nl_roster_entries').insert(payload)
  const { data, error } = await q.select('*').single()
  if (error) throw new Error(error.message)
  return {
    id: String(data.id),
    teamId: String(data.team_id),
    playerId: String(data.player_id),
    seasonId: data.season_id ?? undefined,
    slot: data.slot,
    inGameRole: data.in_game_role ?? undefined,
    isCaptain: Boolean(data.is_captain),
    notes: String(data.notes ?? ''),
  }
}

export async function deleteRosterEntry(id: string) {
  return softDelete('nl_roster_entries', id)
}

export async function listStaff(teamId?: string): Promise<NlStaffAssignment[]> {
  const client = requireLeagueClient()
  let q = client.from('nl_staff_assignments').select('*').eq('organization_id', NL_ORG).is('deleted_at', null)
  if (teamId) q = q.eq('team_id', teamId)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: String(row.id),
    teamId: String(row.team_id),
    playerId: row.player_id ?? undefined,
    appUserId: row.app_user_id ?? undefined,
    seasonId: row.season_id ?? undefined,
    staffRole: row.staff_role,
    displayName: row.display_name ?? undefined,
    notes: String(row.notes ?? ''),
  }))
}

export async function saveStaff(
  input: Partial<NlStaffAssignment> & { teamId: string; staffRole: NlStaffAssignment['staffRole'] },
): Promise<NlStaffAssignment> {
  const client = requireLeagueClient()
  const payload = {
    organization_id: NL_ORG,
    team_id: input.teamId,
    player_id: input.playerId ?? null,
    app_user_id: input.appUserId ?? null,
    season_id: input.seasonId ?? null,
    staff_role: input.staffRole,
    display_name: input.displayName ?? null,
    notes: input.notes ?? '',
    deleted_at: null,
  }
  const q = input.id
    ? client.from('nl_staff_assignments').update(payload).eq('id', input.id)
    : client.from('nl_staff_assignments').insert(payload)
  const { data, error } = await q.select('*').single()
  if (error) throw new Error(error.message)
  return {
    id: String(data.id),
    teamId: String(data.team_id),
    playerId: data.player_id ?? undefined,
    appUserId: data.app_user_id ?? undefined,
    seasonId: data.season_id ?? undefined,
    staffRole: data.staff_role,
    displayName: data.display_name ?? undefined,
    notes: String(data.notes ?? ''),
  }
}

export async function listEvents(): Promise<NlEvent[]> {
  return (await listRows('nl_events', 'starts_at')).map(mapEvent)
}

export async function saveEvent(
  input: Partial<NlEvent> & { title: string; startsAt: string },
): Promise<NlEvent> {
  const client = requireLeagueClient()
  const payload = {
    organization_id: NL_ORG,
    season_id: input.seasonId ?? null,
    team_id: input.teamId ?? null,
    game_id: input.gameId ?? null,
    event_type: input.eventType ?? 'scrim',
    title: input.title,
    opponent: input.opponent ?? null,
    starts_at: input.startsAt,
    ends_at: input.endsAt ?? null,
    status: input.status ?? 'scheduled',
    location: input.location ?? null,
    stream_url: input.streamUrl ?? null,
    notes: input.notes ?? '',
    deleted_at: null,
  }
  const q = input.id
    ? client.from('nl_events').update(payload).eq('id', input.id)
    : client.from('nl_events').insert(payload)
  const { data, error } = await q.select('*').single()
  if (error) throw new Error(error.message)
  return mapEvent(data as Record<string, unknown>)
}

export async function deleteEvent(id: string) {
  return softDelete('nl_events', id)
}

export async function setEventPlayers(eventId: string, playerIds: string[]): Promise<void> {
  const client = requireLeagueClient()
  const { error: delErr } = await client
    .from('nl_event_players')
    .update({ deleted_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('organization_id', NL_ORG)
    .is('deleted_at', null)
  if (delErr) throw new Error(delErr.message)
  if (playerIds.length === 0) return
  const { error } = await client.from('nl_event_players').insert(
    playerIds.map((player_id) => ({
      organization_id: NL_ORG,
      event_id: eventId,
      player_id,
    })),
  )
  if (error) throw new Error(error.message)
}

export async function listEventPlayerIds(eventId: string): Promise<string[]> {
  const client = requireLeagueClient()
  const { data, error } = await client
    .from('nl_event_players')
    .select('player_id')
    .eq('event_id', eventId)
    .eq('organization_id', NL_ORG)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => String(r.player_id))
}

export async function listPlayerStats(playerId?: string): Promise<NlPlayerStat[]> {
  const client = requireLeagueClient()
  let q = client.from('nl_player_stats').select('*').eq('organization_id', NL_ORG).is('deleted_at', null)
  if (playerId) q = q.eq('player_id', playerId)
  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: String(row.id),
    eventId: row.event_id ?? undefined,
    playerId: String(row.player_id),
    teamId: row.team_id ?? undefined,
    mapName: row.map_name ?? undefined,
    agentOrChamp: row.agent_or_champ ?? undefined,
    kills: Number(row.kills ?? 0),
    deaths: Number(row.deaths ?? 0),
    assists: Number(row.assists ?? 0),
    rating: row.rating != null ? Number(row.rating) : undefined,
    adr: row.adr != null ? Number(row.adr) : undefined,
    acs: row.acs != null ? Number(row.acs) : undefined,
    notes: String(row.notes ?? ''),
  }))
}

export async function savePlayerStat(
  input: Partial<NlPlayerStat> & { playerId: string },
): Promise<NlPlayerStat> {
  const client = requireLeagueClient()
  const payload = {
    organization_id: NL_ORG,
    event_id: input.eventId ?? null,
    player_id: input.playerId,
    team_id: input.teamId ?? null,
    map_name: input.mapName ?? null,
    agent_or_champ: input.agentOrChamp ?? null,
    kills: input.kills ?? 0,
    deaths: input.deaths ?? 0,
    assists: input.assists ?? 0,
    rating: input.rating ?? null,
    adr: input.adr ?? null,
    acs: input.acs ?? null,
    notes: input.notes ?? '',
    deleted_at: null,
  }
  const q = input.id
    ? client.from('nl_player_stats').update(payload).eq('id', input.id)
    : client.from('nl_player_stats').insert(payload)
  const { data, error } = await q.select('*').single()
  if (error) throw new Error(error.message)
  return {
    id: String(data.id),
    eventId: data.event_id ?? undefined,
    playerId: String(data.player_id),
    teamId: data.team_id ?? undefined,
    mapName: data.map_name ?? undefined,
    agentOrChamp: data.agent_or_champ ?? undefined,
    kills: Number(data.kills ?? 0),
    deaths: Number(data.deaths ?? 0),
    assists: Number(data.assists ?? 0),
    rating: data.rating != null ? Number(data.rating) : undefined,
    adr: data.adr != null ? Number(data.adr) : undefined,
    acs: data.acs != null ? Number(data.acs) : undefined,
    notes: String(data.notes ?? ''),
  }
}

export async function listVods(): Promise<NlVod[]> {
  const rows = await listRows('nl_vods', 'created_at')
  return rows.map((row) => ({
    id: String(row.id),
    seasonId: (row.season_id as string) ?? undefined,
    teamId: (row.team_id as string) ?? undefined,
    eventId: (row.event_id as string) ?? undefined,
    title: String(row.title),
    url: String(row.url),
    kind: (row.kind as NlVod['kind']) ?? 'vod',
    mapName: (row.map_name as string) ?? undefined,
    recordedAt: (row.recorded_at as string) ?? undefined,
    notes: String(row.notes ?? ''),
  }))
}

export async function saveVod(input: Partial<NlVod> & { title: string; url: string }): Promise<NlVod> {
  const client = requireLeagueClient()
  const payload = {
    organization_id: NL_ORG,
    season_id: input.seasonId ?? null,
    team_id: input.teamId ?? null,
    event_id: input.eventId ?? null,
    title: input.title,
    url: input.url,
    kind: input.kind ?? 'vod',
    map_name: input.mapName ?? null,
    recorded_at: input.recordedAt ?? null,
    notes: input.notes ?? '',
    deleted_at: null,
  }
  const q = input.id
    ? client.from('nl_vods').update(payload).eq('id', input.id)
    : client.from('nl_vods').insert(payload)
  const { data, error } = await q.select('*').single()
  if (error) throw new Error(error.message)
  return {
    id: String(data.id),
    seasonId: data.season_id ?? undefined,
    teamId: data.team_id ?? undefined,
    eventId: data.event_id ?? undefined,
    title: String(data.title),
    url: String(data.url),
    kind: data.kind,
    mapName: data.map_name ?? undefined,
    recordedAt: data.recorded_at ?? undefined,
    notes: String(data.notes ?? ''),
  }
}

export async function deleteVod(id: string) {
  return softDelete('nl_vods', id)
}

export async function listVodNotes(vodId: string): Promise<NlVodNote[]> {
  const client = requireLeagueClient()
  const { data, error } = await client
    .from('nl_vod_notes')
    .select('*')
    .eq('vod_id', vodId)
    .eq('organization_id', NL_ORG)
    .is('deleted_at', null)
    .order('timestamp_sec')
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: String(row.id),
    vodId: String(row.vod_id),
    timestampSec: Number(row.timestamp_sec ?? 0),
    body: String(row.body),
    authorId: row.author_id ?? undefined,
    createdAt: String(row.created_at),
  }))
}

export async function saveVodNote(
  input: Partial<NlVodNote> & { vodId: string; body: string },
): Promise<NlVodNote> {
  const client = requireLeagueClient()
  const payload = {
    organization_id: NL_ORG,
    vod_id: input.vodId,
    timestamp_sec: input.timestampSec ?? 0,
    body: input.body,
    deleted_at: null,
  }
  const q = input.id
    ? client.from('nl_vod_notes').update(payload).eq('id', input.id)
    : client.from('nl_vod_notes').insert(payload)
  const { data, error } = await q.select('*').single()
  if (error) throw new Error(error.message)
  return {
    id: String(data.id),
    vodId: String(data.vod_id),
    timestampSec: Number(data.timestamp_sec ?? 0),
    body: String(data.body),
    authorId: data.author_id ?? undefined,
    createdAt: String(data.created_at),
  }
}

export async function getMatchReport(eventId: string): Promise<NlMatchReport | null> {
  const client = requireLeagueClient()
  const { data, error } = await client
    .from('nl_match_reports')
    .select('*')
    .eq('event_id', eventId)
    .eq('organization_id', NL_ORG)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return {
    id: String(data.id),
    eventId: String(data.event_id),
    teamId: data.team_id ?? undefined,
    scoreUs: data.score_us ?? undefined,
    scoreThem: data.score_them ?? undefined,
    summary: String(data.summary ?? ''),
    whatWentWell: String(data.what_went_well ?? ''),
    whatToImprove: String(data.what_to_improve ?? ''),
    individualNotes: String(data.individual_notes ?? ''),
    nextFocus: String(data.next_focus ?? ''),
  }
}

export async function saveMatchReport(
  input: Partial<NlMatchReport> & { eventId: string },
): Promise<NlMatchReport> {
  const client = requireLeagueClient()
  const payload = {
    organization_id: NL_ORG,
    event_id: input.eventId,
    team_id: input.teamId ?? null,
    score_us: input.scoreUs ?? null,
    score_them: input.scoreThem ?? null,
    summary: input.summary ?? '',
    what_went_well: input.whatWentWell ?? '',
    what_to_improve: input.whatToImprove ?? '',
    individual_notes: input.individualNotes ?? '',
    next_focus: input.nextFocus ?? '',
    deleted_at: null,
  }
  const existing = await getMatchReport(input.eventId)
  const q = existing
    ? client.from('nl_match_reports').update(payload).eq('id', existing.id)
    : client.from('nl_match_reports').insert(payload)
  const { data, error } = await q.select('*').single()
  if (error) throw new Error(error.message)
  return {
    id: String(data.id),
    eventId: String(data.event_id),
    teamId: data.team_id ?? undefined,
    scoreUs: data.score_us ?? undefined,
    scoreThem: data.score_them ?? undefined,
    summary: String(data.summary ?? ''),
    whatWentWell: String(data.what_went_well ?? ''),
    whatToImprove: String(data.what_to_improve ?? ''),
    individualNotes: String(data.individual_notes ?? ''),
    nextFocus: String(data.next_focus ?? ''),
  }
}

export async function listObjectives(): Promise<NlObjective[]> {
  const rows = await listRows('nl_objectives', 'week_start')
  return rows.map((row) => ({
    id: String(row.id),
    seasonId: (row.season_id as string) ?? undefined,
    teamId: (row.team_id as string) ?? undefined,
    playerId: (row.player_id as string) ?? undefined,
    weekStart: String(row.week_start),
    scope: (row.scope as NlObjective['scope']) ?? 'team',
    title: String(row.title),
    description: String(row.description ?? ''),
    status: (row.status as NlObjective['status']) ?? 'open',
    metricBefore: (row.metric_before as string) ?? undefined,
    metricAfter: (row.metric_after as string) ?? undefined,
  }))
}

export async function saveObjective(
  input: Partial<NlObjective> & { title: string; weekStart: string },
): Promise<NlObjective> {
  const client = requireLeagueClient()
  const payload = {
    organization_id: NL_ORG,
    season_id: input.seasonId ?? null,
    team_id: input.teamId ?? null,
    player_id: input.playerId ?? null,
    week_start: input.weekStart,
    scope: input.scope ?? 'team',
    title: input.title,
    description: input.description ?? '',
    status: input.status ?? 'open',
    metric_before: input.metricBefore ?? null,
    metric_after: input.metricAfter ?? null,
    deleted_at: null,
  }
  const q = input.id
    ? client.from('nl_objectives').update(payload).eq('id', input.id)
    : client.from('nl_objectives').insert(payload)
  const { data, error } = await q.select('*').single()
  if (error) throw new Error(error.message)
  return {
    id: String(data.id),
    seasonId: data.season_id ?? undefined,
    teamId: data.team_id ?? undefined,
    playerId: data.player_id ?? undefined,
    weekStart: String(data.week_start),
    scope: data.scope,
    title: String(data.title),
    description: String(data.description ?? ''),
    status: data.status,
    metricBefore: data.metric_before ?? undefined,
    metricAfter: data.metric_after ?? undefined,
  }
}

export async function listTrainings(): Promise<NlTraining[]> {
  const rows = await listRows('nl_training_sessions', 'starts_at')
  return rows.map((row) => ({
    id: String(row.id),
    teamId: (row.team_id as string) ?? undefined,
    seasonId: (row.season_id as string) ?? undefined,
    eventId: (row.event_id as string) ?? undefined,
    title: String(row.title),
    startsAt: String(row.starts_at),
    endsAt: (row.ends_at as string) ?? undefined,
    status: (row.status as NlTraining['status']) ?? 'scheduled',
    notes: String(row.notes ?? ''),
  }))
}

export async function saveTraining(
  input: Partial<NlTraining> & { title: string; startsAt: string },
): Promise<NlTraining> {
  const client = requireLeagueClient()
  const payload = {
    organization_id: NL_ORG,
    team_id: input.teamId ?? null,
    season_id: input.seasonId ?? null,
    event_id: input.eventId ?? null,
    title: input.title,
    starts_at: input.startsAt,
    ends_at: input.endsAt ?? null,
    status: input.status ?? 'scheduled',
    notes: input.notes ?? '',
    deleted_at: null,
  }
  const q = input.id
    ? client.from('nl_training_sessions').update(payload).eq('id', input.id)
    : client.from('nl_training_sessions').insert(payload)
  const { data, error } = await q.select('*').single()
  if (error) throw new Error(error.message)
  return {
    id: String(data.id),
    teamId: data.team_id ?? undefined,
    seasonId: data.season_id ?? undefined,
    eventId: data.event_id ?? undefined,
    title: String(data.title),
    startsAt: String(data.starts_at),
    endsAt: data.ends_at ?? undefined,
    status: data.status,
    notes: String(data.notes ?? ''),
  }
}

export async function listPracticeBlocks(trainingId: string): Promise<NlPracticeBlock[]> {
  const client = requireLeagueClient()
  const { data, error } = await client
    .from('nl_practice_blocks')
    .select('*')
    .eq('training_id', trainingId)
    .eq('organization_id', NL_ORG)
    .is('deleted_at', null)
    .order('sort_order')
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: String(row.id),
    trainingId: String(row.training_id),
    blockType: row.block_type,
    title: String(row.title),
    durationMin: row.duration_min ?? undefined,
    sortOrder: Number(row.sort_order ?? 0),
    notes: String(row.notes ?? ''),
  }))
}

export async function savePracticeBlock(
  input: Partial<NlPracticeBlock> & { trainingId: string; title: string; blockType: NlPracticeBlock['blockType'] },
): Promise<NlPracticeBlock> {
  const client = requireLeagueClient()
  const payload = {
    organization_id: NL_ORG,
    training_id: input.trainingId,
    block_type: input.blockType,
    title: input.title,
    duration_min: input.durationMin ?? null,
    sort_order: input.sortOrder ?? 0,
    notes: input.notes ?? '',
    deleted_at: null,
  }
  const q = input.id
    ? client.from('nl_practice_blocks').update(payload).eq('id', input.id)
    : client.from('nl_practice_blocks').insert(payload)
  const { data, error } = await q.select('*').single()
  if (error) throw new Error(error.message)
  return {
    id: String(data.id),
    trainingId: String(data.training_id),
    blockType: data.block_type,
    title: String(data.title),
    durationMin: data.duration_min ?? undefined,
    sortOrder: Number(data.sort_order ?? 0),
    notes: String(data.notes ?? ''),
  }
}

export async function listAttendance(trainingId: string): Promise<NlAttendance[]> {
  const client = requireLeagueClient()
  const { data, error } = await client
    .from('nl_attendance')
    .select('*')
    .eq('training_id', trainingId)
    .eq('organization_id', NL_ORG)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: String(row.id),
    trainingId: String(row.training_id),
    playerId: String(row.player_id),
    status: row.status,
    arrivedAt: row.arrived_at ?? undefined,
    notes: String(row.notes ?? ''),
  }))
}

export async function saveAttendance(
  input: Partial<NlAttendance> & { trainingId: string; playerId: string; status: NlAttendance['status'] },
): Promise<NlAttendance> {
  const client = requireLeagueClient()
  const payload = {
    organization_id: NL_ORG,
    training_id: input.trainingId,
    player_id: input.playerId,
    status: input.status,
    arrived_at: input.arrivedAt ?? null,
    notes: input.notes ?? '',
    deleted_at: null,
  }
  const q = input.id
    ? client.from('nl_attendance').update(payload).eq('id', input.id)
    : client.from('nl_attendance').upsert(payload, { onConflict: 'training_id,player_id' })
  const { data, error } = await q.select('*').single()
  if (error) throw new Error(error.message)
  return {
    id: String(data.id),
    trainingId: String(data.training_id),
    playerId: String(data.player_id),
    status: data.status,
    arrivedAt: data.arrived_at ?? undefined,
    notes: String(data.notes ?? ''),
  }
}

export async function listAvailability(): Promise<NlAvailability[]> {
  const rows = await listRows('nl_availability', 'week_start')
  return rows.map((row) => ({
    id: String(row.id),
    playerId: String(row.player_id),
    weekStart: String(row.week_start),
    slots: (row.slots as Record<string, unknown>) ?? {},
    notes: String(row.notes ?? ''),
  }))
}

export async function saveAvailability(
  input: Partial<NlAvailability> & { playerId: string; weekStart: string },
): Promise<NlAvailability> {
  const client = requireLeagueClient()
  const payload = {
    organization_id: NL_ORG,
    player_id: input.playerId,
    week_start: input.weekStart,
    slots: input.slots ?? {},
    notes: input.notes ?? '',
    deleted_at: null,
  }
  const q = input.id
    ? client.from('nl_availability').update(payload).eq('id', input.id)
    : client.from('nl_availability').upsert(payload, { onConflict: 'player_id,week_start' })
  const { data, error } = await q.select('*').single()
  if (error) throw new Error(error.message)
  return {
    id: String(data.id),
    playerId: String(data.player_id),
    weekStart: String(data.week_start),
    slots: (data.slots as Record<string, unknown>) ?? {},
    notes: String(data.notes ?? ''),
  }
}

export async function listIncidents(): Promise<NlIncident[]> {
  const rows = await listRows('nl_incidents', 'occurred_at')
  return rows.map((row) => ({
    id: String(row.id),
    playerId: (row.player_id as string) ?? undefined,
    teamId: (row.team_id as string) ?? undefined,
    seasonId: (row.season_id as string) ?? undefined,
    kind: row.kind as NlIncident['kind'],
    severity: row.severity as NlIncident['severity'],
    title: String(row.title),
    body: String(row.body ?? ''),
    occurredAt: String(row.occurred_at),
    resolvedAt: (row.resolved_at as string) ?? undefined,
  }))
}

export async function saveIncident(
  input: Partial<NlIncident> & { title: string; kind: NlIncident['kind'] },
): Promise<NlIncident> {
  const client = requireLeagueClient()
  const payload = {
    organization_id: NL_ORG,
    player_id: input.playerId ?? null,
    team_id: input.teamId ?? null,
    season_id: input.seasonId ?? null,
    kind: input.kind,
    severity: input.severity ?? 'low',
    title: input.title,
    body: input.body ?? '',
    occurred_at: input.occurredAt ?? new Date().toISOString(),
    resolved_at: input.resolvedAt ?? null,
    deleted_at: null,
  }
  const q = input.id
    ? client.from('nl_incidents').update(payload).eq('id', input.id)
    : client.from('nl_incidents').insert(payload)
  const { data, error } = await q.select('*').single()
  if (error) throw new Error(error.message)
  return {
    id: String(data.id),
    playerId: data.player_id ?? undefined,
    teamId: data.team_id ?? undefined,
    seasonId: data.season_id ?? undefined,
    kind: data.kind,
    severity: data.severity,
    title: String(data.title),
    body: String(data.body ?? ''),
    occurredAt: String(data.occurred_at),
    resolvedAt: data.resolved_at ?? undefined,
  }
}

export async function listContracts(): Promise<NlContract[]> {
  const rows = await listRows('nl_player_contracts', 'created_at')
  return rows.map((row) => ({
    id: String(row.id),
    playerId: String(row.player_id),
    documentId: (row.document_id as string) ?? undefined,
    title: String(row.title),
    externalUrl: (row.external_url as string) ?? undefined,
    status: row.status as NlContract['status'],
    startsOn: (row.starts_on as string) ?? undefined,
    endsOn: (row.ends_on as string) ?? undefined,
    notes: String(row.notes ?? ''),
  }))
}

export async function saveContract(
  input: Partial<NlContract> & { playerId: string; title: string },
): Promise<NlContract> {
  const client = requireLeagueClient()
  const payload = {
    organization_id: NL_ORG,
    player_id: input.playerId,
    document_id: input.documentId ?? null,
    title: input.title,
    external_url: input.externalUrl ?? null,
    status: input.status ?? 'draft',
    starts_on: input.startsOn ?? null,
    ends_on: input.endsOn ?? null,
    notes: input.notes ?? '',
    deleted_at: null,
  }
  const q = input.id
    ? client.from('nl_player_contracts').update(payload).eq('id', input.id)
    : client.from('nl_player_contracts').insert(payload)
  const { data, error } = await q.select('*').single()
  if (error) throw new Error(error.message)
  return {
    id: String(data.id),
    playerId: String(data.player_id),
    documentId: data.document_id ?? undefined,
    title: String(data.title),
    externalUrl: data.external_url ?? undefined,
    status: data.status,
    startsOn: data.starts_on ?? undefined,
    endsOn: data.ends_on ?? undefined,
    notes: String(data.notes ?? ''),
  }
}

export async function listTryouts(): Promise<NlTryout[]> {
  const rows = await listRows('nl_tryouts', 'created_at')
  return rows.map((row) => ({
    id: String(row.id),
    seasonId: (row.season_id as string) ?? undefined,
    teamId: (row.team_id as string) ?? undefined,
    gameId: (row.game_id as string) ?? undefined,
    title: String(row.title),
    status: row.status as NlTryout['status'],
    opensAt: (row.opens_at as string) ?? undefined,
    closesAt: (row.closes_at as string) ?? undefined,
    description: String(row.description ?? ''),
    contactChannel: (row.contact_channel as string) ?? undefined,
  }))
}

export async function saveTryout(input: Partial<NlTryout> & { title: string }): Promise<NlTryout> {
  const client = requireLeagueClient()
  const payload = {
    organization_id: NL_ORG,
    season_id: input.seasonId ?? null,
    team_id: input.teamId ?? null,
    game_id: input.gameId ?? null,
    title: input.title,
    status: input.status ?? 'open',
    opens_at: input.opensAt ?? null,
    closes_at: input.closesAt ?? null,
    description: input.description ?? '',
    contact_channel: input.contactChannel ?? null,
    deleted_at: null,
  }
  const q = input.id
    ? client.from('nl_tryouts').update(payload).eq('id', input.id)
    : client.from('nl_tryouts').insert(payload)
  const { data, error } = await q.select('*').single()
  if (error) throw new Error(error.message)
  return {
    id: String(data.id),
    seasonId: data.season_id ?? undefined,
    teamId: data.team_id ?? undefined,
    gameId: data.game_id ?? undefined,
    title: String(data.title),
    status: data.status,
    opensAt: data.opens_at ?? undefined,
    closesAt: data.closes_at ?? undefined,
    description: String(data.description ?? ''),
    contactChannel: data.contact_channel ?? undefined,
  }
}

export async function listCandidates(): Promise<NlCandidate[]> {
  const rows = await listRows('nl_candidates', 'updated_at')
  return rows.map((row) => ({
    id: String(row.id),
    tryoutId: (row.tryout_id as string) ?? undefined,
    teamId: (row.team_id as string) ?? undefined,
    gameId: (row.game_id as string) ?? undefined,
    nickname: String(row.nickname),
    realName: (row.real_name as string) ?? undefined,
    contact: (row.contact as string) ?? undefined,
    contactChannel: (row.contact_channel as string) ?? undefined,
    roleInterest: (row.role_interest as string) ?? undefined,
    pipelineStage: row.pipeline_stage as NlCandidate['pipelineStage'],
    socials: asRecord(row.socials),
    notes: String(row.notes ?? ''),
    scouting: Boolean(row.scouting),
    playerId: (row.player_id as string) ?? undefined,
  }))
}

export async function saveCandidate(
  input: Partial<NlCandidate> & { nickname: string },
): Promise<NlCandidate> {
  const client = requireLeagueClient()
  const payload = {
    organization_id: NL_ORG,
    tryout_id: input.tryoutId ?? null,
    team_id: input.teamId ?? null,
    game_id: input.gameId ?? null,
    nickname: input.nickname,
    real_name: input.realName ?? null,
    contact: input.contact ?? null,
    contact_channel: input.contactChannel ?? null,
    role_interest: input.roleInterest ?? null,
    pipeline_stage: input.pipelineStage ?? 'applied',
    socials: input.socials ?? {},
    notes: input.notes ?? '',
    scouting: input.scouting ?? false,
    player_id: input.playerId ?? null,
    deleted_at: null,
  }
  const q = input.id
    ? client.from('nl_candidates').update(payload).eq('id', input.id)
    : client.from('nl_candidates').insert(payload)
  const { data, error } = await q.select('*').single()
  if (error) throw new Error(error.message)
  return {
    id: String(data.id),
    tryoutId: data.tryout_id ?? undefined,
    teamId: data.team_id ?? undefined,
    gameId: data.game_id ?? undefined,
    nickname: String(data.nickname),
    realName: data.real_name ?? undefined,
    contact: data.contact ?? undefined,
    contactChannel: data.contact_channel ?? undefined,
    roleInterest: data.role_interest ?? undefined,
    pipelineStage: data.pipeline_stage,
    socials: asRecord(data.socials),
    notes: String(data.notes ?? ''),
    scouting: Boolean(data.scouting),
    playerId: data.player_id ?? undefined,
  }
}

export async function listTrialEvals(candidateId: string): Promise<NlTrialEval[]> {
  const client = requireLeagueClient()
  const { data, error } = await client
    .from('nl_trial_evaluations')
    .select('*')
    .eq('candidate_id', candidateId)
    .eq('organization_id', NL_ORG)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: String(row.id),
    candidateId: String(row.candidate_id),
    eventId: row.event_id ?? undefined,
    score: row.score ?? undefined,
    mechanics: row.mechanics ?? undefined,
    gamesense: row.gamesense ?? undefined,
    communication: row.communication ?? undefined,
    attitude: row.attitude ?? undefined,
    recommendation: row.recommendation ?? undefined,
    body: String(row.body ?? ''),
  }))
}

export async function saveTrialEval(
  input: Partial<NlTrialEval> & { candidateId: string },
): Promise<NlTrialEval> {
  const client = requireLeagueClient()
  const payload = {
    organization_id: NL_ORG,
    candidate_id: input.candidateId,
    event_id: input.eventId ?? null,
    score: input.score ?? null,
    mechanics: input.mechanics ?? null,
    gamesense: input.gamesense ?? null,
    communication: input.communication ?? null,
    attitude: input.attitude ?? null,
    recommendation: input.recommendation ?? null,
    body: input.body ?? '',
    deleted_at: null,
  }
  const q = input.id
    ? client.from('nl_trial_evaluations').update(payload).eq('id', input.id)
    : client.from('nl_trial_evaluations').insert(payload)
  const { data, error } = await q.select('*').single()
  if (error) throw new Error(error.message)
  return {
    id: String(data.id),
    candidateId: String(data.candidate_id),
    eventId: data.event_id ?? undefined,
    score: data.score ?? undefined,
    mechanics: data.mechanics ?? undefined,
    gamesense: data.gamesense ?? undefined,
    communication: data.communication ?? undefined,
    attitude: data.attitude ?? undefined,
    recommendation: data.recommendation ?? undefined,
    body: String(data.body ?? ''),
  }
}

export async function listLeagueTasks(): Promise<NlTask[]> {
  const rows = await listRows('nl_tasks', 'created_at')
  return rows.map((row) => ({
    id: String(row.id),
    teamId: (row.team_id as string) ?? undefined,
    seasonId: (row.season_id as string) ?? undefined,
    eventId: (row.event_id as string) ?? undefined,
    title: String(row.title),
    description: String(row.description ?? ''),
    assigneeUserId: (row.assignee_user_id as string) ?? undefined,
    status: row.status as NlTask['status'],
    dueAt: (row.due_at as string) ?? undefined,
    kind: row.kind as NlTask['kind'],
  }))
}

export async function saveLeagueTask(input: Partial<NlTask> & { title: string }): Promise<NlTask> {
  const client = requireLeagueClient()
  const payload = {
    organization_id: NL_ORG,
    team_id: input.teamId ?? null,
    season_id: input.seasonId ?? null,
    event_id: input.eventId ?? null,
    title: input.title,
    description: input.description ?? '',
    assignee_user_id: input.assigneeUserId ?? null,
    status: input.status ?? 'todo',
    due_at: input.dueAt ?? null,
    kind: input.kind ?? 'general',
    deleted_at: null,
  }
  const q = input.id
    ? client.from('nl_tasks').update(payload).eq('id', input.id)
    : client.from('nl_tasks').insert(payload)
  const { data, error } = await q.select('*').single()
  if (error) throw new Error(error.message)
  return {
    id: String(data.id),
    teamId: data.team_id ?? undefined,
    seasonId: data.season_id ?? undefined,
    eventId: data.event_id ?? undefined,
    title: String(data.title),
    description: String(data.description ?? ''),
    assigneeUserId: data.assignee_user_id ?? undefined,
    status: data.status,
    dueAt: data.due_at ?? undefined,
    kind: data.kind,
  }
}

export async function listAnnouncements(): Promise<NlAnnouncement[]> {
  const rows = await listRows('nl_announcements', 'published_at')
  return rows.map((row) => ({
    id: String(row.id),
    teamId: (row.team_id as string) ?? undefined,
    seasonId: (row.season_id as string) ?? undefined,
    title: String(row.title),
    body: String(row.body ?? ''),
    pinned: Boolean(row.pinned),
    publishedAt: String(row.published_at),
  }))
}

export async function saveAnnouncement(
  input: Partial<NlAnnouncement> & { title: string },
): Promise<NlAnnouncement> {
  const client = requireLeagueClient()
  const payload = {
    organization_id: NL_ORG,
    team_id: input.teamId ?? null,
    season_id: input.seasonId ?? null,
    title: input.title,
    body: input.body ?? '',
    pinned: input.pinned ?? false,
    published_at: input.publishedAt ?? new Date().toISOString(),
    deleted_at: null,
  }
  const q = input.id
    ? client.from('nl_announcements').update(payload).eq('id', input.id)
    : client.from('nl_announcements').insert(payload)
  const { data, error } = await q.select('*').single()
  if (error) throw new Error(error.message)
  return {
    id: String(data.id),
    teamId: data.team_id ?? undefined,
    seasonId: data.season_id ?? undefined,
    title: String(data.title),
    body: String(data.body ?? ''),
    pinned: Boolean(data.pinned),
    publishedAt: String(data.published_at),
  }
}

export async function ensureEventChecklists(eventId: string, teamId?: string): Promise<NlChecklist[]> {
  const client = requireLeagueClient()
  const { data: existing, error } = await client
    .from('nl_checklists')
    .select('*')
    .eq('event_id', eventId)
    .eq('organization_id', NL_ORG)
    .is('deleted_at', null)
  if (error) throw new Error(error.message)
  if ((existing ?? []).length >= 2) {
    return (existing ?? []).map((row) => ({
      id: String(row.id),
      eventId: row.event_id ?? undefined,
      teamId: row.team_id ?? undefined,
      phase: row.phase,
      title: String(row.title),
    }))
  }

  const created: NlChecklist[] = []
  for (const [phase, title, defaults] of [
    ['pre', 'Checklist pre-partido', PRE_MATCH_DEFAULTS],
    ['post', 'Checklist post-partido', POST_MATCH_DEFAULTS],
  ] as const) {
    if ((existing ?? []).some((r) => r.phase === phase)) continue
    const { data: cl, error: clErr } = await client
      .from('nl_checklists')
      .insert({
        organization_id: NL_ORG,
        event_id: eventId,
        team_id: teamId ?? null,
        phase,
        title,
      })
      .select('*')
      .single()
    if (clErr) throw new Error(clErr.message)
    const items = defaults.map((label, i) => ({
      organization_id: NL_ORG,
      checklist_id: cl.id,
      label,
      sort_order: i,
    }))
    const { error: itemsErr } = await client.from('nl_checklist_items').insert(items)
    if (itemsErr) throw new Error(itemsErr.message)
    created.push({
      id: String(cl.id),
      eventId: cl.event_id ?? undefined,
      teamId: cl.team_id ?? undefined,
      phase: cl.phase,
      title: String(cl.title),
    })
  }
  return [...(existing ?? []).map((row) => ({
    id: String(row.id),
    eventId: row.event_id ?? undefined,
    teamId: row.team_id ?? undefined,
    phase: row.phase as 'pre' | 'post',
    title: String(row.title),
  })), ...created]
}

export async function listChecklistItems(checklistId: string): Promise<NlChecklistItem[]> {
  const client = requireLeagueClient()
  const { data, error } = await client
    .from('nl_checklist_items')
    .select('*')
    .eq('checklist_id', checklistId)
    .eq('organization_id', NL_ORG)
    .is('deleted_at', null)
    .order('sort_order')
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: String(row.id),
    checklistId: String(row.checklist_id),
    label: String(row.label),
    done: Boolean(row.done),
    sortOrder: Number(row.sort_order ?? 0),
    assigneeUserId: row.assignee_user_id ?? undefined,
  }))
}

export async function toggleChecklistItem(id: string, done: boolean): Promise<void> {
  const client = requireLeagueClient()
  const { error } = await client
    .from('nl_checklist_items')
    .update({ done })
    .eq('id', id)
    .eq('organization_id', NL_ORG)
  if (error) throw new Error(error.message)
}
