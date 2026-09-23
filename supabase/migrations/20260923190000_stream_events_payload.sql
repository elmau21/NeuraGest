-- Payload EventSub (raid from/to/viewers, shared_chat session/participants) for coordination panel
ALTER TABLE public.stream_events
  ADD COLUMN IF NOT EXISTS payload jsonb;

COMMENT ON COLUMN public.stream_events.payload IS
  'Fragmento EventSub: raid (from/to/viewers) o shared_chat (sessionId/host/participants).';
