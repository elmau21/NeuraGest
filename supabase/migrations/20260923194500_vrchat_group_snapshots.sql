-- Snapshots del grupo VRChat (API comunitaria · sync manual / poll lento)
CREATE TABLE IF NOT EXISTS public.vrchat_group_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  group_id text NOT NULL,
  name text NOT NULL DEFAULT '',
  icon_url text,
  member_count integer NOT NULL DEFAULT 0 CHECK (member_count >= 0),
  online_member_count integer NOT NULL DEFAULT 0 CHECK (online_member_count >= 0),
  short_code text,
  discriminator text,
  raw_payload jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vrchat_group_snapshots_group_synced_idx
  ON public.vrchat_group_snapshots (group_id, synced_at DESC);

CREATE INDEX IF NOT EXISTS vrchat_group_snapshots_org_synced_idx
  ON public.vrchat_group_snapshots (organization_id, synced_at DESC);

ALTER TABLE public.vrchat_group_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY vrchat_group_snapshots_org_read ON public.vrchat_group_snapshots
    FOR SELECT TO authenticated
    USING (organization_id = private.current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY vrchat_group_snapshots_org_write ON public.vrchat_group_snapshots
    FOR ALL TO authenticated
    USING (
      organization_id = private.current_org_id()
      AND private.has_role(ARRAY['owner','admin','manager']::public.app_role[])
    )
    WITH CHECK (
      organization_id = private.current_org_id()
      AND private.has_role(ARRAY['owner','admin','manager']::public.app_role[])
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE public.vrchat_group_snapshots IS
  'Grupo VRChat Neura: member_count / online_member_count vía API comunitaria (auth cookie). Poll lento, no streaming.';
