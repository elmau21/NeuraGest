-- Bucket privado dedicado a contratos PDF.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contratos', 'contratos', false, 52428800, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists contratos_storage_read on storage.objects;
create policy contratos_storage_read on storage.objects
for select to authenticated
using (
  bucket_id = 'contratos'
  and private.has_role(array['owner','admin','manager']::public.app_role[])
);

drop policy if exists contratos_storage_insert on storage.objects;
create policy contratos_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'contratos'
  and private.has_role(array['owner','admin','manager']::public.app_role[])
);

drop policy if exists contratos_storage_update on storage.objects;
create policy contratos_storage_update on storage.objects
for update to authenticated
using (
  bucket_id = 'contratos'
  and private.has_role(array['owner','admin','manager']::public.app_role[])
)
with check (
  bucket_id = 'contratos'
  and private.has_role(array['owner','admin','manager']::public.app_role[])
);

drop policy if exists contratos_storage_delete on storage.objects;
create policy contratos_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'contratos'
  and private.has_role(array['owner','admin','manager']::public.app_role[])
);
