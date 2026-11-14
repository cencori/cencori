-- A cloud task no longer has to start from a repository. Someone who comes to build something
-- new starts from an empty workspace, and what they see is a conversation, not a sandbox: so the
-- repository becomes optional, each task gets a title to be listed by, and it can be a named
-- project.
--
-- Applied once by scripts/brimble-apply-sql.mjs before a deploy starts. Safe for the build that is
-- live while it runs: that build always supplies a repository and never reads the new column.

alter table public.tensor_cloud_tasks
  alter column repository_url drop not null;

alter table public.tensor_cloud_tasks
  add column if not exists title text;

-- A project is a workspace someone named: made new, or imported from a repository. A task
-- without one is a plain chat. One task per project for now, so the name lives on the task.
alter table public.tensor_cloud_tasks
  add column if not exists project_name text;

comment on column public.tensor_cloud_tasks.project_name is
  'The project this task is the workspace of, as its owner named it. Null for a chat outside any project.';

comment on column public.tensor_cloud_tasks.title is
  'What the task is listed as: the start of its first message. Null for tasks made before titles.';
