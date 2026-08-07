-- Historial unificado de métricas por refresh Helix
CREATE TABLE public.metric_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  talent_id uuid NOT NULL REFERENCES public.talents(id),
  login text NOT NULL,
  viewers integer NOT NULL DEFAULT 0 CHECK (viewers >= 0),
  is_live boolean NOT NULL DEFAULT false,
  category text,
  followers integer,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX metric_snapshots_talent_captured_idx
  ON public.metric_snapshots (talent_id, captured_at DESC);
CREATE INDEX metric_snapshots_org_captured_idx
  ON public.metric_snapshots (organization_id, captured_at DESC);
CREATE INDEX metric_snapshots_login_captured_idx
  ON public.metric_snapshots (login, captured_at DESC);

CREATE TABLE public.stream_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  talent_id uuid REFERENCES public.talents(id),
  login text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('stream.online', 'stream.offline')),
  stream_id text,
  category_name text,
  title text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX stream_events_talent_occurred_idx
  ON public.stream_events (talent_id, occurred_at DESC);
CREATE INDEX stream_events_org_occurred_idx
  ON public.stream_events (organization_id, occurred_at DESC);

ALTER TABLE public.metric_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stream_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY metric_snapshots_org_read ON public.metric_snapshots
  FOR SELECT TO authenticated
  USING (organization_id = private.current_org_id());

CREATE POLICY metric_snapshots_org_write ON public.metric_snapshots
  FOR ALL TO authenticated
  USING (
    organization_id = private.current_org_id()
    AND private.has_role(ARRAY['owner','admin','manager']::public.app_role[])
  )
  WITH CHECK (
    organization_id = private.current_org_id()
    AND private.has_role(ARRAY['owner','admin','manager']::public.app_role[])
  );

CREATE POLICY stream_events_org_read ON public.stream_events
  FOR SELECT TO authenticated
  USING (organization_id = private.current_org_id());

CREATE POLICY stream_events_org_write ON public.stream_events
  FOR ALL TO authenticated
  USING (
    organization_id = private.current_org_id()
    AND private.has_role(ARRAY['owner','admin','manager']::public.app_role[])
  )
  WITH CHECK (
    organization_id = private.current_org_id()
    AND private.has_role(ARRAY['owner','admin','manager']::public.app_role[])
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.metric_snapshots, public.stream_events;
