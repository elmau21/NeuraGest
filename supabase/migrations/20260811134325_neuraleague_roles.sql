-- Roles de NeuraLeague (enum). Seed + RLS en migración siguiente.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'league_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coach';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'analyst';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'player';
