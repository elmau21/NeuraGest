-- NeuraGest: enum assistant (aplicar antes de seed / has_role)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'assistant';
