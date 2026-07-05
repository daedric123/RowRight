-- ============================================================
-- 002_fix_athlete_rls.sql
-- Fixes athlete SELECT access to published load_profiles rows.
-- Safe to run multiple times: drops policies by name first.
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor).
-- ============================================================

-- Drop all existing SELECT-capable policies on load_profiles
drop policy if exists "members_select_published_load_profiles" on load_profiles;
drop policy if exists "coaches_all_on_load_profiles"            on load_profiles;

-- ── Policy 1: Athletes and coxes ─────────────────────────────
-- Allows any authenticated user to SELECT rows where:
--   • published = true
--   • their user_id appears in team_members for that team_id with status 'active'
-- Uses an explicit subquery instead of the is_active_member() helper
-- so the planner can inline it and avoid any function-permission issues.
create policy "members_select_published_load_profiles"
  on load_profiles
  for select
  to authenticated
  using (
    published = true
    and team_id in (
      select team_id
      from   team_members
      where  user_id = auth.uid()
        and  status  = 'active'
    )
  );

-- ── Policy 2: Coaches ─────────────────────────────────────────
-- Allows coaches full SELECT (and all other operations) on
-- load_profiles rows that belong to their own team.
create policy "coaches_all_on_load_profiles"
  on load_profiles
  for all
  to authenticated
  using (
    team_id in (
      select id
      from   teams
      where  coach_id = auth.uid()
    )
  )
  with check (
    team_id in (
      select id
      from   teams
      where  coach_id = auth.uid()
    )
  );
