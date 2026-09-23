-- Add niel to NeuraLive roster (Helix id 949345562)
INSERT INTO public.talents (
  organization_id, twitch_user_id, login, display_name, avatar_url, description, twitch_created_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '949345562',
  'niel',
  'Niel',
  'https://static-cdn.jtvnw.net/jtv_user_pictures/b34658a0-5071-4c58-bb47-7d494d7b18ca-profile_image-300x300.png',
  'Un esquizofrénico que le mama Divertirse y Gritar. VIVA LA EZQUIZO 💥 ',
  '2023-08-28T19:04:39Z'
)
ON CONFLICT (organization_id, login) DO UPDATE
SET twitch_user_id = EXCLUDED.twitch_user_id,
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    description = EXCLUDED.description,
    twitch_created_at = EXCLUDED.twitch_created_at,
    deleted_at = NULL,
    updated_at = now();
