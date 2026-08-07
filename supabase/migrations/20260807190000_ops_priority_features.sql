-- NeuraGest ops priority: restricciones marca, comisiones

CREATE TYPE public.brand_restriction_kind AS ENUM ('exclusivity', 'blackout');

CREATE TABLE public.talent_brand_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  talent_id uuid NOT NULL REFERENCES public.talents(id) ON DELETE CASCADE,
  kind public.brand_restriction_kind NOT NULL,
  brand_name text NOT NULL CHECK (length(trim(brand_name)) > 0),
  blocked_categories text[] NOT NULL DEFAULT '{}',
  starts_at date,
  ends_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX talent_brand_restrictions_org_idx
  ON public.talent_brand_restrictions (organization_id)
  WHERE deleted_at IS NULL;
CREATE INDEX talent_brand_restrictions_talent_idx
  ON public.talent_brand_restrictions (talent_id, starts_at, ends_at)
  WHERE deleted_at IS NULL;

CREATE TABLE public.commission_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  deal_id uuid REFERENCES public.sponsorship_deals(id) ON DELETE SET NULL,
  talent_id uuid REFERENCES public.talents(id) ON DELETE SET NULL,
  label text NOT NULL CHECK (length(trim(label)) > 0),
  period_month date NOT NULL,
  gross_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (gross_amount >= 0),
  agency_rate_pct numeric(5,2) NOT NULL DEFAULT 20
    CHECK (agency_rate_pct >= 0 AND agency_rate_pct <= 100),
  agency_amount numeric(14,2) GENERATED ALWAYS AS (round(gross_amount * agency_rate_pct / 100, 2)) STORED,
  talent_amount numeric(14,2) GENERATED ALWAYS AS (round(gross_amount * (100 - agency_rate_pct) / 100, 2)) STORED,
  status text NOT NULL DEFAULT 'forecast'
    CHECK (status IN ('forecast', 'accrued', 'paid')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX commission_entries_org_month_idx
  ON public.commission_entries (organization_id, period_month DESC)
  WHERE deleted_at IS NULL;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['talent_brand_restrictions','commission_entries'] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I_touch BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at()',
      t, t
    );
  END LOOP;
END $$;

ALTER TABLE public.talent_brand_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_entries ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['talent_brand_restrictions','commission_entries'] LOOP
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
