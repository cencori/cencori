-- A Porter is an agent that lives on a customer's own website.
--
-- Onboarding already provisions the organization, the project and a domain-locked publishable key
-- from a single pasted URL, but nothing yet records what was provisioned: the workspace page has
-- been inferring the site from the allowed_domains of the key, which is a stopgap that breaks the
-- moment an account has two keys or two Porters. This states the object itself.
--
-- The columns are deliberately wider than the first release uses. `surface`, `actions`, `brand` and
-- `brand_overrides` all exist because a support bot is one configuration of this table rather than
-- its purpose -- the same row with a different prompt and destination is a docs assistant, a
-- pre-sales qualifier, or the answer box that replaces site search -- and adding them now costs
-- nothing while adding them later means migrating live rows.
--
-- Nothing here is destructive. The table is create-if-not-exists and every column is
-- add-if-not-exists, so re-running it against a database that already has it changes nothing.

create table if not exists public.porters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,

  name text not null,
  greeting text,
  system_prompt text,
  model text,

  -- The site this Porter was built from, and the crawl collection its pages land in.
  source_url text not null,
  collection_id text,

  -- Off until it has something to say. A Porter that answers before its site has been read
  -- gives worse answers than no Porter at all, so the crawl step is what turns this on.
  enabled boolean not null default false,

  -- 'launcher' is the bubble in the corner; 'inline' is an answer box in the page; 'page' is a
  -- full-width surface. Only the launcher ships first.
  surface text not null default 'launcher',

  -- What it can do besides answer: notify an inbox, post a webhook, open a ticket. One shape for
  -- all of them, because they differ only in destination.
  actions jsonb not null default '[]'::jsonb,

  -- Inferred from the customer's own page. Anything they then change by hand lands in
  -- brand_overrides and is never touched again, so a weekly re-crawl can refresh what they left
  -- alone without undoing what they chose.
  brand jsonb not null default '{}'::jsonb,
  brand_overrides jsonb not null default '{}'::jsonb,

  -- Set the first time a request arrives from the customer's domain, which is the only honest
  -- signal that the snippet actually made it onto the site.
  install_verified_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.porters add column if not exists greeting text;
alter table public.porters add column if not exists system_prompt text;
alter table public.porters add column if not exists model text;
alter table public.porters add column if not exists collection_id text;
alter table public.porters add column if not exists enabled boolean not null default false;
alter table public.porters add column if not exists surface text not null default 'launcher';
alter table public.porters add column if not exists actions jsonb not null default '[]'::jsonb;
alter table public.porters add column if not exists brand jsonb not null default '{}'::jsonb;
alter table public.porters add column if not exists brand_overrides jsonb not null default '{}'::jsonb;
alter table public.porters add column if not exists install_verified_at timestamptz;

alter table public.porters drop constraint if exists porters_surface_check;
alter table public.porters
  add constraint porters_surface_check check (surface in ('launcher', 'inline', 'page'));

-- The workspace page looks a Porter up by its project, and the chat endpoint will look it up by id.
create index if not exists porters_project_id_idx on public.porters(project_id);
create index if not exists porters_organization_id_idx on public.porters(organization_id);

-- One Porter per project for now. The console has no way to choose between two, so allowing a
-- second would only produce a workspace that shows an arbitrary one of them.
create unique index if not exists porters_one_per_project_idx on public.porters(project_id);

alter table public.porters enable row level security;

-- Read from the console by whoever is in the organization. Writes go through server routes on the
-- service role, which bypasses RLS: provisioning has to create an organization, a project, a key
-- and this row together, and a client that could write here directly could enable a Porter whose
-- site had never been read.
drop policy if exists "Members can view porters in their organization" on public.porters;
create policy "Members can view porters in their organization"
  on public.porters
  for select
  using (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = auth.uid()
    )
  );

drop trigger if exists porters_set_updated_at on public.porters;

create or replace function public.porters_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger porters_set_updated_at
  before update on public.porters
  for each row
  execute function public.porters_touch_updated_at();
