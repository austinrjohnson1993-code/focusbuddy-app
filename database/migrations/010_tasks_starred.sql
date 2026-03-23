-- Migration 010: Add starred column to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS starred BOOLEAN DEFAULT false;
