# Support Playbook — Embedded Agents (M4)

## Triage without crossing tenant boundaries

- Search keys: `request_id` (req_*), tenant external ID, user external ID, session/run/action/delivery IDs. Never accept a project secret from the customer; use dashboard support views with redacted content.
- Break-glass: audited only, time-boxed, support tooling cannot bypass scope (PRD §15.1).

## Common incidents

### 401 invalid_api_key / missing_api_key
Browser shipped a `csk_*` or an expired `ect_*`. Fix: mint client tokens server-side (`POST /v1/client-tokens`, ≤15 min TTL).

### 403 tenant_scope_mismatch
Caller mixed tenants (body scope vs token claims, or foreign installation/KB). Check installation→tenant→project chain.

### 402 tenant/installation/run limits
Plan cap hit (`tenant_limit_exceeded`, `run_rate_exceeded` + `Retry-After`). Options: upgrade tier, raise `EMBEDDED_LIMITS`, or spread load (fair scheduling isolates noisy tenants — confirm via `GET /v1/usage?tenant_id=`).

### 409 idempotency_conflict / already resolved
Retry with a new `Idempotency-Key`. Same key + same body safely replays; same key + different body is rejected by design.

### Approval never arrives / action expired
Actions expire (default 24h). Check `GET /v1/actions/:id`, webhook deliveries (`GET /v1/webhook-deliveries`), endpoint health. Replay via `POST .../replay`.

### Ambiguous approved-not-executed actions
Dispatch is single-claim/at-most-once, not exactly-once: one approver wins the claim and dispatches once, but a crash between the external send and the result write leaves `approved` with no recorded outcome. Gmail ignores our execution key upstream. Reconcile via the upstream outbox (Gmail sent folder, MCP server logs) before issuing a replacement action with a **new** idempotency key — never reuse the old key with a different body (409 by design).

### Gmail send failed
`POST /v1/connections/:id/test` → credential presence/expiry. `POST .../refresh` rotates from the stored refresh token. Upstream 4xx (other than 429) never retries — inspect `last_error` (redacted).

### Knowledge stuck in queued/failed
`GET .../sources/:id` surfaces `error`. Injection-held rows go `stale`. Re-sync with corrected text; checksum dedupes unchanged content.

### Usage doesn't reconcile
`GET /v1/usage/export` reads `ai_requests` (≤90d, 5k cap, `truncated` flag). Pre-M3 rows have null dims. `cencori_charge_usd` on `usage-events` rows means customer charge (external path skips gateway markup) — see exploration notes before accusing drift.

## Escalation

Security/isolation suspicion → freeze the tenant (`PATCH ... suspended`? use installation disable + revoke connections), preserve `request_id`s, escalate with event timelines. Zero tenant-isolation incidents is the GA bar.
