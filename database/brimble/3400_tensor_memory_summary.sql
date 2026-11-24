-- Tensor's memory summary: what it has learned about a person, written as a few short sections,
-- shown in Settings, Memory. Written again when the facts under it change: `signature` names the
-- facts it was written from, so a page that finds it out of date writes a new one.
--
-- New table only. Safe to run twice.

create table if not exists public.tensor_memory_summaries (
  user_id uuid primary key,
  content text not null,
  signature text not null,
  updated_at timestamptz not null default now()
);

alter table public.tensor_memory_summaries enable row level security;
revoke all on table public.tensor_memory_summaries from anon, authenticated;
grant all on table public.tensor_memory_summaries to service_role;

comment on table public.tensor_memory_summaries is
  'A summary of what Tensor remembers about a person, rewritten when the facts change.';
