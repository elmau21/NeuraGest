-- NeuraLeague ops (NeuraGest). Prefijo nl_ para no chocar con tablas públicas neuralleague_*.

CREATE OR REPLACE FUNCTION private.nl_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─── Identidad / estructura ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.nl_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  slug text NOT NULL,
  icon_url text,
  agent_label text NOT NULL DEFAULT 'agente',
  map_label text NOT NULL DEFAULT 'mapa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (organization_id, slug)
);

CREATE TABLE IF NOT EXISTS public.nl_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  slug text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'open', 'active', 'closed', 'archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  rules_md text NOT NULL DEFAULT '',
  rules_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  public_tournament_id uuid,
  notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (organization_id, slug)
);

CREATE TABLE IF NOT EXISTS public.nl_divisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  season_id uuid NOT NULL REFERENCES public.nl_seasons(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.nl_games(id),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  tier text,
  max_teams int,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.nl_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  season_id uuid REFERENCES public.nl_seasons(id) ON DELETE SET NULL,
  division_id uuid REFERENCES public.nl_divisions(id) ON DELETE SET NULL,
  game_id uuid NOT NULL REFERENCES public.nl_games(id),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  tag text NOT NULL CHECK (length(trim(tag)) > 0),
  logo_url text,
  region text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'disbanded')),
  socials jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text NOT NULL DEFAULT '',
  public_team_id uuid,
  created_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.nl_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  nickname text NOT NULL CHECK (length(trim(nickname)) > 0),
  real_name text,
  country text,
  region text,
  bio text NOT NULL DEFAULT '',
  avatar_url text,
  socials jsonb NOT NULL DEFAULT '{}'::jsonb,
  primary_role text,
  talent_id uuid REFERENCES public.talents(id) ON DELETE SET NULL,
  app_user_id uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'alumni', 'banned')),
  joined_at date,
  left_at date,
  notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.nl_roster_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  team_id uuid NOT NULL REFERENCES public.nl_teams(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.nl_players(id) ON DELETE CASCADE,
  season_id uuid REFERENCES public.nl_seasons(id) ON DELETE SET NULL,
  slot text NOT NULL DEFAULT 'starter'
    CHECK (slot IN ('starter', 'sub', 'trial', 'inactive')),
  in_game_role text,
  is_captain boolean NOT NULL DEFAULT false,
  joined_at date,
  left_at date,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (team_id, player_id, season_id)
);

CREATE TABLE IF NOT EXISTS public.nl_staff_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  team_id uuid NOT NULL REFERENCES public.nl_teams(id) ON DELETE CASCADE,
  player_id uuid REFERENCES public.nl_players(id) ON DELETE SET NULL,
  app_user_id uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  season_id uuid REFERENCES public.nl_seasons(id) ON DELETE SET NULL,
  staff_role text NOT NULL
    CHECK (staff_role IN ('coach', 'assistant', 'manager', 'analyst', 'other')),
  display_name text,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- ─── Competencia / práctica ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.nl_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  season_id uuid REFERENCES public.nl_seasons(id) ON DELETE SET NULL,
  team_id uuid REFERENCES public.nl_teams(id) ON DELETE SET NULL,
  game_id uuid REFERENCES public.nl_games(id) ON DELETE SET NULL,
  event_type text NOT NULL DEFAULT 'scrim'
    CHECK (event_type IN ('scrim', 'match', 'training', 'review', 'tryout', 'other')),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  opponent text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'live', 'done', 'cancelled', 'no_show')),
  location text,
  stream_url text,
  calendar_event_id uuid REFERENCES public.calendar_events(id) ON DELETE SET NULL,
  notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.nl_event_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  event_id uuid NOT NULL REFERENCES public.nl_events(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.nl_players(id) ON DELETE CASCADE,
  role_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (event_id, player_id)
);

CREATE TABLE IF NOT EXISTS public.nl_player_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  event_id uuid REFERENCES public.nl_events(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.nl_players(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.nl_teams(id) ON DELETE SET NULL,
  map_name text,
  agent_or_champ text,
  kills int NOT NULL DEFAULT 0,
  deaths int NOT NULL DEFAULT 0,
  assists int NOT NULL DEFAULT 0,
  rating numeric,
  adr numeric,
  acs numeric,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.nl_team_map_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  event_id uuid REFERENCES public.nl_events(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.nl_teams(id) ON DELETE CASCADE,
  map_name text NOT NULL,
  side text,
  result text CHECK (result IS NULL OR result IN ('win', 'loss', 'draw')),
  rounds_won int,
  rounds_lost int,
  agent_comp text[] NOT NULL DEFAULT '{}',
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.nl_vods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  season_id uuid REFERENCES public.nl_seasons(id) ON DELETE SET NULL,
  team_id uuid REFERENCES public.nl_teams(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.nl_events(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (length(trim(title)) > 0),
  url text NOT NULL,
  kind text NOT NULL DEFAULT 'vod'
    CHECK (kind IN ('vod', 'demo', 'clip', 'other')),
  map_name text,
  recorded_at timestamptz,
  uploaded_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.nl_vod_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  vod_id uuid NOT NULL REFERENCES public.nl_vods(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  timestamp_sec int NOT NULL DEFAULT 0 CHECK (timestamp_sec >= 0),
  body text NOT NULL CHECK (length(trim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.nl_match_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  event_id uuid NOT NULL REFERENCES public.nl_events(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.nl_teams(id) ON DELETE SET NULL,
  author_id uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  score_us text,
  score_them text,
  summary text NOT NULL DEFAULT '',
  what_went_well text NOT NULL DEFAULT '',
  what_to_improve text NOT NULL DEFAULT '',
  individual_notes text NOT NULL DEFAULT '',
  next_focus text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (event_id)
);

CREATE TABLE IF NOT EXISTS public.nl_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  season_id uuid REFERENCES public.nl_seasons(id) ON DELETE SET NULL,
  team_id uuid REFERENCES public.nl_teams(id) ON DELETE SET NULL,
  player_id uuid REFERENCES public.nl_players(id) ON DELETE SET NULL,
  week_start date NOT NULL,
  scope text NOT NULL DEFAULT 'team'
    CHECK (scope IN ('team', 'player')),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'done', 'missed', 'cancelled')),
  metric_before text,
  metric_after text,
  created_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- ─── Entrenamiento y disciplina ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.nl_training_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  team_id uuid REFERENCES public.nl_teams(id) ON DELETE SET NULL,
  season_id uuid REFERENCES public.nl_seasons(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.nl_events(id) ON DELETE SET NULL,
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'done', 'cancelled')),
  notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.nl_practice_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  training_id uuid NOT NULL REFERENCES public.nl_training_sessions(id) ON DELETE CASCADE,
  block_type text NOT NULL
    CHECK (block_type IN ('aim', 'strats', 'review', 'scrim', 'vod', 'other')),
  title text NOT NULL,
  duration_min int,
  sort_order int NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.nl_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  training_id uuid NOT NULL REFERENCES public.nl_training_sessions(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.nl_players(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'present'
    CHECK (status IN ('present', 'late', 'absent', 'excused')),
  arrived_at timestamptz,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (training_id, player_id)
);

CREATE TABLE IF NOT EXISTS public.nl_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  player_id uuid NOT NULL REFERENCES public.nl_players(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  slots jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (player_id, week_start)
);

CREATE TABLE IF NOT EXISTS public.nl_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  player_id uuid REFERENCES public.nl_players(id) ON DELETE SET NULL,
  team_id uuid REFERENCES public.nl_teams(id) ON DELETE SET NULL,
  season_id uuid REFERENCES public.nl_seasons(id) ON DELETE SET NULL,
  kind text NOT NULL
    CHECK (kind IN ('no_show', 'toxicity', 'lateness', 'warning', 'sanction', 'other')),
  severity text NOT NULL DEFAULT 'low'
    CHECK (severity IN ('low', 'medium', 'high')),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.nl_player_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  player_id uuid NOT NULL REFERENCES public.nl_players(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  title text NOT NULL,
  external_url text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'expired', 'terminated')),
  starts_on date,
  ends_on date,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- ─── Reclutamiento ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.nl_tryouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  season_id uuid REFERENCES public.nl_seasons(id) ON DELETE SET NULL,
  team_id uuid REFERENCES public.nl_teams(id) ON DELETE SET NULL,
  game_id uuid REFERENCES public.nl_games(id) ON DELETE SET NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'cancelled')),
  opens_at timestamptz,
  closes_at timestamptz,
  description text NOT NULL DEFAULT '',
  contact_channel text,
  created_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.nl_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  tryout_id uuid REFERENCES public.nl_tryouts(id) ON DELETE SET NULL,
  team_id uuid REFERENCES public.nl_teams(id) ON DELETE SET NULL,
  game_id uuid REFERENCES public.nl_games(id) ON DELETE SET NULL,
  nickname text NOT NULL,
  real_name text,
  contact text,
  contact_channel text,
  role_interest text,
  pipeline_stage text NOT NULL DEFAULT 'applied'
    CHECK (pipeline_stage IN ('applied', 'screening', 'trial', 'decision', 'accepted', 'rejected', 'waitlist')),
  socials jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text NOT NULL DEFAULT '',
  scouting boolean NOT NULL DEFAULT false,
  player_id uuid REFERENCES public.nl_players(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.nl_trial_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  candidate_id uuid NOT NULL REFERENCES public.nl_candidates(id) ON DELETE CASCADE,
  evaluator_id uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.nl_events(id) ON DELETE SET NULL,
  score int CHECK (score IS NULL OR (score >= 1 AND score <= 10)),
  mechanics int CHECK (mechanics IS NULL OR (mechanics >= 1 AND mechanics <= 10)),
  gamesense int CHECK (gamesense IS NULL OR (gamesense >= 1 AND gamesense <= 10)),
  communication int CHECK (communication IS NULL OR (communication >= 1 AND communication <= 10)),
  attitude int CHECK (attitude IS NULL OR (attitude >= 1 AND attitude <= 10)),
  recommendation text
    CHECK (recommendation IS NULL OR recommendation IN ('accept', 'reject', 'waitlist', 'retrial')),
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- ─── Operación ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.nl_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  team_id uuid REFERENCES public.nl_teams(id) ON DELETE SET NULL,
  season_id uuid REFERENCES public.nl_seasons(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.nl_events(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  assignee_user_id uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo', 'doing', 'done', 'cancelled')),
  due_at timestamptz,
  kind text NOT NULL DEFAULT 'general'
    CHECK (kind IN ('general', 'scrim', 'vod', 'announce', 'checklist', 'other')),
  work_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.nl_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  team_id uuid REFERENCES public.nl_teams(id) ON DELETE SET NULL,
  season_id uuid REFERENCES public.nl_seasons(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  pinned boolean NOT NULL DEFAULT false,
  author_id uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.nl_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  event_id uuid REFERENCES public.nl_events(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.nl_teams(id) ON DELETE SET NULL,
  phase text NOT NULL
    CHECK (phase IN ('pre', 'post')),
  title text NOT NULL,
  created_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.nl_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  checklist_id uuid NOT NULL REFERENCES public.nl_checklists(id) ON DELETE CASCADE,
  label text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  assignee_user_id uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- ─── Índices ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS nl_seasons_org_idx ON public.nl_seasons (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS nl_games_org_idx ON public.nl_games (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS nl_divisions_season_idx ON public.nl_divisions (season_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS nl_teams_org_idx ON public.nl_teams (organization_id, game_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS nl_players_org_idx ON public.nl_players (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS nl_roster_team_idx ON public.nl_roster_entries (team_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS nl_events_starts_idx ON public.nl_events (organization_id, starts_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS nl_events_team_idx ON public.nl_events (team_id, starts_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS nl_event_players_player_idx ON public.nl_event_players (player_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS nl_player_stats_player_idx ON public.nl_player_stats (player_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS nl_vods_team_idx ON public.nl_vods (team_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS nl_objectives_week_idx ON public.nl_objectives (organization_id, week_start) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS nl_training_starts_idx ON public.nl_training_sessions (organization_id, starts_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS nl_candidates_stage_idx ON public.nl_candidates (organization_id, pipeline_stage) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS nl_tasks_status_idx ON public.nl_tasks (organization_id, status) WHERE deleted_at IS NULL;

-- ─── Triggers updated_at ──────────────────────────────────────────────────────

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'nl_games','nl_seasons','nl_divisions','nl_teams','nl_players','nl_roster_entries',
    'nl_staff_assignments','nl_events','nl_player_stats','nl_team_map_stats','nl_vods',
    'nl_vod_notes','nl_match_reports','nl_objectives','nl_training_sessions','nl_practice_blocks',
    'nl_attendance','nl_availability','nl_incidents','nl_player_contracts','nl_tryouts',
    'nl_candidates','nl_trial_evaluations','nl_tasks','nl_announcements','nl_checklists',
    'nl_checklist_items'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_touch ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_touch BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.nl_touch_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- ─── Validación: no solapar eventos del mismo jugador ─────────────────────────

CREATE OR REPLACE FUNCTION public.nl_assert_no_player_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  ev_start timestamptz;
  ev_end timestamptz;
  conflict_title text;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT e.starts_at, COALESCE(e.ends_at, e.starts_at + interval '2 hours')
  INTO ev_start, ev_end
  FROM public.nl_events e
  WHERE e.id = NEW.event_id AND e.deleted_at IS NULL;

  IF ev_start IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT e.title INTO conflict_title
  FROM public.nl_event_players ep
  JOIN public.nl_events e ON e.id = ep.event_id
  WHERE ep.player_id = NEW.player_id
    AND ep.deleted_at IS NULL
    AND e.deleted_at IS NULL
    AND e.id <> NEW.event_id
    AND e.status <> 'cancelled'
    AND tstzrange(e.starts_at, COALESCE(e.ends_at, e.starts_at + interval '2 hours'), '[)')
        && tstzrange(ev_start, ev_end, '[)')
  LIMIT 1;

  IF conflict_title IS NOT NULL THEN
    RAISE EXCEPTION 'El jugador ya tiene otro evento a la misma hora: %', conflict_title
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS nl_event_players_no_overlap ON public.nl_event_players;
CREATE TRIGGER nl_event_players_no_overlap
  BEFORE INSERT OR UPDATE ON public.nl_event_players
  FOR EACH ROW
  EXECUTE FUNCTION public.nl_assert_no_player_overlap();

-- ─── Seed mínimo ──────────────────────────────────────────────────────────────

INSERT INTO public.nl_games (organization_id, name, slug, agent_label, map_label)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'League of Legends', 'lol', 'campeón', 'mapa'),
  ('00000000-0000-0000-0000-000000000001', 'VALORANT', 'valorant', 'agente', 'mapa'),
  ('00000000-0000-0000-0000-000000000001', 'Gears 5', 'gears-5', 'clase', 'mapa')
ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO public.nl_seasons (organization_id, name, slug, status, starts_at, ends_at, rules_md, public_tournament_id)
SELECT
  '00000000-0000-0000-0000-000000000001',
  'Temporada 2026',
  'temporada-2026',
  'active',
  t.start_at,
  t.end_at,
  'Reglamento oficial NeuraLeague. Ver directrices en neuralive.online.',
  t.id
FROM public.neuralleague_tournaments t
WHERE t.slug = 'neuralleague-2026'
ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO public.nl_seasons (organization_id, name, slug, status, rules_md)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Temporada 2026',
  'temporada-2026',
  'active',
  'Reglamento oficial NeuraLeague. Ver directrices en neuralive.online.'
)
ON CONFLICT (organization_id, slug) DO NOTHING;
