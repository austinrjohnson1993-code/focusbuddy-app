-- Add habit_type column to habits table
ALTER TABLE habits
ADD COLUMN IF NOT EXISTS habit_type TEXT DEFAULT 'build' CHECK (habit_type IN ('build', 'break'));
