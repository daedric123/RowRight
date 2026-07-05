-- ============================================================
-- 003_user_profiles_rpc.sql
-- Exposes a security-definer RPC so coaches can fetch the
-- full_name and email of team members without direct access
-- to the auth.users table (which the anon/authenticated role
-- cannot read).
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

create or replace function get_user_profiles(user_ids uuid[])
returns table (id uuid, email text, full_name text)
language sql
security definer   -- runs as DB owner, can access auth.users
stable
as $$
  select
    id,
    email,
    raw_user_meta_data->>'full_name' as full_name
  from auth.users
  where id = any(user_ids);
$$;

-- Restrict execution to authenticated users only
revoke execute on function get_user_profiles(uuid[]) from public;
grant  execute on function get_user_profiles(uuid[]) to authenticated;
