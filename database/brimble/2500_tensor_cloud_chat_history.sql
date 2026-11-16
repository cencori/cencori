-- A copy of what a project's chat says, kept beside the chat. The conversation itself lives in the
-- project's sandbox, which is not always running: a plan runs one project at a time, so a chat in
-- another project cannot be opened while Tensor works there. With this copy the page shows the
-- chat at once, and can still show it when the sandbox cannot be started yet. It is what the page
-- shows (messages, thoughts, the commands run and the files changed), trimmed, not the runtime's
-- own record, and it is replaced whole each time a turn ends.
--
-- A table of its own, not a column on tensor_cloud_chats: adding a column needs an exclusive lock,
-- which waits behind the database's backups (see 2100). Applied once by
-- scripts/brimble-apply-sql.mjs before a deploy starts; the live build does not read it.

create table if not exists public.tensor_cloud_chat_history (
  chat_id uuid primary key references public.tensor_cloud_chats(id) on delete cascade,
  user_id uuid not null,
  items jsonb not null,
  updated_at timestamptz not null default now()
);

-- Reached only by the server, with the service role. A browser never reads this table.
alter table public.tensor_cloud_chat_history enable row level security;
revoke all on table public.tensor_cloud_chat_history from anon, authenticated;
grant all on table public.tensor_cloud_chat_history to service_role;

comment on table public.tensor_cloud_chat_history is
  'What a Tensor project chat says, as the page shows it: kept so the chat can be read while its sandbox is not running.';
