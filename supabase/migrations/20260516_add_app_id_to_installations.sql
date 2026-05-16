-- Add github_app_id to github_app_installations to support multi-app environments (dev/prod)
ALTER TABLE github_app_installations 
ADD COLUMN IF NOT EXISTS github_app_id TEXT;

-- Index for filtering by app_id
CREATE INDEX IF NOT EXISTS idx_github_app_installations_app_id 
ON github_app_installations(github_app_id);

-- Optional: If you want to backfill existing records with the production app ID, 
-- you can do so manually, but they will be updated automatically on next install.
