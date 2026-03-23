-- 015: Add display_name and bio columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name varchar;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text;
