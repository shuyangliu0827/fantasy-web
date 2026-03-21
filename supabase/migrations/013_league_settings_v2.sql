-- Migration 013: League Settings V2
-- Adds columns required for the production league settings system:
-- scoring_type, points_system, points_weights, logo_url, description, rules_locked
--
-- rules_locked is set automatically when a draft completes.
-- Competition rule fields are immutable once rules_locked = true.

ALTER TABLE leagues
  ADD COLUMN IF NOT EXISTS description        text,
  ADD COLUMN IF NOT EXISTS logo_url           text,
  ADD COLUMN IF NOT EXISTS scoring_type       varchar NOT NULL DEFAULT 'h2h_points',
  ADD COLUMN IF NOT EXISTS points_system      varchar,   -- 'espn_default' | 'custom' | null
  ADD COLUMN IF NOT EXISTS points_weights     jsonb,     -- custom weights; null unless points_system = 'custom'
  ADD COLUMN IF NOT EXISTS rules_locked       boolean NOT NULL DEFAULT false;

-- Backfill: default existing active/completed leagues to espn_default and lock their rules
UPDATE leagues
SET
  scoring_type  = 'h2h_points',
  points_system = 'espn_default',
  rules_locked  = true
WHERE status IN ('active', 'completed')
  AND rules_locked = false;

-- Backfill: pre-draft leagues get espn_default but remain unlocked
UPDATE leagues
SET
  scoring_type  = 'h2h_points',
  points_system = 'espn_default'
WHERE status NOT IN ('active', 'completed')
  AND points_system IS NULL;
