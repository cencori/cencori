# Jira — Cencori Beginner KPIs (Team-Managed)

**Project Key:** CEN

---

## Sprint 1

### CEN — Python SDK metrics endpoint compatibility

| Field | Value |
|---|---|
| **Issue Type** | Story |
| **Priority** | Medium |
| **Labels** | `cencori`, `kpi-delivery`, `kpi-quality`, `beginner`, `python-sdk` |
| **Story Point Estimate** | 3 |
| **Sprint** | Sprint 1 |

**Description:**

Update `/Users/apple/cencori/packages/python-sdk/src/cencori/metrics.py` to call `/api/v1/metrics?period=...` instead of path params.

**Acceptance Criteria:**

1. `day`/`week`/`month` periods return successful responses.
2. Auth handling in `/Users/apple/cencori/packages/python-sdk/src/cencori/client.py` remains unchanged.
3. Tests are added/updated to verify query-param format.

---

### CEN — Go SDK metrics endpoint compatibility

| Field | Value |
|---|---|
| **Issue Type** | Story |
| **Priority** | Medium |
| **Labels** | `cencori`, `kpi-delivery`, `kpi-quality`, `beginner`, `go-sdk` |
| **Story Point Estimate** | 3 |
| **Sprint** | Sprint 1 |

**Description:**

Update `/Users/apple/cencori/cencori-go/metrics.go` to call `/api/v1/metrics?period=...` instead of path params.

**Acceptance Criteria:**

1. `day`/`week`/`month` periods return successful responses.
2. Error handling remains consistent with `/Users/apple/cencori/cencori-go/errors.go`.
3. Tests/examples verify URL format and response parsing.

---

### CEN — Add v1 contract smoke tests for models and metrics

| Field | Value |
|---|---|
| **Issue Type** | Story |
| **Priority** | High |
| **Labels** | `cencori`, `kpi-quality`, `kpi-ownership`, `testing` |
| **Story Point Estimate** | 5 |
| **Sprint** | Sprint 1 |

**Description:**

Add contract tests for `/api/v1/metrics` and `/api/v1/models`.

**Acceptance Criteria:**

1. Tests fail when endpoint path or required response keys drift.
2. Tests run in CI.
3. Local run instructions are documented.

---

### CEN — Sync Python and Go SDK docs for metrics usage

| Field | Value |
|---|---|
| **Issue Type** | Task |
| **Priority** | Medium |
| **Labels** | `cencori`, `kpi-ownership`, `kpi-collaboration`, `docs` |
| **Story Point Estimate** | 2 |
| **Sprint** | Sprint 1 |

**Description:**

Update metrics examples in `/Users/apple/cencori/packages/python-sdk/README.md` and `/Users/apple/cencori/cencori-go/README.md`.

**Acceptance Criteria:**

1. Examples reflect current endpoint behavior.
2. Snippets run with only API key changes.
3. One sample output block is included per SDK.

---

## Sprint 2

### CEN — Add /api/v1/embeddings compatibility route

| Field | Value |
|---|---|
| **Issue Type** | Story |
| **Priority** | High |
| **Labels** | `cencori`, `kpi-delivery`, `kpi-ownership`, `api` |
| **Story Point Estimate** | 5 |
| **Sprint** | Sprint 2 |

**Description:**

Create `/api/v1/embeddings` route that delegates to `/Users/apple/cencori/app/api/ai/embeddings/route.ts`.

**Acceptance Criteria:**

1. `POST /api/v1/embeddings` works with OpenAI-compatible payload.
2. Response shape matches embedding clients.
3. Backward-compatibility test is added.

---

### CEN — Align Python embeddings client to canonical API

| Field | Value |
|---|---|
| **Issue Type** | Story |
| **Priority** | Medium |
| **Labels** | `cencori`, `kpi-delivery`, `kpi-quality`, `python-sdk` |
| **Story Point Estimate** | 3 |
| **Sprint** | Sprint 2 |

**Description:**

Update `/Users/apple/cencori/packages/python-sdk/src/cencori/ai.py` for canonical embeddings endpoint and response handling.

**Acceptance Criteria:**

1. Embeddings calls pass smoke/integration tests.
2. 4xx/5xx errors are actionable.
3. README snippet is updated if behavior changed.

---

### CEN — Align Go embeddings client to canonical API

| Field | Value |
|---|---|
| **Issue Type** | Story |
| **Priority** | Medium |
| **Labels** | `cencori`, `kpi-delivery`, `kpi-quality`, `go-sdk` |
| **Story Point Estimate** | 3 |
| **Sprint** | Sprint 2 |

**Description:**

Update `/Users/apple/cencori/cencori-go/chat.go` and related request utilities for canonical embeddings endpoint.

**Acceptance Criteria:**

1. Endpoint call is correct.
2. Response unmarshalling is validated by tests.
3. No chat-completions regressions.

---

### CEN — Resolve TS Memory SDK search contract gap

| Field | Value |
|---|---|
| **Issue Type** | Story |
| **Priority** | High |
| **Labels** | `cencori`, `kpi-ownership`, `kpi-quality`, `typescript-sdk` |
| **Story Point Estimate** | 5 |
| **Sprint** | Sprint 2 |

**Description:**

Reconcile `/Users/apple/cencori/packages/sdk/src/memory/index.ts` with actual memory API routes under `/app/api/memory/*` and `/app/api/projects/[projectId]/memory/*`.

**Acceptance Criteria:**

1. One canonical search path is implemented and documented.
2. SDK search works end-to-end.
3. Contract test catches future route drift.

---

## Innovation 20%

### CEN — Scan false-positive reduction experiment

| Field | Value |
|---|---|
| **Issue Type** | Task |
| **Priority** | Medium |
| **Labels** | `cencori`, `kpi-innovation`, `kpi-ownership`, `scan`, `spike` |
| **Story Point Estimate** | 5 |
| **Sprint** | Innovation 20% |

**Description:**

Run false-positive reduction experiment in `/Users/apple/cencori/lib/scan/llm-filter.ts` using real scan outputs.

**Acceptance Criteria:**

1. Baseline vs experiment report is produced.
2. Precision/recall tradeoff is documented.
3. Follow-up implementation ticket is created if safe improvement is confirmed.

---

### CEN — Provider routing dry-run scorer prototype

| Field | Value |
|---|---|
| **Issue Type** | Task |
| **Priority** | Medium |
| **Labels** | `cencori`, `kpi-innovation`, `kpi-delivery`, `gateway`, `spike` |
| **Story Point Estimate** | 5 |
| **Sprint** | Innovation 20% |

**Description:**

Add non-invasive dry-run recommendation logging in `/Users/apple/cencori/lib/providers/router.ts`.

**Acceptance Criteria:**

1. Feature flag controls dry-run behavior.
2. Live routing behavior does not change.
3. Findings note includes go/no-go recommendation.

---

## Summary

| Sprint | Items | Total Story Points |
|---|---|---|
| Sprint 1 | 4 | 13 |
| Sprint 2 | 4 | 16 |
| Innovation 20% | 2 | 10 |
| **Grand Total** | **10** | **39** |

### KPI Coverage

| KPI Area | Item Count |
|---|---|
| `kpi-delivery` | 6 |
| `kpi-quality` | 6 |
| `kpi-ownership` | 6 |
| `kpi-collaboration` | 1 |
| `kpi-innovation` | 2 |

### Priority Breakdown

| Priority | Item Count |
|---|---|
| High | 3 |
| Medium | 7 |

### Issue Type Breakdown

| Issue Type | Item Count |
|---|---|
| Story | 7 |
| Task | 3 |
