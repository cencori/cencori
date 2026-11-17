-- Who may see a project's published site or app: anyone with its address ("public", the default
-- when there is no row), or whoever has its password ("password"). Only the choice is kept here:
-- the password goes straight to the gateway, which keeps a hash of it and nothing else
-- (cloud/gateway/src/access.ts in the Tensor repository).
--
-- A table of its own, not a column on tensor_cloud_deployments: adding a column needs an exclusive
-- lock, which waits behind the database's backups (see 2100). Applied once by
-- scripts/brimble-apply-sql.mjs before a deploy starts; the live build does not read it.

create table if not exists public.tensor_cloud_site_access (
  task_id uuid primary key references public.tensor_cloud_tasks(id) on delete cascade,
  user_id uuid not null,
  mode text not null check (mode in ('public', 'password')),
  updated_at timestamptz not null default now()
);

-- Reached only by the server, with the service role. A browser never reads this table.
alter table public.tensor_cloud_site_access enable row level security;
revoke all on table public.tensor_cloud_site_access from anon, authenticated;
grant all on table public.tensor_cloud_site_access to service_role;

comment on table public.tensor_cloud_site_access is
  'Who may see a Tensor project''s published site: anyone, or whoever has its password (kept hashed by the gateway).';
