-- Campos extra para panel de tareas de asistentes + storage RLS

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES public.users(id);

COMMENT ON COLUMN public.tasks.category IS 'Categoría amigable para el panel de asistentes';
COMMENT ON COLUMN public.tasks.assigned_by IS 'Usuario que asignó la tarea';

CREATE INDEX IF NOT EXISTS tasks_org_category_idx
  ON public.tasks (organization_id, category)
  WHERE deleted_at IS NULL;

-- Storage: adjuntos de tareas (lectura/escritura operativa; assistant hereda manager vía has_role)
DROP POLICY IF EXISTS task_attachments_storage_read ON storage.objects;
CREATE POLICY task_attachments_storage_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND (storage.foldername(name))[1] = private.current_org_id()::text
  );

DROP POLICY IF EXISTS task_attachments_storage_insert ON storage.objects;
CREATE POLICY task_attachments_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'task-attachments'
    AND (storage.foldername(name))[1] = private.current_org_id()::text
    AND private.has_role(ARRAY['owner','admin','manager','assistant','dev']::public.app_role[])
  );

DROP POLICY IF EXISTS task_attachments_storage_update ON storage.objects;
CREATE POLICY task_attachments_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND (storage.foldername(name))[1] = private.current_org_id()::text
    AND private.has_role(ARRAY['owner','admin','manager','assistant','dev']::public.app_role[])
  )
  WITH CHECK (
    bucket_id = 'task-attachments'
    AND (storage.foldername(name))[1] = private.current_org_id()::text
  );

DROP POLICY IF EXISTS task_attachments_storage_delete ON storage.objects;
CREATE POLICY task_attachments_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND (storage.foldername(name))[1] = private.current_org_id()::text
    AND private.has_role(ARRAY['owner','admin','manager','assistant','dev']::public.app_role[])
  );
