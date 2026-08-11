-- Drive creativo / Diseño gráfico: carpetas + archivos en Storage

CREATE TABLE IF NOT EXISTS public.creative_drive_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  parent_id uuid REFERENCES public.creative_drive_items(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  path text NOT NULL DEFAULT '/',
  kind text NOT NULL CHECK (kind IN ('folder', 'file')),
  mime_type text,
  size_bytes bigint,
  storage_bucket text,
  storage_path text,
  created_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (
    (kind = 'folder' AND storage_path IS NULL)
    OR (kind = 'file' AND storage_path IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS creative_drive_items_sibling_name_uidx
  ON public.creative_drive_items (organization_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS creative_drive_items_parent_idx
  ON public.creative_drive_items (organization_id, parent_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS creative_drive_items_created_by_idx
  ON public.creative_drive_items (created_by)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS creative_drive_items_touch ON public.creative_drive_items;
CREATE TRIGGER creative_drive_items_touch
  BEFORE UPDATE ON public.creative_drive_items
  FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

CREATE OR REPLACE FUNCTION public.creative_drive_set_created_by()
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

DROP TRIGGER IF EXISTS creative_drive_set_created_by ON public.creative_drive_items;
CREATE TRIGGER creative_drive_set_created_by
  BEFORE INSERT ON public.creative_drive_items
  FOR EACH ROW
  EXECUTE FUNCTION public.creative_drive_set_created_by();

ALTER TABLE public.creative_drive_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS creative_drive_items_org_read ON public.creative_drive_items;
CREATE POLICY creative_drive_items_org_read ON public.creative_drive_items
  FOR SELECT TO authenticated
  USING (organization_id = private.current_org_id());

DROP POLICY IF EXISTS creative_drive_items_org_write ON public.creative_drive_items;
CREATE POLICY creative_drive_items_org_write ON public.creative_drive_items
  FOR ALL TO authenticated
  USING (
    organization_id = private.current_org_id()
    AND private.has_role(ARRAY['owner','admin','manager']::public.app_role[])
  )
  WITH CHECK (
    organization_id = private.current_org_id()
    AND private.has_role(ARRAY['owner','admin','manager']::public.app_role[])
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'creative-drive',
  'creative-drive',
  false,
  104857600,
  ARRAY[
    'image/jpeg','image/png','image/webp','image/gif','image/svg+xml',
    'application/pdf','application/zip','application/x-zip-compressed',
    'application/octet-stream','text/plain','video/mp4','video/webm'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS creative_drive_storage_read ON storage.objects;
CREATE POLICY creative_drive_storage_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'creative-drive'
    AND (storage.foldername(name))[1] = private.current_org_id()::text
  );

DROP POLICY IF EXISTS creative_drive_storage_insert ON storage.objects;
CREATE POLICY creative_drive_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'creative-drive'
    AND (storage.foldername(name))[1] = private.current_org_id()::text
    AND private.has_role(ARRAY['owner','admin','manager']::public.app_role[])
  );

DROP POLICY IF EXISTS creative_drive_storage_update ON storage.objects;
CREATE POLICY creative_drive_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'creative-drive'
    AND (storage.foldername(name))[1] = private.current_org_id()::text
    AND private.has_role(ARRAY['owner','admin','manager']::public.app_role[])
  )
  WITH CHECK (
    bucket_id = 'creative-drive'
    AND (storage.foldername(name))[1] = private.current_org_id()::text
    AND private.has_role(ARRAY['owner','admin','manager']::public.app_role[])
  );

DROP POLICY IF EXISTS creative_drive_storage_delete ON storage.objects;
CREATE POLICY creative_drive_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'creative-drive'
    AND (storage.foldername(name))[1] = private.current_org_id()::text
    AND private.has_role(ARRAY['owner','admin','manager']::public.app_role[])
  );
