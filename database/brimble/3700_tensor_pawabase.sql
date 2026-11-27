-- Pawabase for Tensor projects (lib/tensor-pawabase.ts): a person connects their own Pawabase
-- organization (Pawabase's OAuth for integrations), and a project is linked to a Pawabase project
-- of theirs, one Tensor made for it or one they already had. The backend lives in their Pawabase
-- account; Tensor keeps only how to reach it, and writes what the app needs into the project's
-- environment variables. As Supabase does (2800).
--
-- Tables of their own (see 2700). Applied once by scripts/brimble-apply-sql.mjs before a deploy
-- starts; the live build does not read them.

-- A person's Pawabase sign-in: their tokens and organization, sealed (lib/tensor-cloud.ts
-- sealForUser). Pawabase's refresh tokens work once and a second use ends the whole connection,
-- so one refresh at a time: whoever sets refreshing_until does it, others wait for the new tokens.
create table if not exists public.tensor_pawabase_accounts (
  user_id uuid primary key,
  sealed text not null,
  refreshing_until timestamptz,
  updated_at timestamptz not null default now()
);

-- Which Pawabase project a Tensor project uses. "creating" while a project Tensor asked for is
-- coming up; its variables are written once it is running. "failed" keeps Pawabase's reason.
create table if not exists public.tensor_cloud_pawabase_links (
  task_id uuid primary key references public.tensor_cloud_tasks(id) on delete cascade,
  user_id uuid not null,
  project_id text not null,
  project_ref text not null,
  project_name text not null,
  organization text,
  created_by_tensor boolean not null default false,
  with_secret_key boolean not null default false,
  status text not null default 'ready' check (status in ('creating', 'ready', 'failed')),
  failure_reason text,
  linked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reached only by the server, with the service role. A browser never reads these tables.
alter table public.tensor_pawabase_accounts enable row level security;
revoke all on table public.tensor_pawabase_accounts from anon, authenticated;
grant all on table public.tensor_pawabase_accounts to service_role;

alter table public.tensor_cloud_pawabase_links enable row level security;
revoke all on table public.tensor_cloud_pawabase_links from anon, authenticated;
grant all on table public.tensor_cloud_pawabase_links to service_role;

comment on table public.tensor_pawabase_accounts is 'A person''s Pawabase sign-in for Tensor, sealed.';
comment on table public.tensor_cloud_pawabase_links is 'The Pawabase project a Tensor project uses.';
