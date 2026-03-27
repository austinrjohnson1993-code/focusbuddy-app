-- Cinis migration 002: persona system + check-in columns
-- Run this in Supabase SQL Editor if these columns don't already exist

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS persona_blend text[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS persona_voice text DEFAULT 'female';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS persona_set boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS next_checkin_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_checkin_message text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_checkin_at timestamptz;
