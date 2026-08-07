-- Almacenamiento privado y metadatos para contratos PDF.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 52428800, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.documents
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists file_name text,
  add column if not exists mime_type text,
  add column if not exists size_bytes bigint,
  add column if not exists category text not null default 'General',
  add column if not exists talent_id uuid references public.talents(id);

create unique index if not exists documents_storage_object_unique
  on public.documents(storage_bucket, storage_path)
  where storage_bucket is not null and storage_path is not null and deleted_at is null;

drop policy if exists documents_org_read on public.documents;
create policy documents_org_read on public.documents
for select to authenticated
using (
  organization_id = private.current_org_id()
  and (
    category <> 'Contratos'
    or private.has_role(array['owner','admin','manager']::public.app_role[])
  )
);

drop policy if exists contracts_storage_read on storage.objects;
create policy contracts_storage_read on storage.objects
for select to authenticated
using (
  bucket_id = 'documents'
  and private.has_role(array['owner','admin','manager']::public.app_role[])
);

drop policy if exists contracts_storage_insert on storage.objects;
create policy contracts_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'documents'
  and private.has_role(array['owner','admin','manager']::public.app_role[])
);

drop policy if exists contracts_storage_update on storage.objects;
create policy contracts_storage_update on storage.objects
for update to authenticated
using (
  bucket_id = 'documents'
  and private.has_role(array['owner','admin','manager']::public.app_role[])
)
with check (
  bucket_id = 'documents'
  and private.has_role(array['owner','admin','manager']::public.app_role[])
);

drop policy if exists contracts_storage_delete on storage.objects;
create policy contracts_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'documents'
  and private.has_role(array['owner','admin','manager']::public.app_role[])
);
