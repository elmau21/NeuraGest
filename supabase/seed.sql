insert into public.organizations(id,name,slug) values ('00000000-0000-0000-0000-000000000001','NeuraLive','neuralive') on conflict do nothing;

insert into public.talents(organization_id,login,display_name,description) values
('00000000-0000-0000-0000-000000000001','arikyu_','Arikyu','Talento NeuraLive'),
('00000000-0000-0000-0000-000000000001','nosomevt','Nosome','Talento NeuraLive'),
('00000000-0000-0000-0000-000000000001','kumitacui','Kumita Cui','Talento NeuraLive'),
('00000000-0000-0000-0000-000000000001','ryonikku','Ryonikku','Talento NeuraLive'),
('00000000-0000-0000-0000-000000000001','suimivt','Suimi','Talento NeuraLive'),
('00000000-0000-0000-0000-000000000001','tesitoazul','Tesito Azul','Talento NeuraLive'),
('00000000-0000-0000-0000-000000000001','shisuvr','Shisu VR','Talento NeuraLive'),
('00000000-0000-0000-0000-000000000001','bhikoruvt','Bhikoru VT','Talento NeuraLive'),
('00000000-0000-0000-0000-000000000001','ashitakaseiren','Ashitaka Seiren','Talento NeuraLive'),
('00000000-0000-0000-0000-000000000001','cold__vt','Cold VT','Talento NeuraLive')
on conflict(organization_id,login) do update set display_name=excluded.display_name;

insert into public.spaces(organization_id,name,position)
select '00000000-0000-0000-0000-000000000001',name,ord from unnest(array['Operaciones','Talentos','Marketing','Eventos','Patrocinios','Producción','Administración']) with ordinality x(name,ord);

insert into public.task_status(organization_id,name,state,color,position) values
('00000000-0000-0000-0000-000000000001','Pendiente','backlog','#71717A',1),
('00000000-0000-0000-0000-000000000001','En progreso','progress','#3B82F6',2),
('00000000-0000-0000-0000-000000000001','En revisión','review','#F59E0B',3),
('00000000-0000-0000-0000-000000000001','Completado','done','#10B981',4);

insert into public.task_priority(organization_id,name,level,color,position) values
('00000000-0000-0000-0000-000000000001','Baja','low','#71717A',1),
('00000000-0000-0000-0000-000000000001','Media','medium','#3B82F6',2),
('00000000-0000-0000-0000-000000000001','Alta','high','#F59E0B',3),
('00000000-0000-0000-0000-000000000001','Urgente','urgent','#EF4444',4);
