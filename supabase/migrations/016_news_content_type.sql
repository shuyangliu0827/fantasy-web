-- Add content_type to insights to separate community posts from news
ALTER TABLE insights ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'community';

-- Index for fast filtering by content_type
CREATE INDEX IF NOT EXISTS idx_insights_content_type ON insights(content_type);

-- Add can_publish_news flag to users (default false, manually set for admins/editors)
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_publish_news boolean NOT NULL DEFAULT false;
