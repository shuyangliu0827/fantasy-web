-- 040_basketball_identity_visibility.sql
--
-- Per-(user, community basketball identity) visibility flag for the public
-- profile "社区联赛身份" section. Default = hidden; the profile page only
-- exposes rows where the user has explicitly opted in.
--
-- identity_type semantics for identity_ref_id:
--   league_admin  → basketball_league_admins.id
--   team_manager  → basketball_league_members.id
--   player        → basketball_players.id
--
-- Access control matches the rest of basketball_*: permissive RLS, real
-- enforcement in API handlers under lib/basketball/access.ts.

create table if not exists basketball_identity_visibility (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  identity_type text not null check (identity_type in ('league_admin','team_manager','player')),
  identity_ref_id uuid not null,
  visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, identity_type, identity_ref_id)
);

create index if not exists idx_biv_user on basketball_identity_visibility (user_id);

alter table basketball_identity_visibility enable row level security;

drop policy if exists allow_all on basketball_identity_visibility;
create policy allow_all on basketball_identity_visibility
  for all using (true) with check (true);
