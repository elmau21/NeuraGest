-- Mini-fichas operativas: campañas y eventos (Centro de control / asistentes)

CREATE TABLE public.ops_event_fichas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  nombre text NOT NULL CHECK (length(trim(nombre)) > 0),
  objetivo text NOT NULL DEFAULT '',
  fecha date,
  responsable text NOT NULL DEFAULT '',
  participantes text NOT NULL DEFAULT '',
  contenido_necesario text NOT NULL DEFAULT '',
  promocion text NOT NULL DEFAULT '',
  recursos text NOT NULL DEFAULT '',
  aprobacion_directiva text NOT NULL DEFAULT 'pendiente'
    CHECK (aprobacion_directiva IN ('si', 'no', 'pendiente')),
  estado text NOT NULL DEFAULT 'idea'
    CHECK (estado IN ('idea', 'planificacion', 'produccion', 'publicado', 'cerrado')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_login text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by_login text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ops_event_fichas_org_updated_idx
  ON public.ops_event_fichas (organization_id, updated_at DESC);

CREATE INDEX ops_event_fichas_org_estado_idx
  ON public.ops_event_fichas (organization_id, estado);

CREATE TRIGGER ops_event_fichas_touch
  BEFORE UPDATE ON public.ops_event_fichas
  FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

ALTER TABLE public.ops_event_fichas ENABLE ROW LEVEL SECURITY;

CREATE POLICY ops_event_fichas_org_read ON public.ops_event_fichas
  FOR SELECT TO authenticated
  USING (organization_id = private.current_org_id());

CREATE POLICY ops_event_fichas_org_write ON public.ops_event_fichas
  FOR ALL TO authenticated
  USING (
    organization_id = private.current_org_id()
    AND private.has_role(ARRAY['owner','admin','manager','assistant']::public.app_role[])
  )
  WITH CHECK (
    organization_id = private.current_org_id()
    AND private.has_role(ARRAY['owner','admin','manager','assistant']::public.app_role[])
  );
