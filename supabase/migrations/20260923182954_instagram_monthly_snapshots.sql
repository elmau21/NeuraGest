-- Snapshots mensuales de Instagram (Bright Data MCP / sync manual — sin polling)
CREATE TABLE public.instagram_monthly_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  talent_id uuid REFERENCES public.talents(id),
  login text,
  instagram_handle text NOT NULL,
  followers integer NOT NULL DEFAULT 0 CHECK (followers >= 0),
  following integer CHECK (following IS NULL OR following >= 0),
  media_count integer CHECK (media_count IS NULL OR media_count >= 0),
  views bigint CHECK (views IS NULL OR views >= 0),
  views_available boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'bright_data_mcp',
  raw_payload jsonb,
  snapshot_month date NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, instagram_handle, snapshot_month),
  CONSTRAINT instagram_monthly_snapshots_month_first_day
    CHECK (snapshot_month = date_trunc('month', snapshot_month)::date)
);

CREATE INDEX instagram_monthly_snapshots_handle_month_idx
  ON public.instagram_monthly_snapshots (instagram_handle, snapshot_month DESC);

CREATE INDEX instagram_monthly_snapshots_org_month_idx
  ON public.instagram_monthly_snapshots (organization_id, snapshot_month DESC);

CREATE INDEX instagram_monthly_snapshots_login_month_idx
  ON public.instagram_monthly_snapshots (login, snapshot_month DESC)
  WHERE login IS NOT NULL;

ALTER TABLE public.instagram_monthly_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY instagram_monthly_snapshots_org_read ON public.instagram_monthly_snapshots
  FOR SELECT TO authenticated
  USING (organization_id = private.current_org_id());

CREATE POLICY instagram_monthly_snapshots_org_write ON public.instagram_monthly_snapshots
  FOR ALL TO authenticated
  USING (
    organization_id = private.current_org_id()
    AND private.has_role(ARRAY['owner','admin','manager']::public.app_role[])
  )
  WITH CHECK (
    organization_id = private.current_org_id()
    AND private.has_role(ARRAY['owner','admin','manager']::public.app_role[])
  );

COMMENT ON TABLE public.instagram_monthly_snapshots IS
  'Cartera IG Neura: un snapshot por handle y mes (Bright Data MCP). No streaming continuo.';
