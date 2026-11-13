-- Run this once in the Supabase SQL Editor for the project.
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  category text not null default '',
  location text not null default '',
  description text not null default '',
  image_url text not null default '',
  featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key,
  value text not null default ''
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  email text not null check (char_length(btrim(email)) between 3 and 254),
  message text not null check (char_length(btrim(message)) between 1 and 5000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_site_admin() from public, anon;
grant execute on function public.is_site_admin() to authenticated;

create or replace function public.touch_project_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at
before update on public.projects
for each row execute function public.touch_project_updated_at();

create or replace function public.enforce_featured_project_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('orioline.projects.featured.limit', 0)
  );
  if new.featured and (
    select count(*) from public.projects
    where featured and id is distinct from new.id
  ) >= 4 then
    raise exception 'A maximum of four projects can be featured.';
  end if;
  return new;
end;
$$;

drop trigger if exists projects_enforce_featured_limit on public.projects;
create trigger projects_enforce_featured_limit
before insert or update of featured on public.projects
for each row execute function public.enforce_featured_project_limit();

create index if not exists projects_sort_order_idx on public.projects(sort_order, created_at);
create index if not exists messages_created_at_idx on public.messages(created_at desc);

alter table public.projects enable row level security;
alter table public.site_settings enable row level security;
alter table public.messages enable row level security;
alter table public.admin_users enable row level security;

drop policy if exists "Anyone can read projects" on public.projects;
create policy "Anyone can read projects" on public.projects
for select to anon, authenticated using (true);
drop policy if exists "Admins can manage projects" on public.projects;
create policy "Admins can manage projects" on public.projects
for all to authenticated
using ((select public.is_site_admin()))
with check ((select public.is_site_admin()));

drop policy if exists "Anyone can read site settings" on public.site_settings;
create policy "Anyone can read site settings" on public.site_settings
for select to anon, authenticated using (true);
drop policy if exists "Admins can manage site settings" on public.site_settings;
create policy "Admins can manage site settings" on public.site_settings
for all to authenticated
using ((select public.is_site_admin()))
with check ((select public.is_site_admin()));

drop policy if exists "Visitors can submit contact messages" on public.messages;
create policy "Visitors can submit contact messages" on public.messages
for insert to anon, authenticated
with check (
  char_length(btrim(name)) between 1 and 100 and
  char_length(btrim(email)) between 3 and 254 and
  position('@' in email) > 1 and
  char_length(btrim(message)) between 1 and 5000
);
drop policy if exists "Admins can read contact messages" on public.messages;
create policy "Admins can read contact messages" on public.messages
for select to authenticated using ((select public.is_site_admin()));
drop policy if exists "Admins can update contact messages" on public.messages;
create policy "Admins can update contact messages" on public.messages
for update to authenticated
using ((select public.is_site_admin()))
with check ((select public.is_site_admin()));
drop policy if exists "Admins can delete contact messages" on public.messages;
create policy "Admins can delete contact messages" on public.messages
for delete to authenticated using ((select public.is_site_admin()));

drop policy if exists "Admins can view their allowlist entry" on public.admin_users;
create policy "Admins can view their allowlist entry" on public.admin_users
for select to authenticated using (user_id = (select auth.uid()));

grant select on public.projects, public.site_settings to anon, authenticated;
grant insert, select, update, delete on public.projects, public.site_settings to authenticated;
grant insert on public.messages to anon, authenticated;
grant select, update, delete on public.messages to authenticated;
grant select on public.admin_users to authenticated;

insert into public.site_settings (key, value) values
  ('site_email', 'hello@oriolineform.com'),
  ('hero_title', 'Designing spaces that inspire'),
  ('hero_subtitle', 'Architecture, interiors, and construction with purpose.')
on conflict (key) do nothing;

insert into public.projects (title, category, location, description, featured, sort_order)
select seed.title, seed.category, seed.location, seed.description, true, seed.sort_order
from (values
  ('Luxury Residence', 'Residential', 'Lekki, Lagos', 'A sophisticated modern home with private pool.', 0),
  ('Office Complex', 'Commercial', 'Victoria Island', 'Dynamic workspace designed for collaboration.', 1),
  ('Modern Villa', 'Residential', 'Banana Island', 'Minimalist architecture with panoramic glass walls.', 2),
  ('Retail Center', 'Commercial', 'Ikeja', 'High-traffic commercial space with vibrant aesthetics.', 3)
) as seed(title, category, location, description, sort_order)
where not exists (
  select 1 from public.projects existing where existing.title = seed.title
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-images', 'project-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view project images" on storage.objects;
create policy "Anyone can view project images" on storage.objects
for select to anon, authenticated using (bucket_id = 'project-images');
drop policy if exists "Admins can upload project images" on storage.objects;
create policy "Admins can upload project images" on storage.objects
for insert to authenticated
with check (bucket_id = 'project-images' and (select public.is_site_admin()));
drop policy if exists "Admins can update project images" on storage.objects;
create policy "Admins can update project images" on storage.objects
for update to authenticated
using (bucket_id = 'project-images' and (select public.is_site_admin()))
with check (bucket_id = 'project-images' and (select public.is_site_admin()));
drop policy if exists "Admins can delete project images" on storage.objects;
create policy "Admins can delete project images" on storage.objects
for delete to authenticated
using (bucket_id = 'project-images' and (select public.is_site_admin()));
