-- Seed roles NeuraLeague + RLS en tablas nl_*

INSERT INTO public.roles (name, permissions)
VALUES
  ('league_manager', '{"neuralleague":true,"mutate":true}'::jsonb),
  ('coach', '{"neuralleague":true,"mutate":true}'::jsonb),
  ('analyst', '{"neuralleague":true,"mutate":true,"stats":true}'::jsonb),
  ('player', '{"neuralleague":true,"mutate":false}'::jsonb)
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION private.nl_can_read()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT private.has_role(ARRAY[
    'owner','admin','manager','staff','dev',
    'league_manager','coach','analyst','player'
  ]::public.app_role[]);
$$;

CREATE OR REPLACE FUNCTION private.nl_can_write()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT private.has_role(ARRAY[
    'owner','admin','manager','league_manager','coach','analyst'
  ]::public.app_role[]);
$$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'nl_games','nl_seasons','nl_divisions','nl_teams','nl_players','nl_roster_entries',
    'nl_staff_assignments','nl_events','nl_event_players','nl_player_stats','nl_team_map_stats',
    'nl_vods','nl_vod_notes','nl_match_reports','nl_objectives','nl_training_sessions',
    'nl_practice_blocks','nl_attendance','nl_availability','nl_incidents','nl_player_contracts',
    'nl_tryouts','nl_candidates','nl_trial_evaluations','nl_tasks','nl_announcements',
    'nl_checklists','nl_checklist_items'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS %I_org_read ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_org_read ON public.%I FOR SELECT TO authenticated
       USING (organization_id = private.current_org_id() AND private.nl_can_read())',
      t, t
    );

    EXECUTE format('DROP POLICY IF EXISTS %I_org_write ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_org_write ON public.%I FOR ALL TO authenticated
       USING (organization_id = private.current_org_id() AND private.nl_can_write())
       WITH CHECK (organization_id = private.current_org_id() AND private.nl_can_write())',
      t, t
    );
  END LOOP;
END $$;

-- Jugadores pueden actualizar su propia disponibilidad
DROP POLICY IF EXISTS nl_availability_player_self ON public.nl_availability;
CREATE POLICY nl_availability_player_self ON public.nl_availability
  FOR ALL TO authenticated
  USING (
    organization_id = private.current_org_id()
    AND private.has_role(ARRAY['player']::public.app_role[])
    AND player_id IN (
      SELECT p.id FROM public.nl_players p
      JOIN public.app_users au ON au.id = p.app_user_id
      WHERE au.auth_user_id = auth.uid()
        AND p.deleted_at IS NULL
    )
  )
  WITH CHECK (
    organization_id = private.current_org_id()
    AND private.has_role(ARRAY['player']::public.app_role[])
    AND player_id IN (
      SELECT p.id FROM public.nl_players p
      JOIN public.app_users au ON au.id = p.app_user_id
      WHERE au.auth_user_id = auth.uid()
        AND p.deleted_at IS NULL
    )
  );

-- Trigger function: no RPC pública
REVOKE ALL ON FUNCTION public.nl_assert_no_player_overlap() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nl_assert_no_player_overlap() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nl_assert_no_player_overlap() TO postgres, service_role;
