-- Publishing a project that has a server of its own. A static site is files the gateway keeps;
-- an app is a program, so it gets a machine of its own (in the tensor-sites Fly app) with a small
-- disk for its data. This is where that machine is remembered, so that it can be found again to
-- publish an update, and destroyed when the project is unpublished or deleted.
--
--   kind        what is being served under the name: 'static' (files) or 'app' (a program)
--   machine_id  the Fly machine the app runs on; null for a project that has never had one
--   volume_id   that machine's disk, where the app's live data is kept
--
-- Applied once by scripts/brimble-apply-sql.mjs before a deploy starts. Only adds columns the
-- live build does not read.

alter table public.tensor_cloud_deployments
  add column if not exists kind text not null default 'static',
  add column if not exists machine_id text,
  add column if not exists volume_id text;

alter table public.tensor_cloud_deployments
  drop constraint if exists tensor_cloud_deployments_kind_check;
alter table public.tensor_cloud_deployments
  add constraint tensor_cloud_deployments_kind_check check (kind in ('static', 'app'));

-- How many machines an account holds is counted on every publish of an app.
create index if not exists tensor_cloud_deployments_user_machine_idx
  on public.tensor_cloud_deployments (user_id)
  where machine_id is not null;
