-- Add check-in preference columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS checkin_preference TEXT,
ADD COLUMN IF NOT EXISTS morning_time TEXT DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS midday_time TEXT DEFAULT '12:00',
ADD COLUMN IF NOT EXISTS evening_time TEXT DEFAULT '21:00';
