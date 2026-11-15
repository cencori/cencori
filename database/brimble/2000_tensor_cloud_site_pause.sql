-- A published Tensor app whose owner's plan no longer includes it is paused: not served, its
-- data kept. After 30 days paused it is deleted, with a warning by email a week before. These
-- record when that began and when the warning went, so the daily pass knows where each one is.
--
-- Applied once by scripts/brimble-apply-sql.mjs before a deploy starts. Only adds columns the
-- live build does not read.

alter table public.tensor_cloud_deployments
  add column if not exists paused_at timestamptz,
  add column if not exists pause_warned_at timestamptz;
