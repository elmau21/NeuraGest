-- Bridge Twitch → identidad app + rol dev + seed MauFuwari
CREATE TABLE IF NOT EXISTS public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001',
  twitch_user_id text,
  twitch_login text NOT NULL,
  display_name text,
  avatar_url text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_users_twitch_login_unique UNIQUE (twitch_login),
  CONSTRAINT app_users_twitch_user_id_unique UNIQUE (twitch_user_id)
);

CREATE TABLE IF NOT EXISTS public.app_user_roles (
  app_user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES public.app_users(id),
  PRIMARY KEY (app_user_id, role_id)
);

INSERT INTO public.roles (name, permissions)
VALUES ('dev', '{"admin_panel":true,"technical":true}'::jsonb)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.app_users (organization_id, twitch_login, display_name)
VALUES ('00000000-0000-0000-0000-000000000001', 'maufuwari', 'MauFuwari')
ON CONFLICT (twitch_login) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now();

INSERT INTO public.app_user_roles (app_user_id, role_id)
SELECT au.id, r.id
FROM public.app_users au
CROSS JOIN public.roles r
WHERE lower(au.twitch_login) = 'maufuwari' AND r.name IN ('owner', 'dev')
ON CONFLICT DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'app_users_touch') THEN
    CREATE TRIGGER app_users_touch BEFORE UPDATE ON public.app_users
    FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
  END IF;
END $$;

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_users_deny_client ON public.app_users FOR ALL TO anon, authenticated USING (false);
CREATE POLICY app_user_roles_deny_client ON public.app_user_roles FOR ALL TO anon, authenticated USING (false);

CREATE OR REPLACE FUNCTION public.health_ping()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'ok', true,
    'server_time', now(),
    'roles_count', (SELECT count(*)::int FROM public.roles),
    'talents_count', (SELECT count(*)::int FROM public.talents WHERE deleted_at IS NULL),
    'app_users_count', (SELECT count(*)::int FROM public.app_users)
  );
$$;

GRANT EXECUTE ON FUNCTION public.health_ping() TO anon, authenticated;
