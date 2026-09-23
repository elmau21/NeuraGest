-- Rich EventSub event types + yosoyastra roster (NeuraLive)
ALTER TABLE public.stream_events DROP CONSTRAINT IF EXISTS stream_events_event_type_check;
ALTER TABLE public.stream_events
  ADD CONSTRAINT stream_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'stream.online',
    'stream.offline',
    'channel.update',
    'channel.follow',
    'channel.subscribe',
    'channel.subscription.gift',
    'channel.subscription.message',
    'channel.raid',
    'channel.shared_chat.begin',
    'channel.shared_chat.update',
    'channel.shared_chat.end'
  ]::text[]));

INSERT INTO public.talents (
  organization_id, twitch_user_id, login, display_name, avatar_url, description
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '122087819',
  'yosoyastra',
  'yosoyastra',
  'https://static-cdn.jtvnw.net/jtv_user_pictures/6bc03455-ae1c-4f4d-a65c-d3a669cf5f3b-profile_image-300x300.png',
  'Hola mi pequeño cometita, has recorrido mucho. Ven y toma un descanso con tu vtuber de confianza nwn'
)
ON CONFLICT (organization_id, login) DO UPDATE
SET twitch_user_id = EXCLUDED.twitch_user_id,
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    description = EXCLUDED.description,
    deleted_at = NULL,
    updated_at = now();
