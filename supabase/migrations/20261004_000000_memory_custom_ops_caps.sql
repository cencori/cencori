-- Per-project memory operations overrides (custom allowances).
--
-- Tier quotas (lib/entitlements.ts MEMORY_OPS_QUOTA) are one-size-fits-all.
-- A pilot or enterprise contract needs a *project-specific* monthly allowance
-- (e.g. 5,000 turns/mo) that is usually LOWER than the tier default. NULL
-- means "no override — use the tier default". Code reads these tolerantly
-- (lib/memory/settings.ts maps absent columns to null), so this migration
-- can land before or after the deploy without breaking reads; only setting a
-- custom cap requires the columns to exist.
alter table public.project_memory_settings
  add column if not exists max_searches_monthly integer,
  add column if not exists max_writes_monthly integer;

comment on column public.project_memory_settings.max_searches_monthly is
  'Optional per-project monthly search-operations allowance. NULL = tier default. Enforced by lib/memory/ops-quota.ts.';
comment on column public.project_memory_settings.max_writes_monthly is
  'Optional per-project monthly write-operations allowance. NULL = tier default. Enforced by lib/memory/ops-quota.ts.';
