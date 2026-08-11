-- Rol diseñador: seed + RLS Drive / briefs

INSERT INTO public.roles (name, permissions)
VALUES ('designer', '{"war_room":true,"design":true}'::jsonb)
ON CONFLICT (name) DO NOTHING;

DROP POLICY IF EXISTS creative_drive_items_org_write ON public.creative_drive_items;
CREATE POLICY creative_drive_items_org_write ON public.creative_drive_items
  FOR ALL TO authenticated
  USING (
    organization_id = private.current_org_id()
    AND private.has_role(ARRAY['owner','admin','manager','designer']::public.app_role[])
  )
  WITH CHECK (
    organization_id = private.current_org_id()
    AND private.has_role(ARRAY['owner','admin','manager','designer']::public.app_role[])
  );

DROP POLICY IF EXISTS creative_drive_storage_insert ON storage.objects;
CREATE POLICY creative_drive_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'creative-drive'
    AND (storage.foldername(name))[1] = private.current_org_id()::text
    AND private.has_role(ARRAY['owner','admin','manager','designer']::public.app_role[])
  );

DROP POLICY IF EXISTS creative_drive_storage_update ON storage.objects;
CREATE POLICY creative_drive_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'creative-drive'
    AND (storage.foldername(name))[1] = private.current_org_id()::text
    AND private.has_role(ARRAY['owner','admin','manager','designer']::public.app_role[])
  )
  WITH CHECK (
    bucket_id = 'creative-drive'
    AND (storage.foldername(name))[1] = private.current_org_id()::text
    AND private.has_role(ARRAY['owner','admin','manager','designer']::public.app_role[])
  );

DROP POLICY IF EXISTS creative_drive_storage_delete ON storage.objects;
CREATE POLICY creative_drive_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'creative-drive'
    AND (storage.foldername(name))[1] = private.current_org_id()::text
    AND private.has_role(ARRAY['owner','admin','manager','designer']::public.app_role[])
  );

DROP POLICY IF EXISTS design_briefs_org_write ON public.design_briefs;
CREATE POLICY design_briefs_org_write ON public.design_briefs
  FOR ALL TO authenticated
  USING (
    organization_id = private.current_org_id()
    AND private.has_role(ARRAY['owner','admin','manager','designer']::public.app_role[])
  )
  WITH CHECK (
    organization_id = private.current_org_id()
    AND private.has_role(ARRAY['owner','admin','manager','designer']::public.app_role[])
  );
