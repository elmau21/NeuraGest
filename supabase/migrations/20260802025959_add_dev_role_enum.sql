-- NeuraGest: enum dev (aplicar antes de app_users_permissions)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'dev';
