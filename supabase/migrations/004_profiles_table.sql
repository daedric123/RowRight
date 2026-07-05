-- ============================================================
-- 004_profiles_table.sql
-- Creates a public profiles table mirroring auth.users data,
-- auto-populated via trigger on every new sign-up.
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New query
-- ============================================================

-- ── 1. Create the profiles table ─────────────────────────────

create table if not exists public.profiles (
  id         uuid        primary key references auth.users(id) on delete cascade,
  full_name  text,
  email      text,
  created_at timestamptz default now()
);

-- ── 2. Trigger function ───────────────────────────────────────
-- Runs as the postgres superuser (security definer) so it can
-- read auth.users on insert and write to public.profiles.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, created_at)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    now()
  )
  on conflict (id) do update
    set full_name  = excluded.full_name,
        email      = excluded.email;
  return new;
end;
$$;

-- ── 3. Attach trigger to auth.users ──────────────────────────

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ── 4. RLS ───────────────────────────────────────────────────

alter table public.profiles enable row level security;

-- Any authenticated user can read all profiles
-- (coaches need to read their team members' profiles)
create policy "authenticated_select_profiles"
  on public.profiles
  for select
  to authenticated
  using (true);

-- ── 5. Back-fill existing users ──────────────────────────────
-- Inserts a profile row for every user who signed up before
-- this migration ran. Safe to run multiple times.

insert into public.profiles (id, full_name, email, created_at)
select
  id,
  raw_user_meta_data->>'full_name',
  email,
  created_at
from auth.users
on conflict (id) do update
  set full_name = excluded.full_name,
      email     = excluded.email;
