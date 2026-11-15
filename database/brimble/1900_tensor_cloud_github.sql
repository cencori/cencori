-- Connecting a Tensor cloud project to GitHub, so that what is built in it can be pushed to a
-- repository.
--
--   tensor_cloud_github_accounts  The GitHub account a person has signed in with, one per
--                                 person. Its tokens are how it is proved, before every
--                                 connection and every push, that this person may push to the
--                                 repository in question. They are kept sealed: encrypted by the
--                                 server with a key that is not in the database
--                                 (lib/tensor-cloud.ts, sealGithubTokens).
--   tensor_cloud_git              The repository a project pushes to, one per project.
--
-- Applied once by scripts/brimble-apply-sql.mjs before a deploy starts. Only adds tables the
-- live build does not read.

create table if not exists public.tensor_cloud_github_accounts (
  user_id uuid primary key,
  github_user_id bigint not null,
  github_login text not null,
  sealed text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tensor_cloud_git (
  task_id uuid primary key references public.tensor_cloud_tasks(id) on delete cascade,
  user_id uuid not null,
  -- GitHub's own id for the repository, which does not change when it is renamed or moved.
  repository_id bigint not null,
  -- "owner/name", as it was when the project was connected or last pushed.
  repository text not null,
  branch text not null,
  private boolean not null default false,
  connected_at timestamptz not null default now(),
  last_pushed_at timestamptz
);

create index if not exists tensor_cloud_git_user_idx on public.tensor_cloud_git (user_id);

-- Reached only by the server, with the service role. A browser never reads these tables.
alter table public.tensor_cloud_github_accounts enable row level security;
revoke all on table public.tensor_cloud_github_accounts from anon, authenticated;
grant all on table public.tensor_cloud_github_accounts to service_role;

alter table public.tensor_cloud_git enable row level security;
revoke all on table public.tensor_cloud_git from anon, authenticated;
grant all on table public.tensor_cloud_git to service_role;

comment on table public.tensor_cloud_github_accounts is
  'The GitHub account a Tensor user signed in with, its tokens encrypted. One row per user.';
comment on table public.tensor_cloud_git is
  'The GitHub repository a Tensor cloud project pushes to. One row per project.';
