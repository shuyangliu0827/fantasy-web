-- =============================================
-- Fantasy Basketball Platform - Migration 001
-- Full schema wipe and rebuild from schema.dbml
-- =============================================

-- 1. Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 2. DROP all old tables (dependency order)
-- =============================================

DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS insights CASCADE;
DROP TABLE IF EXISTS transaction_players CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS matchups CASCADE;
DROP TABLE IF EXISTS draft_picks CASCADE;
DROP TABLE IF EXISTS drafts CASCADE;
DROP TABLE IF EXISTS roster_players CASCADE;
DROP TABLE IF EXISTS fantasy_teams CASCADE;
DROP TABLE IF EXISTS league_members CASCADE;
DROP TABLE IF EXISTS leagues CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS nba_contracts CASCADE;
DROP TABLE IF EXISTS nba_player_stats CASCADE;
DROP TABLE IF EXISTS nba_players CASCADE;
DROP TABLE IF EXISTS nba_teams CASCADE;

-- Legacy tables (may not exist, CASCADE handles deps)
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS draft_settings CASCADE;
DROP TABLE IF EXISTS team_rosters CASCADE;

-- =============================================
-- 3. CREATE all new tables (dependency order)
-- =============================================

-- --- USERS ---

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email varchar NOT NULL UNIQUE,
  username varchar NOT NULL UNIQUE,
  name varchar NOT NULL,
  avatar_url varchar,
  created_at timestamp DEFAULT now()
);

-- --- NBA DATA CACHE ---

CREATE TABLE nba_teams (
  id int PRIMARY KEY,
  abbreviation varchar NOT NULL,
  full_name varchar NOT NULL,
  city varchar NOT NULL,
  conference varchar NOT NULL,
  division varchar NOT NULL,
  updated_at timestamp DEFAULT now()
);

CREATE TABLE nba_players (
  id int PRIMARY KEY,
  first_name varchar NOT NULL,
  last_name varchar NOT NULL,
  team_id int NOT NULL REFERENCES nba_teams(id),
  position varchar NOT NULL,
  height varchar,
  weight varchar,
  jersey_number varchar,
  college varchar,
  country varchar,
  draft_year int,
  draft_round int,
  draft_number int,
  updated_at timestamp DEFAULT now()
);

CREATE TABLE nba_player_stats (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id int NOT NULL REFERENCES nba_players(id),
  season int NOT NULL,
  games_played int,
  ppg decimal,
  rpg decimal,
  apg decimal,
  spg decimal,
  bpg decimal,
  fg_pct decimal,
  ft_pct decimal,
  fg3_pct decimal,
  tov decimal,
  minutes decimal,
  updated_at timestamp DEFAULT now(),
  UNIQUE (player_id, season)
);

CREATE TABLE nba_contracts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id int NOT NULL REFERENCES nba_players(id),
  team_id int NOT NULL REFERENCES nba_teams(id),
  season int NOT NULL,
  base_salary int,
  cap_hit int,
  total_cash int,
  updated_at timestamp DEFAULT now(),
  UNIQUE (player_id, season)
);

-- --- FANTASY LEAGUE CORE ---

CREATE TABLE leagues (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name varchar NOT NULL,
  slug varchar NOT NULL UNIQUE,
  commissioner_id uuid NOT NULL REFERENCES users(id),
  season varchar NOT NULL,
  status varchar NOT NULL DEFAULT 'draft_pending',
  visibility varchar NOT NULL DEFAULT 'public',
  max_teams int NOT NULL DEFAULT 10,
  draft_type varchar NOT NULL DEFAULT 'snake',
  draft_date timestamp,
  salary_cap int,
  scoring_weights jsonb NOT NULL DEFAULT '{"pts":1,"reb":1,"ast":1,"stl":2,"blk":2,"fg3":1,"tov":-1}',
  roster_config jsonb NOT NULL DEFAULT '{"pg":1,"sg":1,"sf":1,"pf":1,"c":1,"g":1,"f":1,"util":3,"bench":3,"ir":1}',
  trade_deadline date,
  waiver_type varchar,
  playoff_teams int,
  playoff_start_week int,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE league_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id uuid NOT NULL REFERENCES leagues(id),
  user_id uuid NOT NULL REFERENCES users(id),
  role varchar NOT NULL DEFAULT 'member',
  joined_at timestamp DEFAULT now(),
  UNIQUE (league_id, user_id)
);

-- --- FANTASY TEAMS & ROSTERS ---

CREATE TABLE fantasy_teams (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id uuid NOT NULL REFERENCES leagues(id),
  user_id uuid NOT NULL REFERENCES users(id),
  name varchar NOT NULL,
  draft_position int,
  salary_used int DEFAULT 0,
  wins int DEFAULT 0,
  losses int DEFAULT 0,
  ties int DEFAULT 0,
  points_for decimal DEFAULT 0,
  points_against decimal DEFAULT 0,
  created_at timestamp DEFAULT now(),
  UNIQUE (league_id, user_id)
);

CREATE TABLE roster_players (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id uuid NOT NULL REFERENCES fantasy_teams(id),
  player_id int NOT NULL REFERENCES nba_players(id),
  slot varchar NOT NULL,
  acquired_via varchar NOT NULL,
  acquired_at timestamp DEFAULT now(),
  is_active boolean DEFAULT true,
  UNIQUE (team_id, player_id)
);

-- --- DRAFT SYSTEM ---

CREATE TABLE drafts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id uuid NOT NULL UNIQUE REFERENCES leagues(id),
  type varchar NOT NULL,
  seconds_per_pick int DEFAULT 90,
  total_rounds int NOT NULL,
  current_round int DEFAULT 1,
  current_pick int DEFAULT 1,
  is_paused boolean DEFAULT false,
  started_at timestamp,
  completed_at timestamp
);

CREATE TABLE draft_picks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  draft_id uuid NOT NULL REFERENCES drafts(id),
  team_id uuid NOT NULL REFERENCES fantasy_teams(id),
  player_id int NOT NULL REFERENCES nba_players(id),
  round int NOT NULL,
  pick_number int NOT NULL,
  overall_pick int NOT NULL,
  salary int,
  picked_at timestamp DEFAULT now()
);

-- --- SEASON & MATCHUPS ---

CREATE TABLE matchups (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id uuid NOT NULL REFERENCES leagues(id),
  week int NOT NULL,
  home_team_id uuid NOT NULL REFERENCES fantasy_teams(id),
  away_team_id uuid NOT NULL REFERENCES fantasy_teams(id),
  home_score decimal,
  away_score decimal,
  winner_id uuid REFERENCES fantasy_teams(id),
  status varchar NOT NULL DEFAULT 'scheduled',
  start_date date NOT NULL,
  end_date date NOT NULL
);

-- --- TRANSACTIONS ---

CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id uuid NOT NULL REFERENCES leagues(id),
  type varchar NOT NULL,
  status varchar NOT NULL DEFAULT 'pending',
  initiated_by uuid NOT NULL REFERENCES users(id),
  processed_at timestamp,
  created_at timestamp DEFAULT now()
);

CREATE TABLE transaction_players (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id uuid NOT NULL REFERENCES transactions(id),
  player_id int NOT NULL REFERENCES nba_players(id),
  from_team_id uuid REFERENCES fantasy_teams(id),
  to_team_id uuid REFERENCES fantasy_teams(id),
  salary int
);

-- --- COMMUNITY ---

CREATE TABLE insights (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id uuid NOT NULL REFERENCES users(id),
  league_id uuid REFERENCES leagues(id),
  title varchar NOT NULL,
  body text NOT NULL,
  cover_url varchar,
  images text[],
  tags text[],
  heat int DEFAULT 0,
  created_at timestamp DEFAULT now()
);

CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  insight_id uuid NOT NULL REFERENCES insights(id),
  author_id uuid NOT NULL REFERENCES users(id),
  body text NOT NULL,
  created_at timestamp DEFAULT now()
);

-- =============================================
-- 4. Indexes
-- =============================================

CREATE INDEX idx_nba_players_team ON nba_players(team_id);
CREATE INDEX idx_league_members_league ON league_members(league_id);
CREATE INDEX idx_league_members_user ON league_members(user_id);
CREATE INDEX idx_fantasy_teams_league ON fantasy_teams(league_id);
CREATE INDEX idx_fantasy_teams_user ON fantasy_teams(user_id);
CREATE INDEX idx_roster_players_team ON roster_players(team_id);
CREATE INDEX idx_draft_picks_draft ON draft_picks(draft_id);
CREATE INDEX idx_draft_picks_team ON draft_picks(team_id);
CREATE INDEX idx_matchups_league ON matchups(league_id);
CREATE INDEX idx_matchups_week ON matchups(league_id, week);
CREATE INDEX idx_transactions_league ON transactions(league_id);
CREATE INDEX idx_transaction_players_tx ON transaction_players(transaction_id);
CREATE INDEX idx_insights_author ON insights(author_id);
CREATE INDEX idx_insights_league ON insights(league_id);
CREATE INDEX idx_comments_insight ON comments(insight_id);

-- =============================================
-- 5. Row Level Security — enable + open policies
--    (app uses custom auth via anon key, not Supabase Auth)
-- =============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE nba_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE nba_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE nba_player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE nba_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchups ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Open policies (allow all operations via anon key)
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'users', 'nba_teams', 'nba_players', 'nba_player_stats', 'nba_contracts',
    'leagues', 'league_members', 'fantasy_teams', 'roster_players',
    'drafts', 'draft_picks', 'matchups', 'transactions', 'transaction_players',
    'insights', 'comments'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('CREATE POLICY "allow_all_select_%s" ON %I FOR SELECT USING (true)', tbl, tbl);
    EXECUTE format('CREATE POLICY "allow_all_insert_%s" ON %I FOR INSERT WITH CHECK (true)', tbl, tbl);
    EXECUTE format('CREATE POLICY "allow_all_update_%s" ON %I FOR UPDATE USING (true) WITH CHECK (true)', tbl, tbl);
    EXECUTE format('CREATE POLICY "allow_all_delete_%s" ON %I FOR DELETE USING (true)', tbl, tbl);
  END LOOP;
END $$;
