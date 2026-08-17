-- Owner ↔ asistente: vínculos operativos + notas del día por pareja

CREATE TABLE public.ops_owner_assistant_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_login text NOT NULL CHECK (length(trim(owner_login)) > 0),
  assistant_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assistant_login text NOT NULL CHECK (length(trim(assistant_login)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, owner_user_id),
  UNIQUE (organization_id, assistant_user_id),
  CHECK (owner_user_id <> assistant_user_id)
);

CREATE INDEX ops_owner_assistant_links_org_idx
  ON public.ops_owner_assistant_links (organization_id);

CREATE INDEX ops_owner_assistant_links_owner_idx
  ON public.ops_owner_assistant_links (organization_id, owner_user_id);

CREATE INDEX ops_owner_assistant_links_assistant_idx
  ON public.ops_owner_assistant_links (organization_id, assistant_user_id);

CREATE TRIGGER ops_owner_assistant_links_touch
  BEFORE UPDATE ON public.ops_owner_assistant_links
  FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

ALTER TABLE public.ops_owner_assistant_links ENABLE ROW LEVEL SECURITY;

-- Lectura: miembros ops de la org (owner/admin/manager/assistant)
CREATE POLICY ops_owner_assistant_links_read ON public.ops_owner_assistant_links
  FOR SELECT TO authenticated
  USING (
    organization_id = private.current_org_id()
    AND private.has_role(ARRAY['owner','admin','manager','assistant']::public.app_role[])
  );

-- Escritura: admin gestiona cualquier vínculo; owner solo el suyo
CREATE POLICY ops_owner_assistant_links_write ON public.ops_owner_assistant_links
  FOR ALL TO authenticated
  USING (
    organization_id = private.current_org_id()
    AND (
      private.has_role(ARRAY['admin']::public.app_role[])
      OR (
        private.has_role(ARRAY['owner']::public.app_role[])
        AND owner_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    organization_id = private.current_org_id()
    AND (
      private.has_role(ARRAY['admin']::public.app_role[])
      OR (
        private.has_role(ARRAY['owner']::public.app_role[])
        AND owner_user_id = auth.uid()
      )
    )
  );

-- Notas del día: alcance por pareja owner ↔ asistente
ALTER TABLE public.ops_day_notes
  ADD COLUMN owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN owner_login text,
  ADD COLUMN assistant_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN assistant_login text;

-- Las notas globales previas no encajan en el nuevo modelo
DELETE FROM public.ops_day_notes WHERE owner_user_id IS NULL;

ALTER TABLE public.ops_day_notes
  DROP CONSTRAINT IF EXISTS ops_day_notes_organization_id_note_date_key;

ALTER TABLE public.ops_day_notes
  ALTER COLUMN owner_user_id SET NOT NULL,
  ALTER COLUMN owner_login SET NOT NULL;

ALTER TABLE public.ops_day_notes
  ADD CONSTRAINT ops_day_notes_org_owner_date_key
  UNIQUE (organization_id, owner_user_id, note_date);

CREATE INDEX ops_day_notes_org_owner_date_idx
  ON public.ops_day_notes (organization_id, owner_user_id, note_date DESC);

DROP POLICY IF EXISTS ops_day_notes_org_read ON public.ops_day_notes;
DROP POLICY IF EXISTS ops_day_notes_org_write ON public.ops_day_notes;

CREATE OR REPLACE FUNCTION private.can_access_owner_day_note(
  p_owner_user_id uuid,
  p_assistant_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT
    p_owner_user_id = auth.uid()
    OR p_assistant_user_id = auth.uid()
    OR private.has_role(ARRAY['owner','admin']::public.app_role[]);
$$;

CREATE POLICY ops_day_notes_pair_read ON public.ops_day_notes
  FOR SELECT TO authenticated
  USING (
    organization_id = private.current_org_id()
    AND private.can_access_owner_day_note(owner_user_id, assistant_user_id)
  );

CREATE POLICY ops_day_notes_pair_write ON public.ops_day_notes
  FOR ALL TO authenticated
  USING (
    organization_id = private.current_org_id()
    AND private.can_access_owner_day_note(owner_user_id, assistant_user_id)
    AND private.has_role(ARRAY['owner','admin','manager','assistant']::public.app_role[])
  )
  WITH CHECK (
    organization_id = private.current_org_id()
    AND private.can_access_owner_day_note(owner_user_id, assistant_user_id)
    AND private.has_role(ARRAY['owner','admin','manager','assistant']::public.app_role[])
  );
