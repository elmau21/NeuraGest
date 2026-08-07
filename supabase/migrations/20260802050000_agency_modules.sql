-- Módulos agencia: talent_managers, pipeline, CRM, onboarding

CREATE TYPE public.content_pipeline_status AS ENUM ('idea', 'editing', 'published');
CREATE TYPE public.content_type AS ENUM ('clip', 'vod', 'highlight');
CREATE TYPE public.sponsorship_status AS ENUM ('lead', 'negotiating', 'active', 'completed', 'cancelled');

CREATE TABLE public.talent_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  talent_id uuid NOT NULL REFERENCES public.talents(id) ON DELETE CASCADE,
  manager_app_user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES public.app_users(id),
  UNIQUE (talent_id, manager_app_user_id)
);

CREATE INDEX talent_managers_org_idx ON public.talent_managers(organization_id);
CREATE INDEX talent_managers_manager_idx ON public.talent_managers(manager_app_user_id);

CREATE TABLE public.content_pipeline_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  talent_id uuid REFERENCES public.talents(id),
  title text NOT NULL CHECK (length(title) <= 300),
  description text,
  status public.content_pipeline_status NOT NULL DEFAULT 'idea',
  content_type public.content_type NOT NULL DEFAULT 'clip',
  url text,
  position numeric NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX content_pipeline_org_status_idx ON public.content_pipeline_items(organization_id, status) WHERE deleted_at IS NULL;

CREATE TABLE public.sponsorship_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  brand_name text NOT NULL,
  talent_id uuid REFERENCES public.talents(id),
  deal_value numeric(14,2),
  currency text NOT NULL DEFAULT 'MXN',
  deliverables text,
  start_date date,
  end_date date,
  progress_percent integer NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  status public.sponsorship_status NOT NULL DEFAULT 'lead',
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  calendar_event_id uuid REFERENCES public.calendar_events(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX sponsorship_deals_org_idx ON public.sponsorship_deals(organization_id) WHERE deleted_at IS NULL;

CREATE TABLE public.talent_onboarding_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  talent_id uuid NOT NULL REFERENCES public.talents(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  position integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (talent_id, title)
);

CREATE INDEX talent_onboarding_talent_idx ON public.talent_onboarding_items(talent_id, position);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['content_pipeline_items','sponsorship_deals','talent_onboarding_items'] LOOP
    EXECUTE format('CREATE TRIGGER %I_touch BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at()', t, t);
  END LOOP;
END $$;

ALTER TABLE public.talent_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_pipeline_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsorship_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_onboarding_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY talent_managers_deny_client ON public.talent_managers FOR ALL TO anon, authenticated USING (false);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['content_pipeline_items','sponsorship_deals','talent_onboarding_items'] LOOP
    EXECUTE format('CREATE POLICY %I_org_read ON public.%I FOR SELECT TO authenticated USING (organization_id = private.current_org_id())', t, t);
    EXECUTE format('CREATE POLICY %I_org_write ON public.%I FOR ALL TO authenticated USING (organization_id = private.current_org_id() AND private.has_role(ARRAY[''owner'',''admin'',''manager'']::public.app_role[])) WITH CHECK (organization_id = private.current_org_id() AND private.has_role(ARRAY[''owner'',''admin'',''manager'']::public.app_role[]))', t, t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.seed_talent_onboarding(p_talent_id uuid, p_org_id uuid DEFAULT '00000000-0000-0000-0000-000000000001')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inserted int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.talent_onboarding_items WHERE talent_id = p_talent_id) THEN
    INSERT INTO public.talent_onboarding_items (organization_id, talent_id, title, description, position)
    VALUES
      (p_org_id, p_talent_id, 'Contrato firmado', 'Contrato de representación archivado en Documentos', 1),
      (p_org_id, p_talent_id, 'Perfil Twitch verificado', 'Canal vinculado y métricas Helix activas', 2),
      (p_org_id, p_talent_id, 'Brand book entregado', 'Guías de marca y tono compartidas', 3),
      (p_org_id, p_talent_id, 'Calendario de contenido', 'Primera planificación de streams y clips', 4),
      (p_org_id, p_talent_id, 'Setup técnico', 'OBS, overlays configurados', 5),
      (p_org_id, p_talent_id, 'Redes sociales', 'Handles y bios alineadas con NeuraLive', 6);
    GET DIAGNOSTICS inserted = ROW_COUNT;
  END IF;
  RETURN inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_talent_onboarding(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_talent_onboarding(uuid, uuid) TO service_role;
