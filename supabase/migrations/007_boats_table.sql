-- ============================================================
-- 007_boats_table.sql
-- Per-team fleet of named boats. Coaches add/remove boats;
-- members read so they see the same fleet in trailer plans
-- and lineups.
-- Run in Supabase Dashboard → SQL Editor → New query
-- ============================================================

create table if not exists public.boats (
  id         uuid        primary key default gen_random_uuid(),
  team_id    uuid        not null references public.teams(id) on delete cascade,
  name       text        not null,
  type       text        not null check (type in ('8+', '4+', '4-', '4x', '2x', '2-', '1x')),
  created_at timestamptz not null default now()
);

create index if not exists boats_team_id_idx on public.boats (team_id);

alter table public.boats enable row level security;

create policy "coaches_all_on_boats"
  on public.boats for all
  using      (is_team_coach(team_id))
  with check (is_team_coach(team_id));

create policy "members_select_team_boats"
  on public.boats for select
  using (is_active_member(team_id));
