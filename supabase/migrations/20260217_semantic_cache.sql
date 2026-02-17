-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create a table to store semantic cache
create table if not exists semantic_cache (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  response jsonb not null,
  embedding vector(768), -- Gemini text-embedding-004 has 768 dimensions
  created_at timestamptz default now(),
  
  -- Add a unique constraint to prevent duplicate prompts if desired, 
  -- though strictly speaking prompts can be nuanced. 
  -- For cache, we might want to just rely on vector similarity.
  -- But to prevent exact duplicates:
  constraint unique_prompt unique (prompt)
);

-- Create a function to search for similar cached responses
create or replace function match_semantic_cache (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  prompt text,
  response jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    semantic_cache.id,
    semantic_cache.prompt,
    semantic_cache.response,
    1 - (semantic_cache.embedding <=> query_embedding) as similarity
  from semantic_cache
  where 1 - (semantic_cache.embedding <=> query_embedding) > match_threshold
  order by semantic_cache.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Create an index for faster similarity search
create index on semantic_cache using ivfflat (embedding vector_cosine_ops)
with (lists = 100);
