-- ============================================================
-- 002_fix_rls_policies.sql
-- Drops and recreates load_profiles RLS policies to ensure
-- athletes/coxes can SELECT published plans for their team.
-- Safe to re-run: drops policies by exact name first.
-- ============================================================

-- Drop existing policies on load_profiles
drop policy if exists "coaches_all_on_load_profiles"         on load_profiles;
drop policy if exists "members_select_published_load_profiles" on load_profiles;

-- Coaches have full CRUD on their team's load_profiles
create policy "coaches_all_on_load_profiles"
  on load_profiles for all
  using     (is_team_coach(team_id))
  with check (is_team_coach(team_id));

-- Active team members (athletes and coxes) can SELECT published plans
-- is_active_member() checks: team_members.user_id = auth.uid()
--                             AND team_members.team_id = p_team_id
--                             AND team_members.status = 'active'
create policy "members_select_published_load_profiles"
  on load_profiles for select
  using (
    published = true
    and is_active_member(team_id)
  );
