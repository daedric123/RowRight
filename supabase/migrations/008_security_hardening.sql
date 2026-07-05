-- ============================================================
-- 008_security_hardening.sql
--
-- 1. Drop the overly-permissive team SELECT policy that exposed
--    all team codes and Stripe IDs to every authenticated user.
--    The existing coaches_all_on_teams and members_select_own_team
--    policies from 001 are sufficient.
--
-- 2. Add a DB-level length cap on comment bodies so the frontend
--    maxLength cannot be bypassed by direct API calls.
--
-- 3. Replace join_team_by_code with a hardened version that:
--    - Verifies the caller's auth.uid() matches _user_id
--    - Validates _role before inserting
--    - Returns a generic error on unexpected failures (no sqlerrm leakage)
--    - Is no longer granted to anon
-- ============================================================

-- ── 1. Drop permissive team SELECT policy ───────────────────
drop policy if exists "authenticated_select_teams" on teams;


-- ── 2. Comment body length constraint ───────────────────────
alter table lineup_comments
  add constraint lineup_comments_body_length
  check (char_length(body) <= 1000);


-- ── 3. Harden join_team_by_code ─────────────────────────────

-- Revoke anon access first so no window exists between drop and recreate
revoke execute on function public.join_team_by_code(uuid, text, text, text, text)
  from anon;

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
  -- Caller must be authenticated and must be acting as themselves
  if auth.uid() is null then
    return jsonb_build_object('error', 'unauthenticated');
  end if;

  if auth.uid() <> _user_id then
    return jsonb_build_object('error', 'forbidden');
  end if;

  -- Validate role before touching the DB
  if lower(_role) not in ('athlete', 'cox') then
    return jsonb_build_object('error', 'invalid_role');
  end if;

  -- Team lookup (runs as function owner — bypasses RLS intentionally)
  select id into v_team_id
  from   public.teams
  where  lower(code) = lower(trim(_team_code))
  limit  1;

  if v_team_id is null then
    return jsonb_build_object('error', 'team_not_found');
  end if;

  -- Insert pending membership; swallow duplicate silently
  begin
    insert into public.team_members (user_id, team_id, role, status, full_name, email)
    values (_user_id, v_team_id, lower(_role), 'pending', _full_name, _email);
  exception
    when unique_violation then
      null;
  end;

  return jsonb_build_object('team_id', v_team_id::text);

exception when others then
  -- Return a generic message — never expose sqlerrm / sqlstate to the client
  return jsonb_build_object('error', 'unexpected_error');
end;
$$;

-- Authenticated users only — anon access removed
grant execute on function public.join_team_by_code(uuid, text, text, text, text)
  to authenticated;
