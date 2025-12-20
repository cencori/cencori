-- Migration: Add Request Configuration to Projects
-- Description: Add timeout, retries, and fallback provider settings
-- Created: 2025-12-20

-- Add request configuration columns to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS request_timeout_seconds INTEGER DEFAULT 30;

ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3;

ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS fallback_provider TEXT DEFAULT NULL;

-- Add constraint for valid fallback providers
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'projects_fallback_provider_check'
    ) THEN
        ALTER TABLE projects ADD CONSTRAINT projects_fallback_provider_check
            CHECK (fallback_provider IS NULL OR fallback_provider IN ('openai', 'anthropic', 'google'));
    END IF;
END $$;

-- Add helpful comments
COMMENT ON COLUMN projects.request_timeout_seconds IS 'Maximum time in seconds to wait for AI provider response (default: 30)';
COMMENT ON COLUMN projects.max_retries IS 'Number of retry attempts on transient failures (default: 3)';
COMMENT ON COLUMN projects.fallback_provider IS 'Alternative AI provider to use if primary fails (null = no fallback)';
