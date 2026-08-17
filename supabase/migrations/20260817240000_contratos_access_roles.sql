-- Contratos: solo owner, manager (director de esports) y assistant.
-- Admin, dev y demás roles no pueden leer ni escribir en la categoría Contratos ni en el bucket contratos.

DROP POLICY IF EXISTS documents_org_read ON public.documents;
CREATE POLICY documents_org_read ON public.documents
  FOR SELECT TO authenticated
  USING (
    organization_id = private.current_org_id()
    AND (
      category = 'wiki'
      OR (
        kind IS NOT NULL
        AND category IS DISTINCT FROM 'Contratos'
      )
      OR (
        category = 'Contratos'
        AND private.has_role(ARRAY['owner','manager','assistant']::public.app_role[])
      )
      OR (
        kind IS NULL
        AND category IS DISTINCT FROM 'Contratos'
        AND private.has_role(ARRAY['owner','admin','manager','assistant']::public.app_role[])
      )
    )
  );

DROP POLICY IF EXISTS documents_org_write ON public.documents;
CREATE POLICY documents_org_write ON public.documents
  FOR ALL TO authenticated
  USING (
    organization_id = private.current_org_id()
    AND private.has_role(ARRAY['owner','admin','manager','assistant']::public.app_role[])
    AND (
      category IS DISTINCT FROM 'Contratos'
      OR private.has_role(ARRAY['owner','manager','assistant']::public.app_role[])
    )
  )
  WITH CHECK (
    organization_id = private.current_org_id()
    AND (
      (
        kind IS DISTINCT FROM 'folder'
        AND private.has_role(ARRAY['owner','admin','manager','assistant']::public.app_role[])
        AND (
          category IS DISTINCT FROM 'Contratos'
          OR private.has_role(ARRAY['owner','manager','assistant']::public.app_role[])
        )
      )
      OR (
        kind = 'folder'
        AND private.has_role(ARRAY['owner','manager','assistant']::public.app_role[])
      )
    )
  );

DROP POLICY IF EXISTS contratos_storage_read ON storage.objects;
CREATE POLICY contratos_storage_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'contratos'
    AND private.has_role(ARRAY['owner','manager','assistant']::public.app_role[])
  );

DROP POLICY IF EXISTS contratos_storage_insert ON storage.objects;
CREATE POLICY contratos_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'contratos'
    AND private.has_role(ARRAY['owner','manager','assistant']::public.app_role[])
  );

DROP POLICY IF EXISTS contratos_storage_update ON storage.objects;
CREATE POLICY contratos_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'contratos'
    AND private.has_role(ARRAY['owner','manager','assistant']::public.app_role[])
  )
  WITH CHECK (
    bucket_id = 'contratos'
    AND private.has_role(ARRAY['owner','manager','assistant']::public.app_role[])
  );

DROP POLICY IF EXISTS contratos_storage_delete ON storage.objects;
CREATE POLICY contratos_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'contratos'
    AND private.has_role(ARRAY['owner','manager','assistant']::public.app_role[])
  );
