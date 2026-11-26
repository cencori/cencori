-- Quality's feedback toolbar on a project's published app (lib/tensor-quality.ts). A row means it
-- is on: who may comment (the team, or any visitor) and the site id Quality gave the app, which the
-- gateway adds Quality's script with. No credentials are kept here: Tensor speaks to Quality with
-- its own client id and secret, from the server's environment.
--
-- A table of its own (see 2700). Applied once by scripts/brimble-apply-sql.mjs before a deploy
-- starts; the live build does not read it.

create table if not exists public.tensor_cloud_quality (
  task_id uuid primary key references public.tensor_cloud_tasks(id) on delete cascade,
  user_id uuid not null,
  mode text not null default 'members' check (mode in ('members', 'anyone')),
  site_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reached only by the server, with the service role. A browser never reads this table.
alter table public.tensor_cloud_quality enable row level security;
revoke all on table public.tensor_cloud_quality from anon, authenticated;
grant all on table public.tensor_cloud_quality to service_role;

comment on table public.tensor_cloud_quality is
  'Quality''s visitor-feedback toolbar on a Tensor project''s published app: who may comment, and its Quality site id.';
