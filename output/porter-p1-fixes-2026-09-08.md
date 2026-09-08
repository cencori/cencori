# Porter P1 fixes — 8 September 2026

All four P1 defects from the implementation audit are fixed in the working tree. The changes have been tested locally; production migrations and deployment have not been performed.

1. **Public credentials are restricted to Porter.** Provisioning and rotation mark keys with `client_app='porter'`. The general gateway and eight standalone API handlers reject those credentials. Public session/config access requires the current, unrevoked Porter key and an allowed origin. The migration backfills existing keys without changing embed snippets; the API-key cache namespace changes so old unscoped cache entries cannot carry over.
2. **Previews use trusted internal delegation.** Porter creates a request with a one-use capability held in server memory and bound to the key and project. Copying a request, sending special headers, or presenting a public session directly to the general gateway cannot reproduce it. Only authorized Porter chat creates this capability. Browser gateway controls are discarded, historical agent associations are ignored, and the stored model must belong to Porter's catalog. Normal gateway admission, guards, and configured spend caps still apply.
3. **Rate-limit windows expire correctly.** An atomic Redis Lua operation increments the counter and initializes expiry without extending it on later attempts. Concurrent visitors remain limited, rejected retries do not renew lockouts, and access recovers at the window boundary.
4. **Recrawling rotates through due Porters.** Service-role-only database functions claim due work using row locks and six-minute leases, ordered by last attempt. The cron claims one site at a time, handles up to 20 within a four-minute work budget, and releases only its own lease. Expired leases recover after crashes. Last summaries/errors are persisted, failed work returns an error status, and pages deferred by the deadline retain their due dates.

Apply these migrations in order before deploying the code:

1. [Porter key scope and existing-key backfill](/Users/apple/cencori/supabase/migrations/20260908_100000_porter_key_scope.sql)
2. [Fair recrawl scheduling and lease functions](/Users/apple/cencori/supabase/migrations/20260908_110000_porter_recrawl_fairness.sql)

The runtime fails closed for Porter keys that have not been scoped. The recrawl endpoint reports a scheduling failure if its new database functions are missing. Existing `PORTER_SESSION_SECRET` and `CRON_SECRET` configuration is still required; their production values/presence were not inspected.

Validation completed:

- 128 focused tests passed across Porter and adjacent gateway suites, including public credential rejection, preview authorization, forged/copied delegation rejection, rate-window recovery, and cron error/deadline handling.
- TypeScript passed with `--noEmit --incremental false`.
- Targeted ESLint passed for the changed Porter/gateway/endpoint code. The cache module retains the same 25 pre-existing `no-explicit-any` errors as its HEAD version; this change only versions its API-key cache namespace.
- The actual Lua script passed against a disposable Redis instance, including concurrent admission, denied-request TTL preservation, and expiry recovery.
- Both migrations passed against disposable PostgreSQL databases and passed replay checks. SQL regressions cover more than 20 due Porters, idle/disabled exclusion, failure records, active leases, crash recovery, stale-token rejection, RPC privileges, and preservation of ordinary/Basecode credentials and existing snippets.
- Temporary Redis/PostgreSQL services were stopped after verification. Existing application changes were preserved.

The reusable SQL checks are [key-scope.sql](/Users/apple/cencori/lib/porter/__tests__/key-scope.sql) and [recrawl-fairness.sql](/Users/apple/cencori/lib/porter/__tests__/recrawl-fairness.sql). Run each with `psql -v ON_ERROR_STOP=1 -f` against a separate empty, disposable database.

Paid-plan metering and cumulative Porter spend entitlements remain the next commercial milestone.
