-- Rol Asistente: seed + has_role trata assistant como manager operativo

INSERT INTO public.roles (name, permissions)
VALUES (
  'assistant',
  '{"full_nav":true,"mutate":true,"control_center":true,"manage_roles":true,"assign_owner":false}'::jsonb
)
ON CONFLICT (name) DO NOTHING;

-- Assistant hereda el acceso de escritura/lectura que ya incluye `manager`
-- (ops, diseño con manager, NeuraLeague nl_can_*, etc.), sin tocar policies owner/admin-only.
CREATE OR REPLACE FUNCTION private.has_role(allowed public.app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND (
        r.name = ANY(allowed)
        OR (
          r.name = 'assistant'::public.app_role
          AND 'manager'::public.app_role = ANY(allowed)
        )
      )
  ) OR EXISTS (
    SELECT 1 FROM public.app_users au
    JOIN public.app_user_roles aur ON aur.app_user_id = au.id
    JOIN public.roles r ON r.id = aur.role_id
    WHERE au.auth_user_id = auth.uid()
      AND (
        r.name = ANY(allowed)
        OR (
          r.name = 'assistant'::public.app_role
          AND 'manager'::public.app_role = ANY(allowed)
        )
      )
  );
$$;

-- Lectura/escritura NeuraLeague: assistant como manager
CREATE OR REPLACE FUNCTION private.nl_can_read()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT private.has_role(ARRAY[
    'owner','admin','manager','staff','dev','assistant',
    'league_manager','coach','analyst','player'
  ]::public.app_role[]);
$$;

CREATE OR REPLACE FUNCTION private.nl_can_write()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT private.has_role(ARRAY[
    'owner','admin','manager','assistant','league_manager','coach','analyst'
  ]::public.app_role[]);
$$;
