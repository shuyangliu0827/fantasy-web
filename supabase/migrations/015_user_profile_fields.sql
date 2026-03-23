-- 015: Add bio column to users table for profile customization
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text;
