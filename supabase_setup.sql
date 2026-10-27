-- Run this whole script in Supabase Dashboard -> SQL Editor.
-- Creates a public APK catalogue, an administrator allowlist, and the storage bucket.
-- The bucket is public so visitors can download APKs; uploads/deletes remain admin-only.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "Admins can view their own allowlist row" on public.admin_users;
create policy "Admins can view their own allowlist row"
on public.admin_users for select
to authenticated
using (user_id = (select auth.uid()));

create table if not exists public.apps (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  version text not null check (char_length(version) between 1 and 30),
  description text not null check (char_length(description) between 1 and 500),
  apk_path text not null unique,
  apk_url text not null,
  icon_path text,
  icon_url text,
  file_size bigint not null default 0 check (file_size >= 0),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.apps enable row level security;

drop policy if exists "Anyone can read published apps" on public.apps;
create policy "Anyone can read published apps"
on public.apps for select
to anon, authenticated
using (true);

drop policy if exists "Admins can publish apps" on public.apps;
create policy "Admins can publish apps"
on public.apps for insert
to authenticated
with check (
  uploaded_by = (select auth.uid())
  and exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()))
);

drop policy if exists "Admins can delete apps" on public.apps;
create policy "Admins can delete apps"
on public.apps for delete
to authenticated
using (exists (select 1 from public.admin_users au where au.user_id = (select auth.uid())));

-- Create the public download bucket (individual file limit 50 MB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'apk-files',
  'apk-files',
  true,
  52428800,
  array['application/vnd.android.package-archive', 'application/octet-stream', 'image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can upload APK store files" on storage.objects;
create policy "Admins can upload APK store files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'apk-files'
  and exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()))
);

drop policy if exists "Admins can update APK store files" on storage.objects;
create policy "Admins can update APK store files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'apk-files'
  and exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()))
)
with check (
  bucket_id = 'apk-files'
  and exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()))
);

drop policy if exists "Admins can delete APK store files" on storage.objects;
create policy "Admins can delete APK store files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'apk-files'
  and exists (select 1 from public.admin_users au where au.user_id = (select auth.uid()))
);

-- IMPORTANT: After creating your admin user in Authentication, run this separately,
-- replacing the UUID with the actual user's ID from Authentication -> Users:
-- insert into public.admin_users (user_id) values ('YOUR-ADMIN-AUTH-USER-UUID');
