-- ============================================================
-- 005_teams_select_policy.sql
-- Athletes need to SELECT from teams to look up a team_id by
-- code during sign-up. Without this policy the query returns
-- null (not an error), silently failing the join flow.
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New query
-- ============================================================

create policy "authenticated_select_teams"
  on teams
  for select
  to authenticated
  using (true);
