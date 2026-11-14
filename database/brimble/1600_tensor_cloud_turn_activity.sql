-- Whether Tensor is in the middle of a turn in a project, known per project.
--
-- An account runs one project's machine at a time, so opening another puts the first to sleep.
-- That must not happen while Tensor is working there. Until now "working" was read from the
-- account's usage reservation, which says a turn is open somewhere on the account but not where,
-- and which other things close (another device releasing stale reservations, a page settling a
-- turn it only thinks has ended). A turn was cut off that way on 2026-11-14.
--
-- So the project says for itself. Its machine is the only thing that makes model calls with its
-- token, and a turn is model calls from start to finish:
--
--   last_model_call_at   when the project's machine last asked for a model call
--   turn_ended_at        when a page watching the turn saw it end
--
-- A project is mid-turn if it made a model call recently and has not been seen to end since.
--
-- Applied once by scripts/brimble-apply-sql.mjs before a deploy starts. Only adds columns the
-- live build does not read.

alter table public.tensor_cloud_tasks
  add column if not exists last_model_call_at timestamptz,
  add column if not exists turn_ended_at timestamptz;

comment on column public.tensor_cloud_tasks.last_model_call_at is
  'When this project''s machine last made a model call. Recent, and not followed by turn_ended_at, means a turn is in progress.';
comment on column public.tensor_cloud_tasks.turn_ended_at is
  'When a page last saw a turn end in this project.';
