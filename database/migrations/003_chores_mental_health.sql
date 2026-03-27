-- Cinis migration 003: chores, mental health context, and income columns
-- All additive with IF NOT EXISTS — safe to run on existing data

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chore_preset text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mental_health_context text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS monthly_income numeric;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS income_frequency text;
