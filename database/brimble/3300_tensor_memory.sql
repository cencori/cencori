-- Tensor's memory.
--
-- What Tensor has learned (the person's preferences, a project's decisions) is kept by Cencori
-- Memory, in gateway_memories under Tensor's own product project: scope 'user' keyed by the
-- person, scope 'workspace' keyed by one of their projects (lib/tensor-memory.ts). Nothing here
-- touches that table.
--
-- What is new is a record of every finished turn, plain chat or project chat, so Tensor can look
-- back at what was said in any of the person's chats: "the colours we picked in the other chat".
-- A project's chat lives in its sandbox and was nowhere on the server before; a plain chat's
-- messages were (tensor_chat_messages) and are copied in below, so its past is searchable too.
--
-- And a switch per person: memory off means nothing is recorded or recalled.
--
-- New tables only, so nothing waits behind a backup. Safe to run twice.

create table if not exists public.tensor_memory_turns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  -- A plain chat's turn names its chat. A project chat's names its project and the runtime's
  -- thread, which tensor_cloud_chats.thread_id turns into the chat when it is read.
  plain_chat_id uuid references public.tensor_chats(id) on delete cascade,
  task_id uuid references public.tensor_cloud_tasks(id) on delete cascade,
  thread_id text,
  -- Who sent it, made unique per person, so a turn reported twice is kept once.
  turn_key text not null,
  prompt text not null,
  answer text not null,
  created_at timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('english', coalesce(prompt, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(answer, '')), 'B')
  ) stored,
  constraint tensor_memory_turns_turn_key unique (user_id, turn_key)
);

create index if not exists tensor_memory_turns_search_idx
  on public.tensor_memory_turns using gin (search);
create index if not exists tensor_memory_turns_user_idx
  on public.tensor_memory_turns (user_id, created_at desc);
create index if not exists tensor_memory_turns_plain_idx
  on public.tensor_memory_turns (plain_chat_id, created_at);
create index if not exists tensor_memory_turns_thread_idx
  on public.tensor_memory_turns (task_id, thread_id, created_at);

create table if not exists public.tensor_memory_settings (
  user_id uuid primary key,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Reached only by the server, with the service role.
alter table public.tensor_memory_turns enable row level security;
alter table public.tensor_memory_settings enable row level security;
revoke all on table public.tensor_memory_turns from anon, authenticated;
revoke all on table public.tensor_memory_settings from anon, authenticated;
grant all on table public.tensor_memory_turns to service_role;
grant all on table public.tensor_memory_settings to service_role;

comment on table public.tensor_memory_turns is
  'Every finished Tensor turn (plain or project chat), for looking back across a person''s chats.';
comment on table public.tensor_memory_settings is
  'Whether Tensor records and recalls memory for a person. No row means on.';

-- Plain chats already on the server: each question with the answer that followed it.
insert into public.tensor_memory_turns (user_id, plain_chat_id, turn_key, prompt, answer, created_at)
select question.user_id,
       question.chat_id,
       'plain:' || question.id::text,
       left(question.content, 8000),
       left(reply.content, 16000),
       question.created_at
from public.tensor_chat_messages question
join lateral (
  select candidate.content
  from public.tensor_chat_messages candidate
  where candidate.chat_id = question.chat_id
    and candidate.role = 'assistant'
    and candidate.created_at >= question.created_at
  order by candidate.created_at
  limit 1
) reply on true
where question.role = 'user'
  and reply.content <> ''
on conflict on constraint tensor_memory_turns_turn_key do nothing;
