-- Migration 011: Add task_type column to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type TEXT DEFAULT 'regular';
