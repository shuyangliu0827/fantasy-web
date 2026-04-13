-- Add lightweight lineup post support metadata on insights
ALTER TABLE insights
  ADD COLUMN IF NOT EXISTS post_type text NOT NULL DEFAULT 'standard';

ALTER TABLE insights
  ADD COLUMN IF NOT EXISTS lineup_context jsonb;

CREATE INDEX IF NOT EXISTS idx_insights_post_type ON insights(post_type);
