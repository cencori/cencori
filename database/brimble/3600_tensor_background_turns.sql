-- Turns Cencori runs in a project with nobody's browser open (lib/tensor-background-turn.ts): the
-- first is fixing what was asked for in a comment on the project's published app. A row is one
-- piece of work, from the moment it is asked for until its turn has ended, so a server that
-- restarts mid-turn can still close the usage reservation it opened.
--
-- A table of its own (see 2700). Applied once by scripts/brimble-apply-sql.mjs before a deploy
-- starts; the live build does not read it.

create table if not exists public.tensor_cloud_background_turns (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tensor_cloud_tasks(id) on delete cascade,
  user_id uuid not null,
  -- What asked for it: 'manual' (the owner, through the API), later 'quality'.
  source text not null,
  -- queued: waiting for its turn; running: the turn is under way; then how it ended.
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed', 'interrupted', 'busy')),
  prompt text not null,
  -- The runtime's conversation and turn, and the usage reservation's key while it is open.
  thread_id text,
  turn_id text,
  turn_key uuid,
  -- Tensor's last words in the turn, and why it did not finish, if it did not.
  reply text,
  error text,
  created_at timestamptz not null default now(),
  -- Kept fresh by the server following the turn. One gone quiet (the server restarted) is taken
  -- over by another sweep (lib/tensor-background-sweep.ts), which follows the turn to its end.
  heartbeat_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists tensor_cloud_background_turns_task_idx
  on public.tensor_cloud_background_turns (task_id, created_at desc);
create index if not exists tensor_cloud_background_turns_open_idx
  on public.tensor_cloud_background_turns (status) where status in ('queued', 'running');

-- Reached only by the server, with the service role. A browser never reads this table.
alter table public.tensor_cloud_background_turns enable row level security;
revoke all on table public.tensor_cloud_background_turns from anon, authenticated;
grant all on table public.tensor_cloud_background_turns to service_role;

comment on table public.tensor_cloud_background_turns is
  'Turns Cencori runs in a Tensor project with no browser open, such as fixing feedback left on its published app.';
