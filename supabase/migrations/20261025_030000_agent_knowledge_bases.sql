-- Agent knowledge: each agent can own one knowledge base that every run of
-- that agent searches, whichever customer it runs for. It is live (not tied
-- to a version), so a new document takes effect on the next turn. Deleting
-- the agent deletes its knowledge (sources and chunks cascade from here).
alter table public.knowledge_bases
    add column if not exists agent_id uuid references public.agents(id) on delete cascade;

-- One shared (non-customer) knowledge base per agent.
create unique index if not exists knowledge_bases_agent_id_shared_key
    on public.knowledge_bases (agent_id)
    where agent_id is not null and tenant_id is null;
