-- Cencori for Tensor projects (2026-11-20): a person connects their Cencori organization through
-- Cencori OAuth, and a project is given an API key in one of that organization's Cencori
-- projects, kept as its CENCORI_API_KEY, so the app it builds can call models through Cencori on
-- the person's own bill. Tensor keeps the connection (sealed) and which key it made for which
-- project, so taking the integration out can revoke that key.
--
-- Tables of their own, as 2800's are.

create table if not exists public.tensor_cencori_accounts (
  user_id uuid primary key,
  sealed text not null,
  organization_name text,
  updated_at timestamptz not null default now()
);

create table if not exists public.tensor_cloud_cencori_links (
  task_id uuid primary key references public.tensor_cloud_tasks(id) on delete cascade,
  user_id uuid not null,
  project_id text not null,
  project_name text not null,
  key_id text not null,
  key_prefix text,
  linked_at timestamptz not null default now()
);

alter table public.tensor_cencori_accounts enable row level security;
revoke all on table public.tensor_cencori_accounts from anon, authenticated;
grant all on table public.tensor_cencori_accounts to service_role;

alter table public.tensor_cloud_cencori_links enable row level security;
revoke all on table public.tensor_cloud_cencori_links from anon, authenticated;
grant all on table public.tensor_cloud_cencori_links to service_role;

comment on table public.tensor_cencori_accounts is 'A person''s Cencori OAuth connection for Tensor, sealed.';
comment on table public.tensor_cloud_cencori_links is 'The Cencori project and key a Tensor project uses.';
