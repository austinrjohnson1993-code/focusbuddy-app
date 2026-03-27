-- Cinis migration 013: checkin_logs table + checkin_mode on profiles
-- Creates full conversation logging for check-in exchanges

-- Create checkin_logs table
CREATE TABLE IF NOT EXISTS checkin_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL, -- 'user' or 'assistant'
  content text NOT NULL,
  persona_blend text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT checkin_logs_role_check CHECK (role IN ('user', 'assistant'))
);

-- Add checkin_mode column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS checkin_mode text DEFAULT 'voice';

-- Enable RLS on checkin_logs
ALTER TABLE checkin_logs ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only see their own checkin logs
CREATE POLICY checkin_logs_select ON checkin_logs
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY checkin_logs_insert ON checkin_logs
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Index for fast lookups by user and date
CREATE INDEX IF NOT EXISTS idx_checkin_logs_user_created ON checkin_logs(user_id, created_at DESC);
