-- Drive de documentos: carpetas Contratos / Directivas / Extras sobre public.documents

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS kind text CHECK (kind IS NULL OR kind IN ('folder', 'file')),
  ADD COLUMN IF NOT EXISTS path text NOT NULL DEFAULT '/';

ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_kind_storage_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_kind_storage_check CHECK (
  kind IS NULL
  OR (kind = 'folder' AND storage_path IS NULL)
  OR (kind = 'file' AND storage_path IS NOT NULL)
);

UPDATE public.documents
SET kind = 'file',
    path = CASE
      WHEN category = 'Contratos' THEN '/Contratos/' || COALESCE(file_name, title)
      WHEN category = 'Directivas' THEN '/Directivas/' || COALESCE(file_name, title)
      WHEN category = 'Extras' THEN '/Extras/' || COALESCE(file_name, title)
      ELSE path
    END
WHERE kind IS NULL
  AND category IN ('Contratos', 'Directivas', 'Extras')
  AND storage_path IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS documents_drive_sibling_name_uidx
  ON public.documents (
    organization_id,
    category,
    COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(title)
  )
  WHERE deleted_at IS NULL
    AND kind IS NOT NULL
    AND category IN ('Contratos', 'Directivas', 'Extras');

CREATE INDEX IF NOT EXISTS documents_drive_parent_idx
  ON public.documents (organization_id, category, parent_id)
  WHERE deleted_at IS NULL AND kind IS NOT NULL;

-- Bucket org-documents: Directivas y Extras (Contratos sigue en bucket contratos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'org-documents',
  'org-documents',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'text/plain',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Lectura: todos los miembros de la org pueden ver el drive (incl. Contratos)
DROP POLICY IF EXISTS documents_org_read ON public.documents;
CREATE POLICY documents_org_read ON public.documents
  FOR SELECT TO authenticated
  USING (
    organization_id = private.current_org_id()
    AND (
      category = 'wiki'
      OR kind IS NOT NULL
      OR private.has_role(ARRAY['owner','admin','manager','assistant']::public.app_role[])
    )
  );

DROP POLICY IF EXISTS documents_org_write ON public.documents;
CREATE POLICY documents_org_write ON public.documents
  FOR ALL TO authenticated
  USING (
    organization_id = private.current_org_id()
    AND private.has_role(ARRAY['owner','admin','manager','assistant']::public.app_role[])
  )
  WITH CHECK (
    organization_id = private.current_org_id()
    AND private.has_role(ARRAY['owner','admin','manager','assistant']::public.app_role[])
  );

-- Storage: lectura para toda la org, escritura para roles operativos
DROP POLICY IF EXISTS contratos_storage_read ON storage.objects;
CREATE POLICY contratos_storage_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'contratos');

DROP POLICY IF EXISTS contratos_storage_insert ON storage.objects;
CREATE POLICY contratos_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'contratos'
    AND private.has_role(ARRAY['owner','admin','manager','assistant']::public.app_role[])
  );

DROP POLICY IF EXISTS contratos_storage_update ON storage.objects;
CREATE POLICY contratos_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'contratos'
    AND private.has_role(ARRAY['owner','admin','manager','assistant']::public.app_role[])
  )
  WITH CHECK (
    bucket_id = 'contratos'
    AND private.has_role(ARRAY['owner','admin','manager','assistant']::public.app_role[])
  );

DROP POLICY IF EXISTS contratos_storage_delete ON storage.objects;
CREATE POLICY contratos_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'contratos'
    AND private.has_role(ARRAY['owner','admin','manager','assistant']::public.app_role[])
  );

DROP POLICY IF EXISTS org_documents_storage_read ON storage.objects;
CREATE POLICY org_documents_storage_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'org-documents'
    AND (storage.foldername(name))[1] = private.current_org_id()::text
  );

DROP POLICY IF EXISTS org_documents_storage_insert ON storage.objects;
CREATE POLICY org_documents_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'org-documents'
    AND (storage.foldername(name))[1] = private.current_org_id()::text
    AND private.has_role(ARRAY['owner','admin','manager','assistant']::public.app_role[])
  );

DROP POLICY IF EXISTS org_documents_storage_update ON storage.objects;
CREATE POLICY org_documents_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'org-documents'
    AND (storage.foldername(name))[1] = private.current_org_id()::text
    AND private.has_role(ARRAY['owner','admin','manager','assistant']::public.app_role[])
  )
  WITH CHECK (
    bucket_id = 'org-documents'
    AND (storage.foldername(name))[1] = private.current_org_id()::text
    AND private.has_role(ARRAY['owner','admin','manager','assistant']::public.app_role[])
  );

DROP POLICY IF EXISTS org_documents_storage_delete ON storage.objects;
CREATE POLICY org_documents_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'org-documents'
    AND (storage.foldername(name))[1] = private.current_org_id()::text
    AND private.has_role(ARRAY['owner','admin','manager','assistant']::public.app_role[])
  );
