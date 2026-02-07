-- AI Memory / Context Store
-- Vector storage for RAG, conversation history, and semantic search

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Memory namespaces (organize memories by purpose)
CREATE TABLE IF NOT EXISTS memory_namespaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    embedding_model TEXT DEFAULT 'text-embedding-3-small',
    dimensions INTEGER DEFAULT 1536,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id, name)
);

-- Memory entries with vector embeddings
CREATE TABLE IF NOT EXISTS memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    namespace_id UUID NOT NULL REFERENCES memory_namespaces(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- HNSW index for fast similarity search (cosine distance)
CREATE INDEX IF NOT EXISTS memories_embedding_hnsw_idx ON memories 
USING hnsw (embedding vector_cosine_ops);

-- Index for namespace lookups
CREATE INDEX IF NOT EXISTS memories_namespace_idx ON memories(namespace_id);

-- Index for expiration cleanup
CREATE INDEX IF NOT EXISTS memories_expires_at_idx ON memories(expires_at) 
WHERE expires_at IS NOT NULL;

-- RLS policies
ALTER TABLE memory_namespaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

-- Namespace policies (access via project membership)
CREATE POLICY "Users can view namespaces in their projects" ON memory_namespaces
    FOR SELECT USING (
        project_id IN (
            SELECT p.id FROM projects p
            JOIN organization_members om ON p.organization_id = om.organization_id
            WHERE om.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create namespaces in their projects" ON memory_namespaces
    FOR INSERT WITH CHECK (
        project_id IN (
            SELECT p.id FROM projects p
            JOIN organization_members om ON p.organization_id = om.organization_id
            WHERE om.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update namespaces in their projects" ON memory_namespaces
    FOR UPDATE USING (
        project_id IN (
            SELECT p.id FROM projects p
            JOIN organization_members om ON p.organization_id = om.organization_id
            WHERE om.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete namespaces in their projects" ON memory_namespaces
    FOR DELETE USING (
        project_id IN (
            SELECT p.id FROM projects p
            JOIN organization_members om ON p.organization_id = om.organization_id
            WHERE om.user_id = auth.uid()
        )
    );

-- Memory policies (access via namespace → project membership)
CREATE POLICY "Users can view memories in their namespaces" ON memories
    FOR SELECT USING (
        namespace_id IN (
            SELECT mn.id FROM memory_namespaces mn
            JOIN projects p ON mn.project_id = p.id
            JOIN organization_members om ON p.organization_id = om.organization_id
            WHERE om.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create memories in their namespaces" ON memories
    FOR INSERT WITH CHECK (
        namespace_id IN (
            SELECT mn.id FROM memory_namespaces mn
            JOIN projects p ON mn.project_id = p.id
            JOIN organization_members om ON p.organization_id = om.organization_id
            WHERE om.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update memories in their namespaces" ON memories
    FOR UPDATE USING (
        namespace_id IN (
            SELECT mn.id FROM memory_namespaces mn
            JOIN projects p ON mn.project_id = p.id
            JOIN organization_members om ON p.organization_id = om.organization_id
            WHERE om.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete memories in their namespaces" ON memories
    FOR DELETE USING (
        namespace_id IN (
            SELECT mn.id FROM memory_namespaces mn
            JOIN projects p ON mn.project_id = p.id
            JOIN organization_members om ON p.organization_id = om.organization_id
            WHERE om.user_id = auth.uid()
        )
    );

-- Function to search memories by similarity
CREATE OR REPLACE FUNCTION search_memories(
    p_namespace_id UUID,
    p_query_embedding vector(1536),
    p_limit INTEGER DEFAULT 10,
    p_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    metadata JSONB,
    similarity FLOAT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.content,
        m.metadata,
        1 - (m.embedding <=> p_query_embedding) AS similarity,
        m.created_at
    FROM memories m
    WHERE m.namespace_id = p_namespace_id
      AND m.embedding IS NOT NULL
      AND (m.expires_at IS NULL OR m.expires_at > now())
      AND 1 - (m.embedding <=> p_query_embedding) >= p_threshold
    ORDER BY m.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
