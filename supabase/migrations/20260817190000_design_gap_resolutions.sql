-- Huecos de diseño: marcar talento como resuelto (Centro de control / Diseño)

CREATE TABLE IF NOT EXISTS public.design_gap_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  talent_login text NOT NULL CHECK (length(trim(talent_login)) > 0),
  talent_id uuid REFERENCES public.talents(id) ON DELETE SET NULL,
  resolved_at timestamptz NOT NULL DEFAULT now(),
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_by_login text,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, talent_login)
);

CREATE INDEX IF NOT EXISTS design_gap_resolutions_org_login_idx
  ON public.design_gap_resolutions (organization_id, talent_login);

DROP TRIGGER IF EXISTS design_gap_resolutions_touch ON public.design_gap_resolutions;
CREATE TRIGGER design_gap_resolutions_touch
  BEFORE UPDATE ON public.design_gap_resolutions
  FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

ALTER TABLE public.design_gap_resolutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS design_gap_resolutions_org_read ON public.design_gap_resolutions;
CREATE POLICY design_gap_resolutions_org_read ON public.design_gap_resolutions
  FOR SELECT TO authenticated
  USING (organization_id = private.current_org_id());

DROP POLICY IF EXISTS design_gap_resolutions_org_write ON public.design_gap_resolutions;
CREATE POLICY design_gap_resolutions_org_write ON public.design_gap_resolutions
  FOR ALL TO authenticated
  USING (
    organization_id = private.current_org_id()
    AND private.has_role(ARRAY['owner','admin','manager','assistant','dev','designer']::public.app_role[])
  )
  WITH CHECK (
    organization_id = private.current_org_id()
    AND private.has_role(ARRAY['owner','admin','manager','assistant','dev','designer']::public.app_role[])
  );
