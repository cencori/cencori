-- Publishing a project to the web: what was built is copied out of the project's workspace and
-- served at an address of its own, <name>.<sites domain>, for as long as it stays published. The
-- copy is held and served by the cloud gateway; this table is who owns which name.
--
--   One row per project that has a name: a project publishes to one address.
--   A name belongs to one project at a time, across every account.
--
-- Applied once by scripts/brimble-apply-sql.mjs before a deploy starts. Only adds a table the
-- live build does not read.

create table if not exists public.tensor_cloud_deployments (
  task_id uuid primary key references public.tensor_cloud_tasks(id) on delete cascade,
  user_id uuid not null,
  -- The first label of the address: lower-case letters, digits and dashes.
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- When what is being served was last uploaded. Null while a name is held but nothing has been
  -- published under it yet.
  published_at timestamptz
);

create unique index if not exists tensor_cloud_deployments_name_idx
  on public.tensor_cloud_deployments (name);

create index if not exists tensor_cloud_deployments_user_idx
  on public.tensor_cloud_deployments (user_id);

-- Reached only by the server, with the service role. A browser never reads this table.
alter table public.tensor_cloud_deployments enable row level security;
revoke all on table public.tensor_cloud_deployments from anon, authenticated;
grant all on table public.tensor_cloud_deployments to service_role;

comment on table public.tensor_cloud_deployments is
  'The public address a Tensor cloud project is published at. One per project; a name is unique.';
