-- Comments left on a project's published app, as Quality's webhook sends them
-- (lib/tensor-quality-inbox.ts), and whether Tensor fixes its owner's comments by itself.
--
-- A comment is kept once per event (Quality sends an event again until it is answered), waits a
-- little for others that follow it, and is then taken up by one background turn
-- (tensor_cloud_background_turns, 3600) together with the comments that came with it.
--
-- A table of its own (see 2700). Applied once by scripts/brimble-apply-sql.mjs before a deploy
-- starts; the live build does not read it.

alter table public.tensor_cloud_quality
  add column if not exists auto_fix boolean not null default true;

create table if not exists public.tensor_cloud_quality_comments (
  -- Quality's event id: the same on every retry of one event.
  event_id text primary key,
  task_id uuid not null references public.tensor_cloud_tasks(id) on delete cascade,
  user_id uuid not null,
  thread_id text not null,
  comment_id text,
  author_id text,
  author_name text,
  -- What was said, as plain text (Quality sends HTML).
  content text not null,
  page_url text,
  page_title text,
  -- The background turn that took it up; null while it waits.
  background_turn_id uuid references public.tensor_cloud_background_turns(id) on delete set null,
  received_at timestamptz not null default now()
);

create index if not exists tensor_cloud_quality_comments_waiting_idx
  on public.tensor_cloud_quality_comments (task_id, received_at)
  where background_turn_id is null;

-- Reached only by the server, with the service role. A browser never reads this table.
alter table public.tensor_cloud_quality_comments enable row level security;
revoke all on table public.tensor_cloud_quality_comments from anon, authenticated;
grant all on table public.tensor_cloud_quality_comments to service_role;

comment on table public.tensor_cloud_quality_comments is
  'Comments the owner of a Tensor project left on its published app, waiting for or taken up by a background turn.';
