-- Several chats in one project. Until now a task was both things at once: the sandbox (a machine,
-- a volume, the files) and the one conversation held in it. A project needs more than one
-- conversation over the same files, so the conversation becomes a row of its own:
--
--   tensor_cloud_tasks   the workspace: where the files live and the agent runs
--   tensor_cloud_chats   a conversation in it: one agent thread, listed by its title
--
-- Every existing task becomes a task with one chat, and that chat takes the task's id, so the
-- address of every chat that already exists keeps working.
--
-- Applied once by scripts/brimble-apply-sql.mjs before a deploy starts. Only adds: the build that
-- is live while it runs does not know this table and is unaffected. Tasks that build creates
-- after this has run have no chat row yet; the new build adds theirs when it first lists them.

create table if not exists public.tensor_cloud_chats (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tensor_cloud_tasks(id) on delete cascade,
  user_id uuid not null,
  title text,
  -- The agent runtime's own id for the conversation, known once its first message is sent.
  thread_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tensor_cloud_chats_user_idx
  on public.tensor_cloud_chats (user_id, updated_at desc);

create index if not exists tensor_cloud_chats_task_idx
  on public.tensor_cloud_chats (task_id);

-- Reached only by the server, with the service role. A browser never reads this table.
alter table public.tensor_cloud_chats enable row level security;
revoke all on table public.tensor_cloud_chats from anon, authenticated;
grant all on table public.tensor_cloud_chats to service_role;

comment on table public.tensor_cloud_chats is
  'A conversation in a Tensor cloud task. A task that is a project can hold several.';

-- Spares. Making a workspace takes many seconds, so each account keeps one made ahead of time
-- and never started; a new chat claims it instead of waiting for one to be built. A spare is a
-- task in its own status, invisible wherever tasks are listed, and an account has at most one.
alter table public.tensor_cloud_tasks
  drop constraint if exists tensor_cloud_tasks_status_check;
alter table public.tensor_cloud_tasks
  add constraint tensor_cloud_tasks_status_check check (
    status in ('creating', 'ready', 'stopped', 'failed', 'deleted', 'spare')
  );

-- The image a machine was created from. A spare made from an image that is no longer current is
-- replaced rather than handed to a chat.
alter table public.tensor_cloud_tasks
  add column if not exists image text;

-- A spare belongs to nobody's chat yet, so it has no repository; `repository_url` is already
-- optional (1200).
create unique index if not exists tensor_cloud_tasks_one_spare_idx
  on public.tensor_cloud_tasks (user_id)
  where status = 'spare';

insert into public.tensor_cloud_chats (id, task_id, user_id, title, created_at, updated_at)
select id, id, user_id, title, created_at, updated_at
from public.tensor_cloud_tasks
where status not in ('deleted', 'spare')
on conflict (id) do nothing;
