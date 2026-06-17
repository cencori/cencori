-- Add fallback_model column to project_settings
-- Allows users to override the auto-mapped fallback model

ALTER TABLE project_settings
ADD COLUMN IF NOT EXISTS fallback_model TEXT;
