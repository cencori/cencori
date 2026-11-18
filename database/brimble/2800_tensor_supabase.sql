-- Supabase for Tensor projects: a person connects their own Supabase account (Supabase's OAuth for
-- integrations), and a project is linked to a Supabase project of theirs, one Tensor made for it or
-- one they already had. The database lives in their Supabase account; Tensor keeps only how to
-- reach it, and writes the keys into the project's environment variables.
--
-- Tables of their own: adding columns needs an exclusive lock, which waits behind the database's
-- backups (see 2100). Applied once by scripts/brimble-apply-sql.mjs before a deploy starts; the
-- live build does not read them.

-- A person's Supabase sign-in: their tokens, sealed (lib/tensor-cloud.ts sealForUser).
create table if not exists public.tensor_supabase_accounts (
  user_id uuid primary key,
  sealed text not null,
  updated_at timestamptz not null default now()
);

-- Which Supabase project a Tensor project uses. "creating" while a project Tensor asked Supabase
-- for is still coming up; its keys are written into the variables once it is ready. A database
-- password is kept (sealed) only for a project Tensor made, which is the only one it knows.
create table if not exists public.tensor_cloud_supabase_links (
  task_id uuid primary key references public.tensor_cloud_tasks(id) on delete cascade,
  user_id uuid not null,
  project_ref text not null,
  project_name text not null,
  organization_slug text,
  region text,
  created_by_tensor boolean not null default false,
  sealed_password text,
  status text not null default 'ready' check (status in ('creating', 'ready')),
  linked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reached only by the server, with the service role. A browser never reads these tables.
alter table public.tensor_supabase_accounts enable row level security;
revoke all on table public.tensor_supabase_accounts from anon, authenticated;
grant all on table public.tensor_supabase_accounts to service_role;

alter table public.tensor_cloud_supabase_links enable row level security;
revoke all on table public.tensor_cloud_supabase_links from anon, authenticated;
grant all on table public.tensor_cloud_supabase_links to service_role;

comment on table public.tensor_supabase_accounts is 'A person''s Supabase sign-in for Tensor, sealed.';
comment on table public.tensor_cloud_supabase_links is 'The Supabase project a Tensor project uses.';
