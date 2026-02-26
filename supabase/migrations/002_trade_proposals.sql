-- =============================================
-- Migration 002: Trade Proposals Table
-- Moves trades from localStorage to Supabase
-- so both trading parties can see proposals
-- =============================================

CREATE TABLE trade_proposals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id uuid NOT NULL REFERENCES leagues(id),
  from_team_id uuid NOT NULL REFERENCES fantasy_teams(id),
  from_team_name varchar NOT NULL,
  to_team_id uuid NOT NULL REFERENCES fantasy_teams(id),
  to_team_name varchar NOT NULL,
  offered_player_ids text[] NOT NULL,
  requested_player_ids text[] NOT NULL,
  message text,
  status varchar NOT NULL DEFAULT 'pending',
  created_at timestamp DEFAULT now(),
  resolved_at timestamp
);

-- Indexes
CREATE INDEX idx_trade_proposals_league ON trade_proposals(league_id);
CREATE INDEX idx_trade_proposals_to_team ON trade_proposals(to_team_id);
CREATE INDEX idx_trade_proposals_from_team ON trade_proposals(from_team_id);
CREATE INDEX idx_trade_proposals_status ON trade_proposals(status);

-- RLS
ALTER TABLE trade_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_select_trade_proposals" ON trade_proposals FOR SELECT USING (true);
CREATE POLICY "allow_all_insert_trade_proposals" ON trade_proposals FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_all_update_trade_proposals" ON trade_proposals FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_delete_trade_proposals" ON trade_proposals FOR DELETE USING (true);
