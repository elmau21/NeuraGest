-- Notas del día: solo la pareja owner ↔ asistente (+ admin con selector).
-- Antes, cualquier rol owner podía leer/escribir notas de otros owners.

CREATE OR REPLACE FUNCTION private.can_access_owner_day_note(
  p_owner_user_id uuid,
  p_assistant_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT
    p_owner_user_id = auth.uid()
    OR p_assistant_user_id = auth.uid()
    OR private.has_role(ARRAY['admin']::public.app_role[]);
$$;
