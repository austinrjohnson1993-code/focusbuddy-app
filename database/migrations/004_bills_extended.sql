-- FocusBuddy migration 004: bills extended columns + income on profiles
-- All additive with IF NOT EXISTS — safe to run on existing data

ALTER TABLE bills ADD COLUMN IF NOT EXISTS bill_type text DEFAULT 'bill';
ALTER TABLE bills ADD COLUMN IF NOT EXISTS interest_rate numeric;

-- Income columns already added in 003 — included here with IF NOT EXISTS for safety
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS monthly_income numeric;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS income_frequency text DEFAULT 'monthly';
