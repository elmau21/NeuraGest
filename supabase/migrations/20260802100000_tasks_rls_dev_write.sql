-- Permitir rol dev en escritura de tareas (alineado con canMutate en frontend)
DROP POLICY IF EXISTS tasks_org_write ON public.tasks;
CREATE POLICY tasks_org_write ON public.tasks
  FOR ALL TO authenticated
  USING (
    organization_id = private.current_org_id()
    AND private.has_role(ARRAY['owner','admin','manager','dev']::public.app_role[])
  )
  WITH CHECK (
    organization_id = private.current_org_id()
    AND private.has_role(ARRAY['owner','admin','manager','dev']::public.app_role[])
  );
