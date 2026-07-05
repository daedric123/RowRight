# RowRight — Project Handoff

## Overview

RowRight is a rowing team management web app for coaches and athletes. Coaches manage their roster, build trailer/boathouse load plans, and create and publish race/practice lineups. Athletes view published plans and lineups, comment on lineups, check rankings, vote on kit designs, and use training tools.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, React Router v6 |
| Backend / DB | Supabase (PostgreSQL + Auth + RLS) |
| Serverless functions | Netlify Functions (ES modules) |
| Payments | Stripe (per-seat subscription) |
| Styling | Custom CSS — dark theme, CSS variables, no UI framework |
| Deployment | Netlify |

---

## Environment Variables

### Frontend (`.env` — prefixed `VITE_`)
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_STRIPE_SEAT_PRICE_USD=        # display only, e.g. "5.00"
```

### Netlify Functions (`netlify.toml` env or Netlify dashboard)
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=         # service role — bypasses RLS server-side only
STRIPE_SECRET_KEY=
STRIPE_PRICE_ID=                   # recurring per-seat Stripe price ID
STRIPE_WEBHOOK_SECRET=
```

---

## Project Structure

```
src/
  App.jsx                  # Athlete app — all athlete tabs in one component
  main.jsx                 # Router, AuthProvider, all routes
  index.css                # All styles (CSS variables, component classes)
  lib/
    supabase.js            # Supabase client (anon key)
  context/
    AuthContext.jsx        # Auth state + role detection
  pages/
    CoachDashboard.jsx     # Coach home — Roster, Load Plans, Lineups tabs
    LineupEditPage.jsx     # Create / edit a lineup (/lineups/new, /lineups/:id/edit)
    LineupsPage.jsx        # Athlete-only lineup viewer — coaches redirect to dashboard
    CreateTeam.jsx         # First-run team creation for coaches
    Login.jsx / SignUp.jsx # Auth pages
    PendingApproval.jsx    # Shown to athletes awaiting coach approval
    RankingsPage.jsx       # Team rankings viewer
  components/
    LineupBuilder.jsx      # Drag-and-drop seat assignment (used in LineupEditPage)
    TrailerLoader.jsx      # Drag-and-drop trailer grid (used in CoachDashboard)
    SeatGrid.jsx           # Read-only seat display — shared between dashboard & lineups
    CommentSection.jsx     # Lineup comments — shared between dashboard & lineups
    KitPreview.jsx         # Kit design voting preview
    ProtectedRoute.jsx     # Auth guard wrapper
netlify/
  functions/
    create-checkout.js     # POST → create Stripe Checkout session
    join-team.js           # POST → insert pending team_members row (service role)
    update-seats.js        # POST → adjust Stripe subscription quantity ±1
    stripe-webhook.js      # Stripe webhook handler
supabase/
  migrations/              # SQL files to run in order in Supabase SQL editor
```

---

## Database Schema

### Tables

#### `teams`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | |
| `code` | text unique | Join code athletes enter |
| `coach_id` | uuid → auth.users | |
| `stripe_subscription_id` | text | Null if no subscription |
| `seat_count` | int | Mirrors Stripe subscription quantity |

#### `team_members`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `team_id` | uuid → teams | |
| `user_id` | uuid → auth.users | |
| `role` | text | `'athlete'` or `'cox'` |
| `status` | text | `'pending'` → `'active'` (or `'removed'`) |
| `approved_at` | timestamptz | Set when coach approves |
| `full_name` | text | Stored at join time (migration 003) |
| `email` | text | Stored at join time (migration 003) |

#### `profiles`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK = auth.users.id | |
| `full_name` | text | Updated on profile save |
| `email` | text | |

> **Important:** Full names come from two sources — `profiles` table (authoritative) and `team_members.full_name` (fallback). All member fetches should merge: `profileMap[r.user_id]?.full_name || r.full_name`.

#### `boats`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `team_id` | uuid → teams | |
| `name` | text | e.g. "Varsity 8" |
| `type` | text | `'8+'`, `'4+'`, `'4-'`, `'4x'`, `'2x'`, `'2-'`, `'1x'` |

#### `load_profiles`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `team_id` | uuid → teams | |
| `created_by` | uuid → auth.users | |
| `name` | text | |
| `type` | text | `'trailer'` or `'boathouse'` |
| `layout_data` | jsonb | `{ rows, cols, placements, boats? }` |
| `published` | bool | Athletes see published plans only |

> **Backward compat:** Old plans embed a `boats` array inside `layout_data`. New plans use UUIDs from the `boats` table. When rendering, use `loadedLayout?.boats?.length ? loadedLayout.boats : boats` to handle both.

#### `lineups`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `team_id` | uuid → teams | |
| `name` | text | |
| `type` | text | `'regatta'` or `'practice'` |
| `event_name` | text | Optional |
| `event_date` | date | Optional |
| `lineup_data` | jsonb | `{ boatType, boatId?, seats: { "Stroke": userId, "Bow": userId, … } }` |
| `published` | bool | |
| `comments_enabled` | bool | |

#### `lineup_comments`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `lineup_id` | uuid → lineups | |
| `user_id` | uuid → auth.users | |
| `body` | text | |

#### `votes`
For kit-design voting. `unique(user_id, design_key)` enforces one vote per design.

#### `rankings`
Per-user, per-team, per-category score. Coaches write; athletes read.

### RLS helpers
Two reusable security-definer functions live in the DB:
- `is_active_member(p_team_id uuid)` — true if calling user has active membership
- `is_team_coach(p_team_id uuid)` — true if calling user is coach of that team

These are used in all RLS policies. If you add a new table that scopes to teams, use these.

---

## Auth & Roles

- Supabase Auth (email/password).
- Role is determined at runtime by checking `teams.coach_id = user.id` (Coach) or `team_members.user_id = user.id` (Athlete/Cox).
- `AuthContext` exposes `{ user, session, role }`. Role is `null` while loading, `'Coach'` or `'Athlete'`.
- Athletes who join but aren't approved yet are redirected to `/pending`.
- Coaches who haven't created a team yet are shown the create-team screen.

---

## Key Routing

| Path | Component | Who |
|---|---|---|
| `/` | Redirects → `/app` or `/login` | All |
| `/login` | Login | Unauthenticated |
| `/signup` | SignUp | Unauthenticated |
| `/app` | App.jsx | Athletes |
| `/dashboard` | CoachDashboard | Coaches |
| `/dashboard?tab=lineups` | CoachDashboard (lineups tab pre-selected) | Coaches |
| `/lineups/new` | LineupEditPage | Coaches |
| `/lineups/:id/edit` | LineupEditPage | Coaches |
| `/lineups` | LineupsPage (redirects coaches → `/dashboard?tab=lineups`) | Athletes only |
| `/create-team` | CreateTeam | Coaches |
| `/pending` | PendingApproval | Athletes awaiting approval |
| `/rankings` | RankingsPage | All |

---

## Athlete App (`App.jsx`) Tabs

| Tab id | Label | What it shows |
|---|---|---|
| `predictor` | 2K Predictor | Interactive canvas pace graph + saved split profiles |
| `calculator` | Split Calc | Simple split/time/distance calculator |
| `trailer` | Trailer Plan | Read-only published trailer load plan |
| `kit` | Kit Vote | Kit design voting |
| `rankings` | Rankings | Team rankings table |
| `mylineups` | My Lineups | Lineups the athlete is assigned to + comments |

Split profiles (2K Predictor) are persisted to `localStorage` under the key `rr_split_profiles`.

---

## Coach Dashboard (`CoachDashboard.jsx`) Tabs

| Tab | What it does |
|---|---|
| Roster | Pending approval queue + active member list with REMOVE |
| Load Plans | TrailerLoader builder + saved profiles list (Load / Publish / DEL) |
| Lineups | Lineup list with PREVIEW / COMMENTS toggles, Publish, Edit, DEL |

The `?tab=` query param is read on mount so that navigating to `/dashboard?tab=lineups` opens the lineups tab directly — used by the back button in LineupEditPage.

---

## Serverless Functions

### `POST /join-team`
Inserts a pending `team_members` row using the service role key.  
Body: `{ userId, teamCode, role, fullName, email }`  
Handles duplicate joins (23505) gracefully.

### `POST /create-checkout`
Creates a Stripe Checkout session for a per-seat subscription.  
Body: `{ coach_id, seat_count }`

### `POST /update-seats`
Adjusts the Stripe subscription quantity by `delta` (+1 or -1) when a coach approves or removes a member. Updates `teams.seat_count` in Supabase.  
Body: `{ coach_id, delta }`

### `POST /stripe-webhook`
Handles Stripe webhook events (subscription updates, etc.).

---

## Shared Components

### `SeatGrid`
Read-only seat display. Props: `boatType`, `seats` (object mapping seat label → userId), `members` (array with `user_id`, `full_name`, `role`).  
Used in: CoachDashboard lineup preview, LineupsPage lineup cards, App.jsx My Lineups tab.

### `CommentSection`
Lineup comment thread. Props: `lineupId`, `user`, `role`.  
Coaches see comments read-only. Athletes can post when `comments_enabled`.  
Used in: CoachDashboard, LineupsPage, App.jsx My Lineups tab.

### `TrailerLoader`
Full drag-and-drop trailer grid. Accepts `readOnly` prop for athlete view.  
Old plans stored boats inside `layout_data.boats`; new plans reference team boats by UUID — handle both when passing the `boats` prop.

### `LineupBuilder`
Drag-and-drop seat assignment form. Used only in LineupEditPage.

---

## Known Patterns & Gotchas

**Full name resolution** — Always merge `profiles` table onto `team_members` rows. Seat occupants who are not active team members (e.g. from other teams or past members) need synthetic member entries built from a profiles lookup across all seat user_ids.

**Lineup seat data structure** — `lineup_data.seats` is a plain object keyed by seat label: `{ "Stroke": "uuid", "Bow": "uuid" }`. The seat labels come from the `BOAT_SEATS` constant defined in both `LineupBuilder` and `SeatGrid` (and locally in `LineupsPage`).

**Canvas graph redraw** — The 2K predictor canvas depends on `splitPoints` both directly in the `useEffect` dep array AND via `drawGraph`'s `useCallback` deps. If you touch the drawing pipeline, keep `splitPoints` as an explicit dep on the drawing `useEffect`.

**Stripe is optional** — If `teams.stripe_subscription_id` is null, `update-seats` returns `{ skipped: true }` without error. The seat count stat is hidden in the UI when there's no subscription.

**Migration ordering** — Migrations are numbered but not auto-run. Apply them manually in Supabase SQL Editor in order. There are some duplicated 002/003 numbers (branched experiments) — `002_fix_rls_policies.sql` supersedes `002_fix_athlete_rls.sql`; `003_add_member_profile_fields.sql` is the right 003 to run.

---

## Running Locally

```bash
npm install
npm run dev          # Vite dev server on http://localhost:5173
```

For serverless functions, use the Netlify CLI:
```bash
npm install -g netlify-cli
netlify dev          # proxies functions + Vite on http://localhost:8888
```

Required `.env` file in project root:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_STRIPE_SEAT_PRICE_USD=5.00
```
