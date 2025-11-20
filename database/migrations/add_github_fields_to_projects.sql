-- Add GitHub-related columns to projects table
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS github_repo_id BIGINT UNIQUE,
ADD COLUMN IF NOT EXISTS github_repo_full_name TEXT,
ADD COLUMN IF NOT EXISTS github_repo_url TEXT;

-- Create index on github_repo_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_projects_github_repo_id ON public.projects(github_repo_id);

-- Add comment to explain the constraint
COMMENT ON COLUMN public.projects.github_repo_id IS 'Unique GitHub repository ID to prevent duplicate imports';
