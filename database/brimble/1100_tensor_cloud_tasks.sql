-- Tensor cloud tasks: one row per task that runs in a sandbox (a Fly Machine) instead of on the
-- user's own computer. See lib/tensor-cloud.ts for who is trusted with what.
--
-- The row is what makes a sandbox's credential good: its model calls are accepted only while the
-- task here is `ready` and belongs to the account the credential names. Stopping or deleting a
-- task therefore cuts off its sandbox at once, whatever is still running inside it.
--
-- Applied once by scripts/brimble-apply-sql.mjs before a deploy starts. Only creates: no existing
-- table is touched or locked.

create table if not exists public.tensor_cloud_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  repository_url text not null,
  repository_ref text,
  -- Null until Fly has created the machine, and again if creating it failed.
  machine_id text,
  -- The task's Fly volume: the repository and the conversation, which outlive a stopped machine.
  volume_id text,
  region text,
  status text not null default 'creating' check (
    status in ('creating', 'ready', 'stopped', 'failed', 'deleted')
  ),
  last_connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tensor_cloud_tasks_user_idx
  on public.tensor_cloud_tasks (user_id, created_at desc)
  where status <> 'deleted';

-- One running sandbox per account, enforced here rather than only in the route that checks it:
-- two requests arriving together would both pass a check made before either had written.
-- Raise the limit by replacing this index (see MAX_RUNNING_TASKS in lib/tensor-cloud-tasks.ts).
create unique index if not exists tensor_cloud_tasks_one_running_idx
  on public.tensor_cloud_tasks (user_id)
  where status in ('creating', 'ready');

-- Reached only by the server, with the service role. A browser never reads this table.
alter table public.tensor_cloud_tasks enable row level security;
revoke all on table public.tensor_cloud_tasks from anon, authenticated;
grant all on table public.tensor_cloud_tasks to service_role;

comment on table public.tensor_cloud_tasks is
  'A Tensor task running in a cloud sandbox. A sandbox''s model calls are honoured only while its row is ready.';
