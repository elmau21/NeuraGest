-- Carpetas en Document Drive: solo owner, manager (director de esports) y assistant.
-- Archivos y demás mutaciones siguen con la política operativa existente.

DROP POLICY IF EXISTS documents_org_write ON public.documents;
CREATE POLICY documents_org_write ON public.documents
  FOR ALL TO authenticated
  USING (
    organization_id = private.current_org_id()
    AND private.has_role(ARRAY['owner','admin','manager','assistant']::public.app_role[])
  )
  WITH CHECK (
    organization_id = private.current_org_id()
    AND (
      (
        kind IS DISTINCT FROM 'folder'
        AND private.has_role(ARRAY['owner','admin','manager','assistant']::public.app_role[])
      )
      OR (
        kind = 'folder'
        AND private.has_role(ARRAY['owner','manager','assistant']::public.app_role[])
      )
    )
  );
