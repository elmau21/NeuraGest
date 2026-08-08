-- Presence por org: canal privado neuragest-presence:<organization_id>
-- RLS en realtime.messages (RLS ya activo; sin políticas no se puede unir a privados).

CREATE POLICY "org_members_listen_presence"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  extension = 'presence'
  AND (SELECT realtime.topic()) = ('neuragest-presence:' || private.current_org_id()::text)
);

CREATE POLICY "org_members_track_presence"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  extension = 'presence'
  AND (SELECT realtime.topic()) = ('neuragest-presence:' || private.current_org_id()::text)
);
