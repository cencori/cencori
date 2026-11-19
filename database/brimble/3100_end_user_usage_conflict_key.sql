-- End-user usage could not be written at all (2026-11-19).
--
-- increment_end_user_usage upserts a usage row per end user, environment, period and
-- currency, naming those five columns in ON CONFLICT. No unique index covered the five:
-- the table had one on (end_user_id, environment, period_type, period_start) and one on
-- (end_user_id, period_type, period_start, currency). Postgres refused every call with
-- "there is no unique or exclusion constraint matching the ON CONFLICT specification",
-- so POST /v1/billing/usage-events answered 500 and nothing was recorded.
--
-- The five-column index is the one the function asks for. The two narrower ones go: each
-- would reject a row the function means to write (a test row beside a production row for
-- the same period, or a second currency in one environment). Every existing row already
-- satisfies both, so the new index cannot fail on existing data.
--
-- The ten-argument increment_end_user_usage is the version from before environments. It
-- upserts on one of the constraints dropped here and nothing calls it.
-- Idempotent.

create unique index if not exists end_user_usage_user_env_period_currency_key
    on public.end_user_usage (end_user_id, environment, period_type, period_start, currency);

alter table public.end_user_usage
    drop constraint if exists end_user_usage_user_period_currency_key;
alter table public.end_user_usage
    drop constraint if exists end_user_usage_end_user_id_environment_period_type_period_start;

drop function if exists public.increment_end_user_usage(
    uuid, text, bigint, bigint, numeric, numeric, numeric, text, text, text
);
