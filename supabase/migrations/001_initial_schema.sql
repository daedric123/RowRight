-- ============================================================
-- 001_initial_schema.sql
-- ============================================================

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists teams (
  id                     uuid        primary key default gen_random_uuid(),
  name                   text        not null,
  code                   text        not null unique,
  coach_id               uuid        not null references auth.users(id) on delete cascade,
  stripe_subscription_id text,
  seat_count             int         not null default 0,
  created_at             timestamptz not null default now()
);

-- Members of a team (athletes and coxes; coaches are identified via teams.coach_id)
create table if not exists team_members (
  id          uuid        primary key default gen_random_uuid(),
  team_id     uuid        not null references teams(id) on delete cascade,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  role        text        not null check (role in ('athlete', 'cox')),
  status      text        not null default 'pending' check (status in ('pending', 'active', 'removed')),
  approved_at timestamptz,
  unique (team_id, user_id)
);

-- Boathouse / trailer load plans
create table if not exists load_profiles (
  id          uuid        primary key default gen_random_uuid(),
  team_id     uuid        not null references teams(id) on delete cascade,
  created_by  uuid        references auth.users(id) on delete set null,
  name        text        not null,
  type        text        not null check (type in ('boathouse', 'trailer')),
  layout_data jsonb       not null default '{}',
  published   bool        not null default false,
  created_at  timestamptz not null default now()
);

-- Race / practice lineups
create table if not exists lineups (
  id               uuid        primary key default gen_random_uuid(),
  team_id          uuid        not null references teams(id) on delete cascade,
  created_by       uuid        references auth.users(id) on delete set null,
  name             text        not null,
  type             text        not null check (type in ('regatta', 'practice')),
  event_name       text,
  event_date       date,
  lineup_data      jsonb       not null default '{}',
  published        bool        not null default false,
  comments_enabled bool        not null default false,
  created_at       timestamptz not null default now()
);

-- Athlete / cox comments on a published lineup
create table if not exists lineup_comments (
  id         uuid        primary key default gen_random_uuid(),
  lineup_id  uuid        not null references lineups(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  body       text        not null,
  created_at timestamptz not null default now()
);

-- Kit-design votes (replaces hardcoded vote state in the Uni Voting tab)
-- unique (user_id, design_key) enforces one vote per design per user
create table if not exists votes (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  design_key text        not null,
  created_at timestamptz not null default now(),
  unique (user_id, design_key)
);

-- Athlete performance rankings per team / category
create table if not exists rankings (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  team_id    uuid        not null references teams(id) on delete cascade,
  category   text        not null,
  score      numeric     not null,
  updated_at timestamptz not null default now(),
  unique (user_id, team_id, category)
);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists team_members_team_id_idx   on team_members (team_id);
create index if not exists team_members_user_id_idx   on team_members (user_id);
create index if not exists load_profiles_team_id_idx  on load_profiles (team_id);
create index if not exists lineups_team_id_idx         on lineups (team_id);
create index if not exists lineup_comments_lineup_idx  on lineup_comments (lineup_id);
create index if not exists votes_user_id_idx           on votes (user_id);
create index if not exists rankings_team_id_idx        on rankings (team_id);
create index if not exists rankings_user_team_idx      on rankings (user_id, team_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table teams           enable row level security;
alter table team_members    enable row level security;
alter table load_profiles   enable row level security;
alter table lineups         enable row level security;
alter table lineup_comments enable row level security;
alter table votes           enable row level security;
alter table rankings        enable row level security;

-- ============================================================
-- HELPER: reusable membership check (active member of a team)
-- Returns true when the calling user has an active row in team_members
-- for the given team_id.
-- ============================================================

create or replace function is_active_member(p_team_id uuid)
returns bool
language sql
security definer
stable
as $$
  select exists (
    select 1
    from team_members
    where team_id  = p_team_id
      and user_id  = auth.uid()
      and status   = 'active'
  )
$$;

-- ============================================================
-- HELPER: reusable coach check
-- Returns true when the calling user is the coach of the given team.
-- ============================================================

create or replace function is_team_coach(p_team_id uuid)
returns bool
language sql
security definer
stable
as $$
  select exists (
    select 1
    from teams
    where id       = p_team_id
      and coach_id = auth.uid()
  )
$$;

-- ============================================================
-- POLICIES: teams
-- ============================================================

-- Coaches own their team rows
create policy "coaches_all_on_teams"
  on teams for all
  using     (coach_id = auth.uid())
  with check (coach_id = auth.uid());

-- Active members can view the team they belong to
create policy "members_select_own_team"
  on teams for select
  using (is_active_member(id));

-- ============================================================
-- POLICIES: team_members
-- ============================================================

-- Coaches manage members of their teams
create policy "coaches_all_on_team_members"
  on team_members for all
  using     (is_team_coach(team_id))
  with check (is_team_coach(team_id));

-- Any user can view their own membership record (needed post-signup)
create policy "users_select_own_membership"
  on team_members for select
  using (user_id = auth.uid());

-- Any authenticated user can create their own pending membership
-- (triggered at sign-up when a team code is provided)
create policy "users_insert_own_pending_membership"
  on team_members for insert
  with check (
    user_id = auth.uid()
    and status = 'pending'
  );

-- ============================================================
-- POLICIES: load_profiles
-- ============================================================

create policy "coaches_all_on_load_profiles"
  on load_profiles for all
  using     (is_team_coach(team_id))
  with check (is_team_coach(team_id));

create policy "members_select_published_load_profiles"
  on load_profiles for select
  using (
    published = true
    and is_active_member(team_id)
  );

-- ============================================================
-- POLICIES: lineups
-- ============================================================

create policy "coaches_all_on_lineups"
  on lineups for all
  using     (is_team_coach(team_id))
  with check (is_team_coach(team_id));

create policy "members_select_published_lineups"
  on lineups for select
  using (
    published = true
    and is_active_member(team_id)
  );

-- ============================================================
-- POLICIES: lineup_comments
-- ============================================================

-- Coaches have full access to comments on their teams' lineups
create policy "coaches_all_on_lineup_comments"
  on lineup_comments for all
  using (
    exists (
      select 1
      from lineups
      where lineups.id      = lineup_comments.lineup_id
        and is_team_coach(lineups.team_id)
    )
  )
  with check (
    exists (
      select 1
      from lineups
      where lineups.id      = lineup_comments.lineup_id
        and is_team_coach(lineups.team_id)
    )
  );

-- Active members can read comments on lineups in their team
create policy "members_select_lineup_comments"
  on lineup_comments for select
  using (
    exists (
      select 1
      from lineups
      where lineups.id = lineup_comments.lineup_id
        and is_active_member(lineups.team_id)
    )
  );

-- Active members can post comments only when comments_enabled = true
create policy "members_insert_lineup_comments"
  on lineup_comments for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from lineups
      where lineups.id               = lineup_comments.lineup_id
        and lineups.comments_enabled = true
        and is_active_member(lineups.team_id)
    )
  );

-- Users may delete their own comments
create policy "users_delete_own_lineup_comments"
  on lineup_comments for delete
  using (user_id = auth.uid());

-- ============================================================
-- POLICIES: votes
-- ============================================================

-- Any authenticated user can read all votes (for showing results)
create policy "authenticated_select_votes"
  on votes for select
  using (auth.role() = 'authenticated');

-- Users can cast their own vote
create policy "users_insert_own_vote"
  on votes for insert
  with check (user_id = auth.uid());

-- Users can retract their own vote (to change it)
create policy "users_delete_own_vote"
  on votes for delete
  using (user_id = auth.uid());

-- ============================================================
-- POLICIES: rankings
-- ============================================================

create policy "coaches_all_on_rankings"
  on rankings for all
  using     (is_team_coach(team_id))
  with check (is_team_coach(team_id));

-- Active members can view rankings within their team
create policy "members_select_rankings"
  on rankings for select
  using (is_active_member(team_id));
