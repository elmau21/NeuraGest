-- Resuelve nombres de actor para auditoría sin exponer app_users al cliente.
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
