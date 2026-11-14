-- Archiving a project, or a single chat: it is put away, not deleted. Its chats and files are kept and it can be
-- brought back, but it is no longer listed among the projects being worked on.
--
-- Applied once by scripts/brimble-apply-sql.mjs before a deploy starts. Only adds columns the
-- live build does not read.

alter table public.tensor_cloud_tasks
  add column if not exists archived_at timestamptz;

comment on column public.tensor_cloud_tasks.archived_at is
  'When the project was archived. Null for a project in use.';

-- A chat can be put away by itself, while its project carries on.
alter table public.tensor_cloud_chats
  add column if not exists archived_at timestamptz;

comment on column public.tensor_cloud_chats.archived_at is
  'When the chat was archived. Null for a chat in use.';
