-- Scan chat memory table for RAG-based persistent context
-- Uses pgvector (already enabled via 20260217_semantic_cache.sql)
-- Stores embeddings of Q&A exchanges, dismissed issues, and merged PRs per project.

create table if not exists scan_chat_memory (
    id          uuid primary key default gen_random_uuid(),
    project_id  uuid not null references scan_projects(id) on delete cascade,
    user_id     uuid not null,
    -- The raw text that was embedded and stored
    content     text not null,
    -- Where this memory came from
    source      text not null check (source in ('chat', 'dismiss', 'pr_merged', 'done')),
    -- Optional: link back to a specific scan run for context
    scan_run_id uuid references scan_runs(id) on delete set null,
    -- 768-dim embedding from Gemini text-embedding-004 (same as semantic_cache)
    embedding   vector(768),
    created_at  timestamptz default now()
);

-- Row-level security: users can only see their own project memory
alter table scan_chat_memory enable row level security;

create policy "Users can read own scan memory"
    on scan_chat_memory for select
    using (user_id = auth.uid());

create policy "Users can insert own scan memory"
    on scan_chat_memory for insert
    with check (user_id = auth.uid());

-- Vector similarity search index
create index if not exists scan_chat_memory_embedding_idx
    on scan_chat_memory
    using ivfflat (embedding vector_cosine_ops)
    with (lists = 50);

-- Regular index for fast project + user scoped queries
create index if not exists scan_chat_memory_project_user_idx
    on scan_chat_memory (project_id, user_id, created_at desc);

-- Function to search memory for a given project + user by similarity
create or replace function match_scan_memory(
    query_embedding vector(768),
    p_project_id    uuid,
    p_user_id       uuid,
    match_threshold float default 0.65,
    match_count     int   default 5
)
returns table (
    id          uuid,
    content     text,
    source      text,
    similarity  float,
    created_at  timestamptz
)
language plpgsql
as $$
begin
    return query
    select
        m.id,
        m.content,
        m.source,
        1 - (m.embedding <=> query_embedding) as similarity,
        m.created_at
    from scan_chat_memory m
    where
        m.project_id = p_project_id
        and m.user_id = p_user_id
        and m.embedding is not null
        and 1 - (m.embedding <=> query_embedding) > match_threshold
    order by m.embedding <=> query_embedding
    limit match_count;
end;
$$;
