-- What Tensor did while writing an answer in a plain chat, in order: the text it wrote and the
-- actions it took between (a web search and the pages it found; a project it proposed). The page shows it as a work trace, as a
-- project's chat shows the commands it ran. The answer's text stays whole in tensor_chat_messages;
-- this is only how it unfolded. Answers that did nothing have no row.
--
-- A table of its own, not a column on tensor_chat_messages: adding a column needs an exclusive lock,
-- which waits behind the database's backups (see 2100). Applied once by
-- scripts/brimble-apply-sql.mjs before a deploy starts; the live build does not read it.

create table if not exists public.tensor_chat_traces (
  message_id uuid primary key references public.tensor_chat_messages(id) on delete cascade,
  chat_id uuid not null references public.tensor_chats(id) on delete cascade,
  -- [{ "type": "text", "text": ... } | { "type": "action", "name": "web_search" | "propose_project"
  --   | "continue_in_project", "status": "done" | "failed", "input": {...}, "results"?: [...] }]
  parts jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists tensor_chat_traces_chat_idx
  on public.tensor_chat_traces (chat_id);

-- Reached only by the server, with the service role. A browser never reads this table.
alter table public.tensor_chat_traces enable row level security;
revoke all on table public.tensor_chat_traces from anon, authenticated;
grant all on table public.tensor_chat_traces to service_role;

comment on table public.tensor_chat_traces is
  'How an answer in a plain Tensor chat unfolded: its text and the actions between, in order.';
