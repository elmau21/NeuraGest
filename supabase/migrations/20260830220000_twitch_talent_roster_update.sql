-- Renombrar kumitacui → lakumita y agregar nuevos talentos al roster NeuraLive
UPDATE public.talents
SET login = 'lakumita', display_name = 'Lakumita', updated_at = now()
WHERE organization_id = '00000000-0000-0000-0000-000000000001'
  AND login = 'kumitacui';

UPDATE public.design_gap_ignores
SET talent_login = 'lakumita', updated_at = now()
WHERE organization_id = '00000000-0000-0000-0000-000000000001'
  AND talent_login = 'kumitacui';

UPDATE public.design_gap_resolutions
SET talent_login = 'lakumita', updated_at = now()
WHERE organization_id = '00000000-0000-0000-0000-000000000001'
  AND talent_login = 'kumitacui';

UPDATE public.design_briefs
SET talent_login = 'lakumita', updated_at = now()
WHERE talent_login = 'kumitacui';

UPDATE public.metric_snapshots
SET login = 'lakumita'
WHERE login = 'kumitacui';

UPDATE public.stream_events
SET login = 'lakumita'
WHERE login = 'kumitacui';

UPDATE public.twitchtracker_snapshots
SET login = 'lakumita'
WHERE login = 'kumitacui';

UPDATE public.ops_coverage
SET login = 'lakumita', updated_at = now()
WHERE login = 'kumitacui';

INSERT INTO public.talents (organization_id, login, display_name, description)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'shirookouwu', 'Shirookouwu', 'Talento NeuraLive'),
  ('00000000-0000-0000-0000-000000000001', 'creeperdutyvt', 'CreeperDuty VT', 'Talento NeuraLive'),
  ('00000000-0000-0000-0000-000000000001', 'alexyshai', 'Alexyshai', 'Talento NeuraLive')
ON CONFLICT (organization_id, login) DO UPDATE
SET display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    deleted_at = NULL,
    updated_at = now();
