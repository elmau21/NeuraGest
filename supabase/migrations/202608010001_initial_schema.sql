-- NeuraGest: schema inicial PostgreSQL/Supabase
create extension if not exists pgcrypto;
create schema if not exists private;

create type public.app_role as enum ('owner','admin','manager','staff');
create type public.task_state as enum ('backlog','progress','review','done','archived');
create type public.task_priority_level as enum ('low','medium','high','urgent');

create table public.organizations (
  id uuid primary key default gen_random_uuid(), name text not null, slug text unique not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade, organization_id uuid references public.organizations(id),
  display_name text, avatar_url text, timezone text not null default 'America/Mexico_City',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table public.roles (id uuid primary key default gen_random_uuid(), name public.app_role unique not null, permissions jsonb not null default '{}');
create table public.user_roles (user_id uuid references public.users(id) on delete cascade, role_id uuid references public.roles(id) on delete cascade, primary key(user_id,role_id));
create table public.talents (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), twitch_user_id text unique,
  login text not null, display_name text not null, avatar_url text, banner_url text, description text, twitch_created_at timestamptz,
  notes text, metadata jsonb not null default '{}', version bigint not null default 1, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), deleted_at timestamptz, unique(organization_id,login)
);
create table public.twitch_accounts (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), user_id uuid references public.users(id),
  twitch_user_id text, display_name text, encrypted_access_token text not null, encrypted_refresh_token text not null, scopes text[] not null default '{}',
  expires_at timestamptz not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table public.stream_sessions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), talent_id uuid not null references public.talents(id),
  twitch_stream_id text unique, title text, category_id text, category_name text, started_at timestamptz not null, ended_at timestamptz,
  peak_viewers integer not null default 0 check(peak_viewers>=0), average_viewers numeric(12,2) default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table public.stream_metrics (
  id bigint generated always as identity primary key, organization_id uuid not null references public.organizations(id), session_id uuid not null references public.stream_sessions(id) on delete cascade,
  viewers integer not null check(viewers>=0), followers integer, subscribers integer, captured_at timestamptz not null default now()
);
create table public.viewer_snapshots (id bigint generated always as identity primary key, organization_id uuid not null references public.organizations(id), talent_id uuid not null references public.talents(id), viewers integer not null check(viewers>=0), captured_at timestamptz not null default now());
create table public.follower_snapshots (id bigint generated always as identity primary key, organization_id uuid not null references public.organizations(id), talent_id uuid not null references public.talents(id), followers integer not null check(followers>=0), captured_at timestamptz not null default now());
create table public.clips (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), talent_id uuid not null references public.talents(id), twitch_clip_id text unique not null, title text, url text, thumbnail_url text, view_count integer default 0, published_at timestamptz, created_at timestamptz not null default now(), deleted_at timestamptz);
create table public.vods (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), talent_id uuid not null references public.talents(id), twitch_video_id text unique not null, title text, url text, duration_seconds integer, view_count integer default 0, published_at timestamptz, created_at timestamptz not null default now(), deleted_at timestamptz);

create table public.spaces (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), name text not null, icon text, position integer default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz);
create table public.projects (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), space_id uuid references public.spaces(id), name text not null, description text, color text default '#7C3AED', starts_at date, ends_at date, version bigint default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz);
create table public.boards (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), project_id uuid references public.projects(id), name text not null, settings jsonb default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz);
create table public.task_status (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), name text not null, state public.task_state not null, color text, position integer default 0, created_at timestamptz not null default now(), deleted_at timestamptz);
create table public.task_priority (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), name text not null, level public.task_priority_level not null, color text, position integer default 0, created_at timestamptz not null default now(), deleted_at timestamptz);
create table public.tasks (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), project_id uuid references public.projects(id),
  board_id uuid references public.boards(id), status_id uuid references public.task_status(id), priority_id uuid references public.task_priority(id), parent_id uuid references public.tasks(id),
  title text not null check(length(title)<=300), description text, starts_at timestamptz, due_at timestamptz, estimate_minutes integer check(estimate_minutes>=0),
  tracked_minutes integer not null default 0 check(tracked_minutes>=0), position numeric not null default 0, version bigint not null default 1,
  created_by uuid references public.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table public.task_assignments (task_id uuid references public.tasks(id) on delete cascade, user_id uuid references public.users(id) on delete cascade, assigned_at timestamptz default now(), primary key(task_id,user_id));
create table public.subtasks (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), task_id uuid not null references public.tasks(id) on delete cascade, title text not null, completed boolean default false, position integer default 0, created_at timestamptz default now(), updated_at timestamptz default now(), deleted_at timestamptz);
create table public.comments (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), task_id uuid references public.tasks(id), author_id uuid references public.users(id), body text not null, created_at timestamptz default now(), updated_at timestamptz default now(), deleted_at timestamptz);
create table public.attachments (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), task_id uuid references public.tasks(id), comment_id uuid references public.comments(id), storage_path text not null, file_name text not null, mime_type text, size_bytes bigint, created_by uuid references public.users(id), created_at timestamptz default now(), deleted_at timestamptz);
create table public.tags (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), name text not null, color text, created_at timestamptz default now(), deleted_at timestamptz, unique(organization_id,name));
create table public.task_tags (task_id uuid references public.tasks(id) on delete cascade, tag_id uuid references public.tags(id) on delete cascade, primary key(task_id,tag_id));
create table public.task_dependencies (task_id uuid references public.tasks(id) on delete cascade, depends_on_id uuid references public.tasks(id) on delete cascade, primary key(task_id,depends_on_id), check(task_id<>depends_on_id));

create table public.documents (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), parent_id uuid references public.documents(id), title text not null, icon text, cover_url text, created_by uuid references public.users(id), version bigint default 1, created_at timestamptz default now(), updated_at timestamptz default now(), deleted_at timestamptz);
create table public.document_blocks (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), document_id uuid not null references public.documents(id) on delete cascade, parent_id uuid references public.document_blocks(id), type text not null, content jsonb not null default '{}', position numeric default 0, version bigint default 1, created_at timestamptz default now(), updated_at timestamptz default now(), deleted_at timestamptz);
create table public.calendar_events (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), title text not null, description text, event_type text not null, starts_at timestamptz not null, ends_at timestamptz not null, all_day boolean default false, talent_id uuid references public.talents(id), project_id uuid references public.projects(id), external_calendar_id text, version bigint default 1, created_at timestamptz default now(), updated_at timestamptz default now(), deleted_at timestamptz, check(ends_at>=starts_at));
create table public.notifications (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), user_id uuid not null references public.users(id), type text not null, title text not null, body text, data jsonb default '{}', read_at timestamptz, created_at timestamptz default now(), deleted_at timestamptz);
create table public.activity_logs (id bigint generated always as identity primary key, organization_id uuid not null references public.organizations(id), actor_id uuid references public.users(id), entity_type text not null, entity_id uuid, action text not null, metadata jsonb default '{}', created_at timestamptz default now());
create table public.audit_logs (id bigint generated always as identity primary key, organization_id uuid not null references public.organizations(id), actor_id uuid references public.users(id), action text not null, table_name text not null, record_id uuid, before_data jsonb, after_data jsonb, ip inet, created_at timestamptz default now());
create table public.settings (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), user_id uuid references public.users(id), key text not null, value jsonb not null default '{}', created_at timestamptz default now(), updated_at timestamptz default now(), unique(organization_id,user_id,key));

create index talents_org_active_idx on public.talents(organization_id,login) where deleted_at is null;
create index sessions_talent_started_idx on public.stream_sessions(talent_id,started_at desc) where deleted_at is null;
create index metrics_session_captured_idx on public.stream_metrics(session_id,captured_at desc);
create index tasks_project_status_idx on public.tasks(project_id,status_id,position) where deleted_at is null;
create index tasks_due_idx on public.tasks(organization_id,due_at) where deleted_at is null;
create index docs_parent_idx on public.documents(organization_id,parent_id) where deleted_at is null;
create index events_range_idx on public.calendar_events(organization_id,starts_at,ends_at) where deleted_at is null;
create index activity_org_created_idx on public.activity_logs(organization_id,created_at desc);

create or replace function private.touch_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); if to_jsonb(new) ? 'version' then new.version=coalesce(new.version,0)+1; end if; return new; end $$;
do $$ declare t text; begin foreach t in array array['organizations','users','talents','twitch_accounts','stream_sessions','spaces','projects','boards','tasks','subtasks','comments','documents','document_blocks','calendar_events','settings'] loop execute format('create trigger %I_touch before update on public.%I for each row execute function private.touch_updated_at()',t,t); end loop; end $$;

create or replace function private.current_org_id() returns uuid language sql stable security definer set search_path='' as $$
  select organization_id from public.users where id=auth.uid() and deleted_at is null
$$;
create or replace function private.has_role(allowed public.app_role[]) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=auth.uid() and r.name=any(allowed))
$$;
revoke all on schema private from public, anon, authenticated;

do $$ declare t text; begin foreach t in array array[
  'organizations','users','roles','user_roles','talents','twitch_accounts','stream_sessions','stream_metrics','viewer_snapshots','follower_snapshots','clips','vods',
  'spaces','projects','boards','task_status','task_priority','tasks','task_assignments','subtasks','comments','attachments','tags','task_tags','task_dependencies',
  'documents','document_blocks','calendar_events','notifications','activity_logs','audit_logs','settings'
] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;

create policy users_self_org on public.users for select to authenticated using (organization_id=private.current_org_id());
create policy organizations_member_read on public.organizations for select to authenticated using (id=private.current_org_id());
create policy roles_read on public.roles for select to authenticated using (true);
create policy user_roles_org_read on public.user_roles for select to authenticated using (exists(select 1 from public.users u where u.id=user_id and u.organization_id=private.current_org_id()));
do $$ declare t text; begin foreach t in array array[
  'talents','stream_sessions','stream_metrics','viewer_snapshots','follower_snapshots','clips','vods','spaces','projects','boards','task_status','task_priority','tasks',
  'subtasks','comments','attachments','tags','documents','document_blocks','calendar_events','notifications','activity_logs','settings'
] loop
  execute format('create policy %I_org_read on public.%I for select to authenticated using (organization_id=private.current_org_id())',t,t);
  execute format('create policy %I_org_write on public.%I for all to authenticated using (organization_id=private.current_org_id() and private.has_role(array[''owner'',''admin'',''manager'']::public.app_role[])) with check (organization_id=private.current_org_id() and private.has_role(array[''owner'',''admin'',''manager'']::public.app_role[]))',t,t);
end loop; end $$;
create policy task_assignments_org_read on public.task_assignments for select to authenticated using (
  exists(select 1 from public.tasks t where t.id=task_id and t.organization_id=private.current_org_id())
);
create policy task_assignments_org_write on public.task_assignments for all to authenticated using (
  exists(select 1 from public.tasks t where t.id=task_id and t.organization_id=private.current_org_id())
  and private.has_role(array['owner','admin','manager']::public.app_role[])
) with check (
  exists(select 1 from public.tasks t where t.id=task_id and t.organization_id=private.current_org_id())
  and private.has_role(array['owner','admin','manager']::public.app_role[])
);
create policy task_tags_org_read on public.task_tags for select to authenticated using (
  exists(select 1 from public.tasks t where t.id=task_id and t.organization_id=private.current_org_id())
);
create policy task_tags_org_write on public.task_tags for all to authenticated using (
  exists(select 1 from public.tasks t where t.id=task_id and t.organization_id=private.current_org_id())
  and private.has_role(array['owner','admin','manager']::public.app_role[])
) with check (
  exists(select 1 from public.tasks t where t.id=task_id and t.organization_id=private.current_org_id())
  and private.has_role(array['owner','admin','manager']::public.app_role[])
);
create policy task_dependencies_org_read on public.task_dependencies for select to authenticated using (
  exists(select 1 from public.tasks t where t.id=task_id and t.organization_id=private.current_org_id())
);
create policy task_dependencies_org_write on public.task_dependencies for all to authenticated using (
  exists(select 1 from public.tasks t where t.id=task_id and t.organization_id=private.current_org_id())
  and private.has_role(array['owner','admin','manager']::public.app_role[])
) with check (
  exists(select 1 from public.tasks t where t.id=task_id and t.organization_id=private.current_org_id())
  and private.has_role(array['owner','admin','manager']::public.app_role[])
);
create policy twitch_accounts_admin on public.twitch_accounts for all to authenticated using (organization_id=private.current_org_id() and private.has_role(array['owner','admin']::public.app_role[])) with check (organization_id=private.current_org_id());
create policy audit_admin_read on public.audit_logs for select to authenticated using (organization_id=private.current_org_id() and private.has_role(array['owner','admin']::public.app_role[]));

create materialized view public.talent_daily_metrics as
select s.organization_id,s.talent_id,date_trunc('day',m.captured_at) metric_day,max(m.viewers) peak_viewers,avg(m.viewers)::numeric(12,2) average_viewers,max(m.followers)-min(m.followers) follower_growth
from public.stream_metrics m join public.stream_sessions s on s.id=m.session_id group by 1,2,3;
create unique index talent_daily_metrics_unique on public.talent_daily_metrics(organization_id,talent_id,metric_day);
revoke all on public.talent_daily_metrics from anon, authenticated;

create or replace function public.dashboard_metrics(period_start timestamptz default date_trunc('week',now()))
returns jsonb language sql stable security invoker set search_path='' as $$
select jsonb_build_object(
 'talents',count(distinct t.id),'live',count(distinct s.id) filter(where s.ended_at is null),
 'viewers',coalesce(sum(s.peak_viewers),0),'hours',coalesce(sum(extract(epoch from (coalesce(s.ended_at,now())-s.started_at))/3600),0)
) from public.talents t left join public.stream_sessions s on s.talent_id=t.id and s.started_at>=period_start
where t.organization_id=private.current_org_id() and t.deleted_at is null $$;
grant execute on function public.dashboard_metrics(timestamptz) to authenticated;

insert into public.roles(name,permissions) values
('owner','{"all":true}'),('admin','{"manage":true}'),('manager','{"talents":true,"tasks":true,"docs":true}'),('staff','{"read":true,"tasks":true}')
on conflict(name) do nothing;

alter publication supabase_realtime add table public.stream_sessions,public.stream_metrics,public.activity_logs,public.notifications,public.tasks;
