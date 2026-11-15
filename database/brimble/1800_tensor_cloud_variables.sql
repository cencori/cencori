-- A project's environment variables: the names and values its app reads from its environment,
-- which is how it is given the address and keys of a database it connects to. They are set on
-- the project's settings page, and given to its preview and to its published app.
--
-- One row per project, holding the whole set sealed: the values are secrets, so nothing of them
-- is readable in this table, not even the names. They are encrypted by the server with a key
-- that is not in the database (lib/tensor-cloud.ts, sealVariables).
--
-- Applied once by scripts/brimble-apply-sql.mjs before a deploy starts. Only adds a table the
-- live build does not read.

create table if not exists public.tensor_cloud_variables (
  task_id uuid primary key references public.tensor_cloud_tasks(id) on delete cascade,
  user_id uuid not null,
  -- The set, as AES-256-GCM over its JSON: "v1:<iv>:<tag>:<ciphertext>", each part base64url.
  sealed text not null,
  -- How many there are, so that it can be said without opening them.
  count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tensor_cloud_variables_user_idx
  on public.tensor_cloud_variables (user_id);

-- Reached only by the server, with the service role. A browser never reads this table.
alter table public.tensor_cloud_variables enable row level security;
revoke all on table public.tensor_cloud_variables from anon, authenticated;
grant all on table public.tensor_cloud_variables to service_role;

comment on table public.tensor_cloud_variables is
  'The environment variables of a Tensor cloud project, encrypted. One row per project.';
