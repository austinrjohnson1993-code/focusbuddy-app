-- Migration 012: Add estimated_minutes column to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER DEFAULT NULL;
