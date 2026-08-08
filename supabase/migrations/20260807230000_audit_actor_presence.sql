-- Auditoría: versiona log_activity + rellena created_by en documentos nuevos.
-- Presence usa Realtime Presence (efímero); canal neuragest-presence:{org_id}.
-- Solo miembros autenticados de la org tienen JWT con current_org_id().

CREATE OR REPLACE FUNCTION public.log_activity(
  p_entity_type text,
  p_entity_id uuid DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_id bigint;
  v_org uuid;
BEGIN
  v_org := private.current_org_id();
  IF v_org IS NULL OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado o sin organización';
  END IF;

  INSERT INTO public.activity_logs (
    organization_id, actor_id, entity_type, entity_id, action, metadata
  )
  VALUES (
    v_org,
    auth.uid(),
    p_entity_type,
    p_entity_id,
    p_action,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_activity(text, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_activity(text, uuid, text, jsonb) TO authenticated;

-- Actor labels (idempotente con migración anterior).
CREATE OR REPLACE FUNCTION public.lookup_activity_actors(p_ids uuid[])
RETURNS TABLE (
  auth_user_id uuid,
  display_name text,
  twitch_login text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT
    x.uid AS auth_user_id,
    COALESCE(
      NULLIF(TRIM(au.display_name), ''),
      NULLIF(TRIM(u.display_name), ''),
      NULLIF(TRIM(au.twitch_login), '')
    ) AS display_name,
    au.twitch_login
  FROM unnest(COALESCE(p_ids, ARRAY[]::uuid[])) AS x(uid)
  LEFT JOIN public.users u ON u.id = x.uid AND u.deleted_at IS NULL
  LEFT JOIN public.app_users au ON au.auth_user_id = x.uid;
$$;

REVOKE ALL ON FUNCTION public.lookup_activity_actors(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_activity_actors(uuid[]) TO authenticated;

-- Rellena created_by en inserts de documents si viene vacío.
CREATE OR REPLACE FUNCTION public.documents_set_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NEW.created_by IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS documents_set_created_by ON public.documents;
CREATE TRIGGER documents_set_created_by
  BEFORE INSERT ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.documents_set_created_by();
