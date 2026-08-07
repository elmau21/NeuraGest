-- Vincula identidad Twitch (app_users) con Supabase Auth (auth.users)
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS app_users_auth_user_id_idx ON public.app_users(auth_user_id);

COMMENT ON COLUMN public.app_users.auth_user_id IS 'UUID en auth.users creado vía Admin API tras login Twitch';
