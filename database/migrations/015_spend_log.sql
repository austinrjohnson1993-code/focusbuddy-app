-- Cinis migration 015: spend_log table for daily spending tracking
-- Enables coach to see daily spending and calculate actual daily budget remaining

CREATE TABLE IF NOT EXISTS spend_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  category text,
  description text,
  impulse boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE spend_log ENABLE ROW LEVEL SECURITY;

-- RLS: users can only see their own spending
CREATE POLICY spend_log_select ON spend_log
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY spend_log_insert ON spend_log
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_spend_log_user_created ON spend_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spend_log_user_date ON spend_log(user_id, DATE(created_at));
