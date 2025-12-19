-- Migration: Add Region Column to Projects
-- Description: Add region field to projects table for edge deployment selection
-- Created: 2025-12-19

-- Add region column to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'americas';

-- Drop constraint if it exists (idempotent)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'projects_region_check'
    ) THEN
        ALTER TABLE projects DROP CONSTRAINT projects_region_check;
    END IF;
END $$;

-- Add constraint for valid region values
-- General regions route to nearest edge within that continent
-- Specific regions route to exact edge location
ALTER TABLE projects 
ADD CONSTRAINT projects_region_check 
CHECK (region IN (
    -- General continent-level regions (auto-routing within continent)
    'americas',       -- Routes to nearest US/CA/SA edge
    'europe',         -- Routes to nearest EU edge  
    'asia-pacific',   -- Routes to nearest AP edge
    -- Specific edge regions
    'us-east-1',      -- US East (N. Virginia)
    'us-west-1',      -- US West (N. California)
    'us-west-2',      -- US West (Oregon)
    'ca-central-1',   -- Canada (Central)
    'eu-west-1',      -- Europe (Ireland)
    'eu-central-1',   -- Europe (Frankfurt)
    'ap-southeast-1', -- Asia Pacific (Singapore)
    'ap-northeast-1', -- Asia Pacific (Tokyo)
    'ap-south-1',     -- Asia Pacific (Mumbai)
    'sa-east-1',      -- South America (São Paulo)
    'me-south-1',     -- Middle East (Bahrain)
    'af-south-1'      -- Africa (Cape Town)
));

-- Create index for region queries
CREATE INDEX IF NOT EXISTS idx_projects_region ON projects(region);

-- Add helpful comment
COMMENT ON COLUMN projects.region IS 'Edge deployment region for AI request routing. General regions (americas, europe, asia-pacific) auto-route to nearest edge. Specific regions route to exact location.';
