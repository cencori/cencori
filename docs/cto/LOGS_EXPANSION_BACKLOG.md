# Logs Expansion Backlog

Prioritized log types to add after AI/API/Web Gateway logs.

## P0 (highest value)

1. Provider Attempt Logs
- Capture per-attempt provider/model, latency, status, retries, fallback reason.
- Why: fastest path to debug slow/failing model calls and fallback behavior.

2. Auth & API Key Audit Logs
- Key create/rotate/revoke events, auth failures, scope/environment mismatches.
- Why: security visibility and supportability for key-related incidents.

3. Rate Limit Decision Logs
- Limiter key, rule matched, remaining quota, reset timestamp.
- Why: makes 429 behavior transparent and actionable.

## P1

4. Caching Logs
- Cache hit/miss/store/evict with latency and cost saved.
- Why: proves optimization impact and helps tune cache policy.

5. Webhook / Integration Delivery Logs
- Attempt number, destination, status, response snippet, retry schedule.
- Why: critical for integration reliability debugging.

6. Agent/Tool Execution Logs
- Tool name, argument hash/redacted inputs, duration, result/error.
- Why: required for diagnosing agent workflow issues.

## P2

7. Policy/Guardrail Decision Logs
- Rule matched, action taken (allow/redact/block), confidence/risk metadata.
- Why: trust/compliance traceability for moderation decisions.

8. Background Job / Queue Logs
- Enqueued/start/finish/retry/dead-letter for async jobs.
- Why: helps answer “where is my job?” and reliability regressions.

## Recommended next implementation order

1. Provider Attempt Logs
2. Auth & API Key Audit Logs
3. Rate Limit Decision Logs
