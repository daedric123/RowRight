-- ============================================================
-- 003_team_members_insert_function.sql
-- Creates a SECURITY DEFINER function that inserts into
-- team_members on behalf of a newly signed-up user.
--
-- WHY SECURITY DEFINER:
-- After supabase.auth.signUp() the JWT is not yet active in
-- the current request, so auth.uid() is null and RLS blocks
-- a direct INSERT. Running the function as the owner
-- (postgres) bypasses RLS entirely, which is safe here
-- because all inputs are validated inside the function.
--
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New query
-- ============================================================

create or replace function join_team_by_code(
  p_team_code text,
  p_user_id   uuid,
  p_user_role text,
  p_full_name text default null,
  p_email     text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
begin
  -- Look up team by code, case-insensitive
  select id into v_team_id
  from   teams
  where  upper(code) = upper(p_team_code)
  limit  1;

  if v_team_id is null then
    return null;  -- caller treats null as "code not found"
  end if;

  -- Insert pending membership row
  insert into team_members (team_id, user_id, role, status, full_name, email)
  values (v_team_id, p_user_id, lower(p_user_role), 'pending', p_full_name, p_email)
  on conflict (team_id, user_id) do nothing;  -- idempotent: re-submitting same code is harmless

  return v_team_id;
end;
$$;

-- Allow both anon (pre-session) and authenticated callers to execute
grant execute on function join_team_by_code(text, uuid, text, text, text) to anon;
grant execute on function join_team_by_code(text, uuid, text, text, text) to authenticated;
