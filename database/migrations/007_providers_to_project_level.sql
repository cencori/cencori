-- Migration: Move Custom Providers from Organization to Project Level
-- Description: Changes custom_providers to be scoped per-project instead of per-organization
-- Created: 2025-12-21

-- Step 1: Add project_id column
ALTER TABLE custom_providers ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;

-- Step 2: Migrate existing data - associate with first project of each org (run manually if needed)
-- UPDATE custom_providers cp
-- SET project_id = (
--   SELECT p.id FROM projects p 
--   WHERE p.organization_id = cp.organization_id 
--   ORDER BY p.created_at ASC 
--   LIMIT 1
-- );

-- Step 3: Drop the old foreign key and column (after data migration)
-- ALTER TABLE custom_providers DROP CONSTRAINT IF EXISTS custom_providers_organization_id_fkey;
-- ALTER TABLE custom_providers DROP COLUMN IF EXISTS organization_id;

-- Step 4: Add unique constraint for project-level
ALTER TABLE custom_providers DROP CONSTRAINT IF EXISTS custom_providers_organization_id_name_key;
ALTER TABLE custom_providers ADD CONSTRAINT custom_providers_project_id_name_key UNIQUE (project_id, name);

-- Step 5: Create new index
DROP INDEX IF EXISTS idx_custom_providers_org;
CREATE INDEX IF NOT EXISTS idx_custom_providers_project ON custom_providers(project_id, is_active);

-- Update comments
COMMENT ON TABLE custom_providers IS 'Project-scoped custom AI provider endpoints';
