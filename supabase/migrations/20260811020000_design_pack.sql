-- Pack Diseño: Listo para Twitch + briefs creativos

ALTER TABLE public.creative_drive_items
  ADD COLUMN IF NOT EXISTS ready_for_twitch boolean NOT NULL DEFAULT false;

ALTER TABLE public.creative_drive_items
  ADD COLUMN IF NOT EXISTS asset_kind text
  CHECK (
    asset_kind IS NULL
    OR asset_kind IN ('offline', 'banner', 'panel', 'overlay', 'thumbnail', 'other')
  );

CREATE INDEX IF NOT EXISTS creative_drive_items_ready_idx
  ON public.creative_drive_items (organization_id, ready_for_twitch)
  WHERE deleted_at IS NULL AND kind = 'file';

CREATE TABLE IF NOT EXISTS public.design_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  talent_id uuid REFERENCES public.talents(id) ON DELETE SET NULL,
  talent_login text,
  calendar_event_id uuid REFERENCES public.calendar_events(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.sponsorship_deals(id) ON DELETE SET NULL,
  stream_title text,
  stream_starts_at timestamptz,
  body text NOT NULL DEFAULT '',
  asset_checklist text[] NOT NULL DEFAULT '{}',
  drive_folder_id uuid REFERENCES public.creative_drive_items(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'done')),
  created_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS design_briefs_org_starts_idx
  ON public.design_briefs (organization_id, stream_starts_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS design_briefs_talent_idx
  ON public.design_briefs (talent_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS design_briefs_touch ON public.design_briefs;
CREATE TRIGGER design_briefs_touch
  BEFORE UPDATE ON public.design_briefs
  FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

CREATE OR REPLACE FUNCTION public.design_briefs_set_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NEW.created_by IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT au.id INTO NEW.created_by
    FROM public.app_users au
    WHERE au.auth_user_id = auth.uid()
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS design_briefs_set_created_by ON public.design_briefs;
CREATE TRIGGER design_briefs_set_created_by
  BEFORE INSERT ON public.design_briefs
  FOR EACH ROW
  EXECUTE FUNCTION public.design_briefs_set_created_by();

ALTER TABLE public.design_briefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS design_briefs_org_read ON public.design_briefs;
CREATE POLICY design_briefs_org_read ON public.design_briefs
  FOR SELECT TO authenticated
  USING (organization_id = private.current_org_id());

DROP POLICY IF EXISTS design_briefs_org_write ON public.design_briefs;
CREATE POLICY design_briefs_org_write ON public.design_briefs
  FOR ALL TO authenticated
  USING (
    organization_id = private.current_org_id()
    AND private.has_role(ARRAY['owner','admin','manager']::public.app_role[])
  )
  WITH CHECK (
    organization_id = private.current_org_id()
    AND private.has_role(ARRAY['owner','admin','manager']::public.app_role[])
  );
