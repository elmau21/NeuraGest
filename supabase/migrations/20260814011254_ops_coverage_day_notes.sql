-- Centro de control: cobertura War Room del día + notas compartidas owner/asistente

CREATE TABLE public.ops_coverage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  coverage_date date NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  login text NOT NULL CHECK (length(trim(login)) > 0),
  display_name text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, coverage_date)
);

CREATE INDEX ops_coverage_org_date_idx
  ON public.ops_coverage (organization_id, coverage_date DESC);

CREATE TABLE public.ops_day_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  note_date date NOT NULL,
  body text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by_login text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, note_date)
);

CREATE INDEX ops_day_notes_org_date_idx
  ON public.ops_day_notes (organization_id, note_date DESC);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['ops_coverage','ops_day_notes'] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I_touch BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at()',
      t, t
    );
  END LOOP;
END $$;

ALTER TABLE public.ops_coverage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_day_notes ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier miembro autenticado de la org
-- Escritura: owner / admin / manager (assistant hereda vía private.has_role)
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['ops_coverage','ops_day_notes'] LOOP
    EXECUTE format(
      'CREATE POLICY %I_org_read ON public.%I FOR SELECT TO authenticated USING (organization_id = private.current_org_id())',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY %I_org_write ON public.%I FOR ALL TO authenticated USING (organization_id = private.current_org_id() AND private.has_role(ARRAY[''owner'',''admin'',''manager'',''assistant'']::public.app_role[])) WITH CHECK (organization_id = private.current_org_id() AND private.has_role(ARRAY[''owner'',''admin'',''manager'',''assistant'']::public.app_role[]))',
      t, t
    );
  END LOOP;
END $$;
