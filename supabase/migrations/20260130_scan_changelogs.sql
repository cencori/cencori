-- Scan changelogs table for storing generated changelogs
CREATE TABLE IF NOT EXISTS scan_changelogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES scan_projects(id) ON DELETE CASCADE,
    title TEXT, -- Optional title like "v1.2.0" or auto-generated date range
    markdown TEXT NOT NULL, -- The generated changelog content
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    commit_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups by project
CREATE INDEX IF NOT EXISTS idx_scan_changelogs_project_id ON scan_changelogs(project_id);

-- Index for ordering by date
CREATE INDEX IF NOT EXISTS idx_scan_changelogs_created_at ON scan_changelogs(created_at DESC);

-- RLS policies
ALTER TABLE scan_changelogs ENABLE ROW LEVEL SECURITY;

-- Users can view changelogs for their projects
CREATE POLICY "Users can view own project changelogs" ON scan_changelogs
    FOR SELECT
    USING (
        project_id IN (
            SELECT id FROM scan_projects WHERE user_id = auth.uid()
        )
    );

-- Users can insert changelogs for their projects
CREATE POLICY "Users can insert own project changelogs" ON scan_changelogs
    FOR INSERT
    WITH CHECK (
        project_id IN (
            SELECT id FROM scan_projects WHERE user_id = auth.uid()
        )
    );

-- Users can delete changelogs for their projects
CREATE POLICY "Users can delete own project changelogs" ON scan_changelogs
    FOR DELETE
    USING (
        project_id IN (
            SELECT id FROM scan_projects WHERE user_id = auth.uid()
        )
    );
