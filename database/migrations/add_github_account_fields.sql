-- Add GitHub account metadata to github_app_installations table
ALTER TABLE public.github_app_installations
ADD COLUMN IF NOT EXISTS github_account_type VARCHAR(20),
ADD COLUMN IF NOT EXISTS github_account_login VARCHAR(255),
ADD COLUMN IF NOT EXISTS github_account_id BIGINT,
ADD COLUMN IF NOT EXISTS github_account_name TEXT;

-- Create index for faster lookups by GitHub account
CREATE INDEX IF NOT EXISTS idx_github_installations_account 
ON public.github_app_installations(github_account_login);

-- Add helpful comments
COMMENT ON COLUMN public.github_app_installations.github_account_type IS 'Type of GitHub account: user or organization';
COMMENT ON COLUMN public.github_app_installations.github_account_login IS 'GitHub username or organization slug';
COMMENT ON COLUMN public.github_app_installations.github_account_id IS 'GitHub account or organization ID';
COMMENT ON COLUMN public.github_app_installations.github_account_name IS 'Display name of the GitHub account';
