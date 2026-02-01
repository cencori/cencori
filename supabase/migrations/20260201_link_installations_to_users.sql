-- Add installed_by_user_id to github_app_installations to link installations to the user who installed/updated them
-- This serves as a fallback for when the user doesn't have an internal organization corresponding to the GitHub organization

ALTER TABLE github_app_installations 
ADD COLUMN IF NOT EXISTS installed_by_user_id UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_github_app_installations_user_id 
ON github_app_installations(installed_by_user_id);
