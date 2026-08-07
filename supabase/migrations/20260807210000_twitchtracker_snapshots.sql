-- Snapshots periódicos de la API básica de TwitchTracker (resumen 30 días por canal)
CREATE TABLE public.twitchtracker_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  talent_id uuid NOT NULL REFERENCES public.talents(id),
  login text NOT NULL,
  period_days integer NOT NULL DEFAULT 30 CHECK (period_days > 0),
  rank integer,
  avg_viewers integer NOT NULL DEFAULT 0 CHECK (avg_viewers >= 0),
  max_viewers integer NOT NULL DEFAULT 0 CHECK (max_viewers >= 0),
  minutes_streamed integer NOT NULL DEFAULT 0 CHECK (minutes_streamed >= 0),
  hours_watched integer NOT NULL DEFAULT 0 CHECK (hours_watched >= 0),
  followers_growth integer,
  followers_total integer,
  raw_payload jsonb,
  sync_date date NOT NULL DEFAULT (CURRENT_DATE),
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, talent_id, sync_date)
);

CREATE INDEX twitchtracker_snapshots_login_synced_idx
  ON public.twitchtracker_snapshots (login, synced_at DESC);

CREATE INDEX twitchtracker_snapshots_org_synced_idx
  ON public.twitchtracker_snapshots (organization_id, synced_at DESC);

ALTER TABLE public.twitchtracker_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY twitchtracker_snapshots_org_read ON public.twitchtracker_snapshots
  FOR SELECT TO authenticated
  USING (organization_id = private.current_org_id());

CREATE POLICY twitchtracker_snapshots_org_write ON public.twitchtracker_snapshots
  FOR ALL TO authenticated
  USING (
    organization_id = private.current_org_id()
    AND private.has_role(ARRAY['owner','admin','manager']::public.app_role[])
  )
  WITH CHECK (
    organization_id = private.current_org_id()
    AND private.has_role(ARRAY['owner','admin','manager']::public.app_role[])
  );
