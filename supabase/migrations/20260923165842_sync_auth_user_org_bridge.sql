-- Bridge durable: auth.users ↔ app_users ↔ public.users (+ user_roles espejo)
-- Sin public.users, private.current_org_id() es NULL y RLS oculta contratos/ops.

CREATE OR REPLACE FUNCTION public.sync_auth_user_from_app(
  p_auth_user_id uuid,
  p_org_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_app_id uuid;
  v_org_id uuid;
  v_display_name text;
  v_avatar_url text;
  v_login text;
  v_caller uuid := auth.uid();
BEGIN
  IF p_auth_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Solo el propio usuario autenticado, o llamadas service_role / triggers (uid nulo).
  IF v_caller IS NOT NULL AND v_caller IS DISTINCT FROM p_auth_user_id THEN
    RAISE EXCEPTION 'sync_auth_user_from_app: forbidden';
  END IF;

  SELECT au.id, au.organization_id, au.display_name, au.avatar_url
  INTO v_app_id, v_org_id, v_display_name, v_avatar_url
  FROM public.app_users au
  WHERE au.auth_user_id = p_auth_user_id
  LIMIT 1;

  IF v_app_id IS NULL THEN
    SELECT lower(replace(coalesce(
      nullif(trim(u.raw_user_meta_data->>'preferred_username'), ''),
      nullif(trim(u.raw_user_meta_data->>'user_name'), ''),
      nullif(trim(u.raw_user_meta_data->>'login'), ''),
      nullif(trim(u.raw_user_meta_data->>'nickname'), ''),
      nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(u.raw_user_meta_data->>'name'), '')
    ), '@', ''))
    INTO v_login
    FROM auth.users u
    WHERE u.id = p_auth_user_id;

    IF v_login IS NOT NULL AND length(v_login) > 0 THEN
      SELECT au.id, au.organization_id, au.display_name, au.avatar_url
      INTO v_app_id, v_org_id, v_display_name, v_avatar_url
      FROM public.app_users au
      WHERE lower(au.twitch_login) = v_login
      LIMIT 1;

      IF v_app_id IS NOT NULL THEN
        UPDATE public.app_users
        SET auth_user_id = p_auth_user_id,
            updated_at = now()
        WHERE id = v_app_id
          AND (auth_user_id IS NULL OR auth_user_id = p_auth_user_id)
          AND NOT EXISTS (
            SELECT 1 FROM public.app_users other
            WHERE other.auth_user_id = p_auth_user_id
              AND other.id IS DISTINCT FROM v_app_id
          );
      END IF;
    END IF;
  END IF;

  IF v_app_id IS NULL THEN
    RETURN;
  END IF;

  -- Confirmar vínculo actual
  IF NOT EXISTS (
    SELECT 1 FROM public.app_users
    WHERE id = v_app_id AND auth_user_id = p_auth_user_id
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.users (id, organization_id, display_name, avatar_url)
  VALUES (
    p_auth_user_id,
    coalesce(v_org_id, p_org_id),
    v_display_name,
    v_avatar_url
  )
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    display_name = COALESCE(EXCLUDED.display_name, public.users.display_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
    deleted_at = NULL,
    updated_at = now();

  -- Espejo estricto de app_user_roles (no inventa roles)
  DELETE FROM public.user_roles ur
  WHERE ur.user_id = p_auth_user_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.app_user_roles aur
      WHERE aur.app_user_id = v_app_id
        AND aur.role_id = ur.role_id
    );

  INSERT INTO public.user_roles (user_id, role_id)
  SELECT p_auth_user_id, aur.role_id
  FROM public.app_user_roles aur
  WHERE aur.app_user_id = v_app_id
  ON CONFLICT DO NOTHING;
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_auth_user_from_app(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_auth_user_from_app(uuid, uuid)
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.trg_app_users_sync_org_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.auth_user_id IS NOT NULL THEN
    PERFORM public.sync_auth_user_from_app(NEW.auth_user_id, NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS app_users_sync_org_membership ON public.app_users;
CREATE TRIGGER app_users_sync_org_membership
AFTER INSERT OR UPDATE OF auth_user_id, display_name, avatar_url, organization_id
ON public.app_users
FOR EACH ROW
WHEN (NEW.auth_user_id IS NOT NULL)
EXECUTE FUNCTION private.trg_app_users_sync_org_membership();

CREATE OR REPLACE FUNCTION private.trg_app_user_roles_sync_org_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_app_user_id uuid := COALESCE(NEW.app_user_id, OLD.app_user_id);
  v_auth_user_id uuid;
BEGIN
  SELECT au.auth_user_id INTO v_auth_user_id
  FROM public.app_users au
  WHERE au.id = v_app_user_id;

  IF v_auth_user_id IS NOT NULL THEN
    PERFORM public.sync_auth_user_from_app(v_auth_user_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS app_user_roles_sync_org_membership ON public.app_user_roles;
CREATE TRIGGER app_user_roles_sync_org_membership
AFTER INSERT OR UPDATE OR DELETE
ON public.app_user_roles
FOR EACH ROW
EXECUTE FUNCTION private.trg_app_user_roles_sync_org_membership();

-- Backfill: enlazar auth.users existentes con match único por login de metadata
WITH candidates AS (
  SELECT
    au.id AS app_id,
    u.id AS auth_id,
    count(*) OVER (PARTITION BY au.id) AS matches_for_app,
    count(*) OVER (PARTITION BY u.id) AS matches_for_auth
  FROM public.app_users au
  JOIN auth.users u ON lower(replace(coalesce(
    nullif(trim(u.raw_user_meta_data->>'preferred_username'), ''),
    nullif(trim(u.raw_user_meta_data->>'user_name'), ''),
    nullif(trim(u.raw_user_meta_data->>'login'), ''),
    nullif(trim(u.raw_user_meta_data->>'nickname'), ''),
    nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(u.raw_user_meta_data->>'name'), '')
  ), '@', '')) = lower(au.twitch_login)
  WHERE au.auth_user_id IS NULL
),
unique_matches AS (
  SELECT app_id, auth_id
  FROM candidates
  WHERE matches_for_app = 1
    AND matches_for_auth = 1
)
UPDATE public.app_users au
SET auth_user_id = um.auth_id,
    updated_at = now()
FROM unique_matches um
WHERE au.id = um.app_id
  AND au.auth_user_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.app_users other
    WHERE other.auth_user_id = um.auth_id
  );

-- Sincronizar todos los ya vinculados (crea public.users + espejo de roles)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT auth_user_id
    FROM public.app_users
    WHERE auth_user_id IS NOT NULL
  LOOP
    PERFORM public.sync_auth_user_from_app(r.auth_user_id);
  END LOOP;
END $$;
