-- Internal Task Platform
-- Cross-functional task management for Engineering, Sales, Marketing, Product, Ops

-- ─── Tasks ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS internal_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    department TEXT NOT NULL CHECK (department IN ('engineering', 'sales', 'marketing', 'product', 'operations')),
    status TEXT NOT NULL DEFAULT 'backlog' CHECK (status IN ('backlog', 'todo', 'in_progress', 'done')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    assignee_email TEXT,
    due_date DATE,
    tags TEXT[] DEFAULT '{}',
    position INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_internal_tasks_department ON internal_tasks(department);
CREATE INDEX idx_internal_tasks_status ON internal_tasks(status);
CREATE INDEX idx_internal_tasks_assignee ON internal_tasks(assignee_email);
CREATE INDEX idx_internal_tasks_priority ON internal_tasks(priority);

-- ─── Comments ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS internal_task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES internal_tasks(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    author_email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_internal_task_comments_task ON internal_task_comments(task_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE internal_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_task_comments ENABLE ROW LEVEL SECURITY;

-- Tasks: @cencori.com users can do everything
CREATE POLICY "cencori_tasks_select" ON internal_tasks
    FOR SELECT USING (
        (SELECT auth.jwt() ->> 'email') LIKE '%@cencori.com'
    );

CREATE POLICY "cencori_tasks_insert" ON internal_tasks
    FOR INSERT WITH CHECK (
        (SELECT auth.jwt() ->> 'email') LIKE '%@cencori.com'
    );

CREATE POLICY "cencori_tasks_update" ON internal_tasks
    FOR UPDATE USING (
        (SELECT auth.jwt() ->> 'email') LIKE '%@cencori.com'
    );

CREATE POLICY "cencori_tasks_delete" ON internal_tasks
    FOR DELETE USING (
        (SELECT auth.jwt() ->> 'email') LIKE '%@cencori.com'
    );

-- Comments: same pattern
CREATE POLICY "cencori_comments_select" ON internal_task_comments
    FOR SELECT USING (
        (SELECT auth.jwt() ->> 'email') LIKE '%@cencori.com'
    );

CREATE POLICY "cencori_comments_insert" ON internal_task_comments
    FOR INSERT WITH CHECK (
        (SELECT auth.jwt() ->> 'email') LIKE '%@cencori.com'
    );

CREATE POLICY "cencori_comments_delete" ON internal_task_comments
    FOR DELETE USING (
        (SELECT auth.jwt() ->> 'email') LIKE '%@cencori.com'
    );

-- ─── Realtime ────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE internal_tasks;
