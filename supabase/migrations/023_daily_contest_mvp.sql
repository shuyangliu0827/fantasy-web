-- Daily Contest MVP tables + FK fix for user_lineups.user_id

create extension if not exists "uuid-ossp";

create table if not exists daily_contests (
  id uuid primary key default uuid_generate_v4(),
  contest_date date not null unique,
  status varchar not null default 'open',
  player_pool jsonb not null default '[]'::jsonb,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_lineups (
  id uuid primary key default uuid_generate_v4(),
  contest_id uuid not null references daily_contests(id) on delete cascade,
  user_id uuid not null,
  player_ids jsonb not null default '[]'::jsonb,
  projected_fpts numeric not null default 0,
  is_submitted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contest_id, user_id)
);

-- If an old FK exists (often pointing at auth.users), replace it with public.users(id).
do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'user_lineups_user_id_fkey'
      and table_name = 'user_lineups'
  ) then
    alter table user_lineups drop constraint user_lineups_user_id_fkey;
  end if;
end $$;

alter table user_lineups
  add constraint user_lineups_user_id_fkey
  foreign key (user_id) references users(id) on delete cascade;

create index if not exists idx_daily_contests_date on daily_contests(contest_date);
create index if not exists idx_user_lineups_contest on user_lineups(contest_id);
create index if not exists idx_user_lineups_user on user_lineups(user_id);

alter table daily_contests enable row level security;
alter table user_lineups enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'daily_contests' and policyname = 'daily_contests_open'
  ) then
    create policy daily_contests_open on daily_contests for all using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_lineups' and policyname = 'user_lineups_open'
  ) then
    create policy user_lineups_open on user_lineups for all using (true) with check (true);
  end if;
end $$;
