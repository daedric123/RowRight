-- ============================================================
-- 006_join_team_function.sql
--
-- Creates a SECURITY DEFINER RPC that looks up a team by code
-- and inserts a pending team_members row.  Because the function
-- runs as its owner (bypassing RLS entirely), it works even when
-- a brand-new user's JWT hasn't been propagated to the Supabase
-- JS client yet.  Granting to anon means the call succeeds
-- regardless of whether an auth header is attached.
--
-- Run in Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Ensure profile columns exist (idempotent — safe to run even if
-- 003_add_member_profile_fields.sql was already applied)
alter table public.team_members
  add column if not exists full_name text,
  add column if not exists email     text;

-- Drop any earlier version so we can change the signature cleanly
drop function if exists public.join_team_by_code(uuid, text, text, text, text);
drop function if exists public.join_team_by_code(text, text, text);

create function public.join_team_by_code(
  _user_id   uuid,
  _team_code text,
  _role      text,
  _full_name text default null,
  _email     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
begin
  -- Team lookup runs as function owner → no RLS
  select id into v_team_id
  from   public.teams
  where  lower(code) = lower(trim(_team_code))
  limit  1;

  if v_team_id is null then
    return jsonb_build_object('error', 'team_not_found');
  end if;

  -- Insert pending row; swallow duplicate silently
  begin
    insert into public.team_members (user_id, team_id, role, status, full_name, email)
    values (_user_id, v_team_id, lower(_role), 'pending', _full_name, _email);
  exception
    when unique_violation then
      null;  -- already a member — treat as success
  end;

  return jsonb_build_object('team_id', v_team_id::text);

exception when others then
  return jsonb_build_object('error', sqlerrm, 'detail', sqlstate);
end;
$$;

-- Grant to anon so the call succeeds even before the JWT propagates
grant execute on function public.join_team_by_code(uuid, text, text, text, text)
  to anon, authenticated;
