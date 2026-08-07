-- Storage bucket para adjuntos de tareas + RLS bridge app_users + wiki seed
-- (Aplicado vía MCP ops_features_rls_storage)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('task-attachments', 'task-attachments', false, 52428800, ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO NOTHING;

-- Ver migración completa en historial MCP del proyecto dlnltlvydrruikvkgwlr
