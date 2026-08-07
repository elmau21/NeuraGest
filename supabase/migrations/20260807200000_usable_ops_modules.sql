-- NeuraGest usable ops: rate cards, briefs, assets, handoffs

CREATE TYPE public.rate_card_category AS ENUM ('stream', 'clip', 'integration', 'package', 'other');
CREATE TYPE public.handoff_status AS ENUM ('pending', 'acknowledged', 'completed');

CREATE TABLE public.talent_rate_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  talent_id uuid NOT NULL REFERENCES public.talents(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (length(trim(label)) > 0),
  category public.rate_card_category NOT NULL DEFAULT 'other',
  unit_price numeric(14,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  currency text NOT NULL DEFAULT 'MXN',
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX talent_rate_cards_talent_idx
  ON public.talent_rate_cards (talent_id, position)
  WHERE deleted_at IS NULL;

CREATE TABLE public.campaign_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  deal_id uuid REFERENCES public.sponsorship_deals(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (length(trim(title)) > 0),
  brand_name text,
  talent_ids uuid[] NOT NULL DEFAULT '{}',
  objectives text,
  deliverables text,
  start_date date,
  end_date date,
  kpi_notes text,
  timeline_notes text,
  extra_notes text,
  created_by uuid REFERENCES public.app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX campaign_briefs_deal_idx
  ON public.campaign_briefs (deal_id)
  WHERE deleted_at IS NULL;

CREATE TABLE public.agency_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  description text,
  storage_bucket text,
  storage_path text,
  file_name text,
  mime_type text,
  size_bytes bigint,
  tags text[] NOT NULL DEFAULT '{}',
  external_url text,
  talent_id uuid REFERENCES public.talents(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.sponsorship_deals(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (storage_path IS NOT NULL OR external_url IS NOT NULL)
);

CREATE INDEX agency_assets_org_tags_idx
  ON public.agency_assets USING gin (tags)
  WHERE deleted_at IS NULL;

CREATE TABLE public.shift_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  from_manager_id uuid NOT NULL REFERENCES public.app_users(id),
  to_manager_id uuid NOT NULL REFERENCES public.app_users(id),
  talent_ids uuid[] NOT NULL DEFAULT '{}',
  open_items_summary text,
  notes text,
  status public.handoff_status NOT NULL DEFAULT 'pending',
  handoff_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shift_handoffs_status_idx
  ON public.shift_handoffs (organization_id, status, handoff_at DESC);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'agency-assets',
  'agency-assets',
  false,
  104857600,
  ARRAY[
    'image/jpeg','image/png','image/webp','image/gif','image/svg+xml',
    'application/pdf','video/mp4','video/webm',
    'application/zip','text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['talent_rate_cards','campaign_briefs','agency_assets','shift_handoffs'] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I_touch BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at()',
      t, t
    );
  END LOOP;
END $$;

ALTER TABLE public.talent_rate_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_handoffs ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['talent_rate_cards','campaign_briefs','agency_assets','shift_handoffs'] LOOP
    EXECUTE format(
      'CREATE POLICY %I_org_read ON public.%I FOR SELECT TO authenticated USING (organization_id = private.current_org_id())',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY %I_org_write ON public.%I FOR ALL TO authenticated USING (organization_id = private.current_org_id() AND private.has_role(ARRAY[''owner'',''admin'',''manager'']::public.app_role[])) WITH CHECK (organization_id = private.current_org_id() AND private.has_role(ARRAY[''owner'',''admin'',''manager'']::public.app_role[]))',
      t, t
    );
  END LOOP;
END $$;

CREATE POLICY agency_assets_storage_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'agency-assets' AND (storage.foldername(name))[1] = private.current_org_id()::text);

CREATE POLICY agency_assets_storage_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'agency-assets' AND (storage.foldername(name))[1] = private.current_org_id()::text);

CREATE POLICY agency_assets_storage_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'agency-assets' AND (storage.foldername(name))[1] = private.current_org_id()::text)
  WITH CHECK (bucket_id = 'agency-assets' AND (storage.foldername(name))[1] = private.current_org_id()::text);

CREATE POLICY agency_assets_storage_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'agency-assets' AND (storage.foldername(name))[1] = private.current_org_id()::text);
