# Cencori × CostGraph — integration spec

**Status:** built and verified end to end against live CostGraph (2026-10-14). **Model rates are live in CostGraph's marketplace:** 87 models × 4 buckets = 348 rows under `host: cencori`. **FOCUS push works:** a test tenant shows Cencori spend by provider, model, project and customer, and re-sends are idempotent. Several doc/behaviour mismatches were found and fixed on our side ([§8](#8-verification-with-costgraph)).
**Owner:** Bola · **Counterpart:** CostGraph founder

## 1. Summary

CostGraph (formerly Baseline; the Pricing API still lives on `pricing.baselinehq.cloud`) is a FinOps platform. It covers about 60 billing integrations, a Kubernetes operator, a VM agent, GPU tracking, budgets and anomaly alerts, Graph AI over chat, Slack and MCP, and exports to billing tools. It also offers a **Pricing API**: a cross-cloud compute and disk catalogue, recommendations, and a marketplace where an organization publishes its own rates, including per-token model rates.

Cencori is an AI gateway and infrastructure layer. It meters every request at a cost it computes itself, and attributes it to project, end user and tenant.

The fit has three parts. All three are built:

| # | Integration | Direction | What it gives |
| - | --- | --- | --- |
| 1 | **Cencori as a CostGraph source**: FOCUS 1.2 push and pull | Cencori → CostGraph | AI spend through Cencori lands beside the customer's cloud bill, attributed per project, end user or tenant. Puts Cencori in CostGraph's integration list next to LiteLLM, Helicone and OpenRouter. |
| 2 | **Cencori rates in CostGraph's marketplace** | Cencori → CostGraph | Anything CostGraph prices for traffic through Cencori, including AI-gateway telemetry and agentgateway/Envoy scrapes, resolves to Cencori's real per-bucket rates. |
| 3 | **CostGraph Pricing API in Cencori Compute** | CostGraph → Cencori | Cross-cloud placement quotes for Compute machine shapes. This is the input to the v2 own-runtime decision. Compute rates are published so CostGraph can price agents hosted on Cencori. |

We chose not to integrate through CostGraph's **telemetry** path (`costgraph_gen_ai_usage_total` remote-write). That path suits self-hosted gateways that count tokens but not dollars. Cencori already knows the exact charge per request, including cache buckets, long-context tiers and BYOK, so costed FOCUS rows are strictly more accurate than CostGraph re-pricing our token counts.

## 2. Architecture

```
                         ┌──────────────── Cencori ────────────────┐
 requests ──► gateway ──►│ ai_requests (+ cache_read / cache_write │
                         │   / uncached_prompt token buckets)      │
                         │            │                            │
                         │  focus_usage_daily() SQL rollup         │
                         │     │                      │            │
                         │ GET /v1/usage/focus   cron finops-push  │──► POST api.costgraph.ai
                         │  (pull, cuk_ keys)    (nightly, per org)│      /api/v1/tenant/billing/focus
                         │                                         │
                         │ model_pricing ── cron costgraph-        │──► POST/PATCH pricing.baselinehq.cloud
                         │ compute rates     marketplace (daily)   │      /v1/marketplace/{models,compute}
                         │                                         │
                         │ /api/internal/compute/placement-quote ◄─┼─── POST /v1/pricing/compute
                         └─────────────────────────────────────────┘     POST /v1/recommendations/compute
```

| Piece | Where |
| --- | --- |
| Token buckets at log time | `lib/gateway-middleware.ts` (`tokenBucketColumns`, `logGatewayRequest`), adapters in `lib/providers/*`, `lib/gateway/stream-usage.ts` |
| Schema, rollup function | `supabase/migrations/20261014_120000_costgraph_finops.sql` |
| FOCUS mapping | `lib/finops/focus.ts` |
| Rollup reader | `lib/finops/usage-source.ts` |
| Export keys (`cuk_`) | `lib/finops/export-keys.ts` |
| Pull endpoint | `app/api/v1/usage/focus/route.ts` |
| CostGraph client (both hosts) | `lib/finops/costgraph.ts` |
| Push orchestration | `lib/finops/costgraph-push.ts`, `app/api/cron/finops-push/route.ts` |
| Marketplace sync | `lib/finops/costgraph-marketplace.ts`, `app/api/cron/costgraph-marketplace/route.ts` |
| Compute pricing | `lib/compute/placement-pricing.ts`, `app/api/internal/compute/placement-quote/route.ts` |
| Console | Org settings → Advanced → Usage export (`app/(app)/[orgSlug]/~/settings/UsageExportSettings.tsx`, actions in `actions.ts`) |
| Public docs | `content/docs/platform/usage-export.mdx`, `content/docs/integrations/costgraph.mdx` |

## 3. Data contract (FOCUS 1.2)

**Grain:** one record per UTC day × project × environment × upstream provider × model × endpoint family × sub-account.

| FOCUS column | Value |
| --- | --- |
| `BillingAccountId` / `Name` / `Type` | Cencori organization id / name / `Organization` |
| `BillingPeriodStart/End` | UTC calendar month of the charge |
| `ChargePeriodStart/End` | The UTC day |
| `ChargeCategory` / `ChargeFrequency` | `Usage` / `Usage-Based` |
| `Provider`, `ProviderName`, `ServiceProviderName`, `InvoiceIssuer(Name)` | `Cencori`. Constant, because CostGraph binds a push connection to one provider. |
| `Publisher(Name)` | Upstream model provider (`anthropic`, `openai`, …) |
| `ServiceName` | By endpoint family: `Cencori Text Generation`, `Cencori Embeddings`, `Cencori Image Generation`, `Cencori Audio`, `Cencori Vision`, `Cencori Documents`, `Cencori Moderation`, `Cencori Web Search` (was `Cencori AI Gateway` until 2026-10-14, §11.3) |
| `ServiceCategory` / `ServiceSubcategory` | `AI and Machine Learning` / `Generative AI` |
| `SubAccountId` / `Type` / `Name` | Per connection setting: project (with name), end user, tenant, or none. Only set when there is a value, because CostGraph rejects Name/Type without an Id. |
| `ResourceId` / `Name` / `Type` | Cencori project id / name / `Project` |
| `SkuId` / `SkuMeter` | `provider/model` / `<endpoint family>/tokens` or `/requests` |
| `ConsumedQuantity` / `ConsumedUnit` | Total tokens / `Tokens`, or request count / `Requests` for untokenised endpoints |
| `BilledCost` = `EffectiveCost` = `ListCost` = `ContractedCost` | `cencori_charge_usd`. No markup, so all equal. |
| `Tags` | `cencori:project`, `cencori:environment`, `cencori:endpoint` |
| `x_RequestCount`, `x_InputTokens`, `x_CacheReadTokens`, `x_CacheWriteTokens`, `x_OutputTokens`, `x_PromptTokens` | Token buckets |
| `x_UnsplitRequests` | Requests whose input and cache split is unknown (pre-2026-10-14 rows, or a provider that reported cache activity without an uncached count) |
| `x_UpstreamProviderCost` | What the upstream provider charged. For BYOK this is non-zero while the cost columns are 0. |

**Decisions worth knowing:**

- **BYOK reports zero cost.** The customer's own provider account bills it. If CostGraph also pulls that provider (e.g. their OpenAI integration), reporting it here would double-count.
- **Refusals and pre-provider errors are excluded** (no tokens, no cost).
- **Strings, not numbers**, for every cost and quantity, as CostGraph's push API requires.
- **Restatement:** each day is sent once with `complete: true` after it closes. From the 3rd, the whole previous month is re-sent with `complete: true`. Windows larger than one page (5,000 rows) use the same `batch_id` with `row_offset`, and only page 1 is `complete`. An empty window is skipped, because CostGraph refuses `complete: true` with zero rows.
- **First push** for a new connection sends the month to date. An outage catches up at most 35 days per run.

## 4. Token buckets (closing our gap)

Before this change, `ai_requests` stored only `prompt_tokens` and `completion_tokens`, and **`prompt_tokens` was not comparable across providers**. OpenAI, Gemini and OpenAI-compatible adapters report the whole prompt there, including cache reads. Anthropic non-streaming reports it with cached tokens excluded. Streaming always reports the whole prompt. So the uncached input could not be recovered after the fact.

Now:

- `TokenUsage.uncachedPromptTokens` is set by the Anthropic, OpenAI, OpenAI-compatible and Gemini adapters on non-streaming responses. `settleStreamUsage` exposes it for streams.
- `logGatewayRequest` writes `cache_read_tokens`, `cache_write_tokens` and `uncached_prompt_tokens`. NULL means the provider did not say, which is kept distinct from zero.
- A request with no cache reporting stores its whole prompt as uncached. A request that reports cache activity without the uncached count stores NULL and shows up in `x_UnsplitRequests`. It is never guessed.
- **Safe before the migration is applied:** if PostgREST rejects the new columns, the row is re-inserted without them and a warning is logged once. Billing rows are never lost.
- Threaded through `/v1/chat/completions`, `/api/ai/chat`, `/v1/responses` and `/v1/sessions` (turns and approve).

## 5. Marketplace publishing (Cencori → CostGraph catalogue)

- One row per model per bucket, `host: "cencori"`, `region: "global"`, `unit_price_per_mtok = per-1K × 1000`.
- **`model` is `provider/model`** (e.g. `anthropic/claude-sonnet-5`, `groq/openai/gpt-oss-120b`), the same string as the FOCUS `SkuId`. CostGraph keys a price on (model, host, region, bucket) without the provider, so with bare names the same model sold through two upstreams overwrote itself. That happened on the first publish (gpt-oss via Groq and Vercel) and was repaired.
- Only `model, provider, publisher, host, region, token_bucket, unit_price_per_mtok, currency, tags` are sent. `model_id` → 400; `source`/`source_url`/`effective_from` → 500 (CostGraph sets them). Our id and source URL ride in `tags`.
- Audio models priced per minute or per character are **not** published. Their token rates are zero placeholders, and CostGraph can't express unit pricing (ask 3).
- `cache_read` uses the stored cached rate, or the input rate when unset. That is what the gateway bills, because it fails toward the input rate, not zero. `cache_write` is the input rate × the provider multiplier (Anthropic 1.25×).
- All four buckets are always published, because CostGraph resolves a missing bucket to *no price*, not zero.
- **Not representable:** long-context tiers (no request-size dimension) and Anthropic's 1-hour cache write (2×). Rows carry tags saying so.
- **Diffed:** unchanged rows are not re-sent. Changed rows are PATCHed, which closes the old version and returns a new id, so the history of what we charged survives. A re-POST would overwrite in place. Rows for models we no longer sell are reported and deleted only with `?prune=1`.
- Rates come from `getAllActivePricing()`, the same row mapping the gateway bills with. Expired promos without a successor are skipped, and scheduled changeovers are applied.

## 6. Compute (CostGraph Pricing API → Cencori)

- Fly Machines isn't in CostGraph's catalogue, so we publish our machine tiers (256 MB–4 GB, 1 shared vCPU, per runtime region) as `Base`/`BaseCompute` marketplace rows. That lets CostGraph customers price agents hosted on Cencori. Rows are priced per vCPU-hour and GB-hour from `COMPUTE_SHARED_CPU_HOURLY_USD` and `COMPUTE_RAM_GB_HOURLY_USD`. No rate is hard-coded.
- `GET /api/internal/compute/placement-quote?memory_mb=512&region=iad[&providers=AWS,Hetzner][&any_continent=1]` (internal only) returns the cheapest equivalent per cloud on the same continent. Savings are measured against **our** hourly cost, computed locally from those two rates.
- **Anchor:** recommendations need a machine CostGraph can price as the starting point. A `Base` shape can't be one: it returns 404 on pricing and 500 on recommendations. So we anchor on an AWS Graviton burstable (`t4g.medium`, or larger for bigger shapes) in the AWS region nearest the runtime region, and pass our shape as `usage`. The anchor must sit *above* the shape, because CostGraph only returns machines cheaper than it.
- All lookups pass `persist=false`, so we never write rows into their catalogue by asking a question.
- Live sample (1 vCPU / 512 MB near iad, 2026-10-14): Vultr $0.0030/h, Alibaba $0.0039, AWS t4g.nano $0.0042, GCP $0.0046, UpCloud $0.0050, Azure B1ls $0.0052, DigitalOcean $0.0060, … Hetzner cpx11 $0.0086 (14 clouds).

## 7. Runbook

### Apply

1. Apply `supabase/migrations/20261014_120000_costgraph_finops.sql` manually. Migrations here are not auto-applied. It is idempotent. On a large `ai_requests`, run the `CREATE INDEX` alone with `CONCURRENTLY` first.
2. Verify the token buckets: make a cached Anthropic request, then check `cache_read_tokens` on its `ai_requests` row.

### Environment

| Variable | Needed for |
| --- | --- |
| `COSTGRAPH_API_KEY` | Cencori's own CostGraph key (`bl_…`), used for the marketplace sync and placement quotes, and for anything else we take from CostGraph later. Set in Vercel (all environments) and `.env.local` on 2026-10-14. |
| `COMPUTE_SHARED_CPU_HOURLY_USD`, `COMPUTE_RAM_GB_HOURLY_USD` | Publishing Compute rates (optional) |
| `COMPUTE_REGIONS` | Runtime regions to publish (default `FLY_REGION` or `iad`) |
| `COSTGRAPH_API_URL`, `COSTGRAPH_PRICING_API_URL` | Only to point at a CostGraph staging environment |
| `CRON_SECRET`, `ENABLE_VERCEL_CRON=true` | Existing cron gate |

Customer CostGraph keys are **not** environment variables. They are stored per organization, encrypted with `lib/encryption`.

### Schedules (`.github/workflows/external-cron-jobs.yml`)

| Job | When (UTC) | Route |
| --- | --- | --- |
| `finops-push` | 04:17 daily | `/api/cron/finops-push` |
| `costgraph-marketplace` | 05:41 daily | `/api/cron/costgraph-marketplace` (`?dry_run=1` to preview) |

Both can be triggered manually from the workflow's dispatch menu.

### First live run

```bash
# Preview the catalogue we would publish (no writes)
curl -H "Authorization: Bearer $CRON_SECRET" "https://cencori.com/api/cron/costgraph-marketplace?dry_run=1"
```

## 8. Verification with CostGraph

**Verified live on 2026-10-14** with Cencori's `bl_` key, read-only calls only:

| Check | Result |
| --- | --- |
| One `bl_` key on both hosts | ✅ Works on `pricing.baselinehq.cloud` and `api.costgraph.ai` |
| FOCUS push auth | ⚠️ **Their docs say `Authorization: Bearer`; the live API returns 401 "API key required" for Bearer and accepts `X-API-Key`.** Our client now sends `X-API-Key`. Before the fix, every push would have failed. |
| Platform error shape | ⚠️ `{"message", "status"}`, not RFC 9457 like the Pricing API. Our client parses both. |
| Push to an unknown connection | 404 "Could not find resource" (probed with a fake `fpc_` id; nothing ingested) |
| `/v1/providers`, marketplace list/filters | ✅ As documented. Our marketplace is empty. Model filters: model, provider, region, token_bucket (no `host`, as expected) |
| `/v1/pricing/compute` (AWS t4g.nano) | ✅ $0.0042/h, shape matches our types |
| `/v1/pricing/compute` with `Base` + custom region | ❌ 404 `price_not_found` until a rate is published |
| `/v1/recommendations/compute` from a `Base` anchor | ❌ **500 internal_error** (their bug). We anchor on AWS instead (§6). |
| Recommendations breadth | Only machines cheaper than the anchor come back (undocumented). |
| `same_continent: true` | ⚠️ Leaks: an us-east-1 anchor still returned Linode au-mel, CUDO Sweden and Northflank europe-west |

**Marketplace writes (2026-10-14, published):**

| Check | Result |
| --- | --- |
| POST natural key | (model, host, region, bucket), **provider not part of it**. Re-POSTing the same key upserts in place (same id), including a price change. |
| PATCH | Versions the row: returns a new id; the list endpoint shows only live versions |
| `model_id` on write | ❌ 400 "request body is not valid JSON" |
| `source`, `source_url`, `effective_from` on write | ❌ 500 for an existing key; server sets `source: marketplace`, `source_url: marketplace://cencori` |
| Batch of 200 entries | ✅ |

**FOCUS push setup (2026-10-14):** test tenant `cencori-focus-test` created in the CostGraph app. Tenants can't be created with an API key (`401 Valid Bearer token required`), and push connections have no create endpoint, so both are dashboard-only. FOCUS push is in the sidebar's **Integrations → "Anything Else"** category, not under Settings as the docs say. The create form asks for a **billing account**, which must equal our `BillingAccountId` (the Cencori organization id); the console's CostGraph card now shows it with a copy button. API keys belong to one tenant: our `default`-tenant key got 404 on the test connection, and a key created in `cencori-focus-test` worked.

**FOCUS push, end to end (2026-10-14).** A labelled test batch was sent through the real pipeline (`pushWindow` → `toFocusRecord` → client) into connection `fpc_7vo9U4J0XqLYbKoH`: 5 records for 2026-10-13, end-user sub-accounts, paged 2/2/1 under one `batch_id`.

| Check | Result |
| --- | --- |
| Provider binding on first push | ✅ Connection bound to `cencori` (lower-cased), `ingest_mode: push`, `status: active` |
| FOCUS 1.2 columns incl. `ProviderName`/`ServiceProviderName`/`InvoiceIssuer(Name)` and `x_*` | ✅ Accepted, no rejections |
| Paging (`complete` on page 1, `batch_id` + `row_offset`) | ✅ 2 + 2 + 1 rows ingested |
| Totals | ✅ $1.78 = sum of records; by service `Cencori AI Gateway` |
| Sub-accounts | ✅ `test-customer-a` $1.3275, `test-customer-b` $0.375, unattributed $0.0775 |
| Resource | ✅ Project id with its name, type `Project` |
| Provider page (`/tenant/cost/providers/cencori`) | ✅ `tokens` section; `tokensByModel` keyed by our `SkuId` (`anthropic/claude-sonnet-5` 551k tokens $1.5825, …); image generation as a `request` unit ($0.04/request) |
| Re-sending the same day | ✅ Still $1.78: `complete: true` replaces the window |
| `x_` token buckets in the read APIs | Stored but not surfaced in cost/provider responses (expected; they're extensions) |

The test rows remain in `cencori-focus-test` on connection `fpc_7vo9U4J0XqLYbKoH`, labelled `TEST Nicole` / `Bola (TEST)`.

**Real usage reconciliation (2026-10-14).** The Arcie organization (owned by Bola's bola@cencori.com account) was connected exactly as the console does it: an `organization_finops_connections` row with the key encrypted under the production secret, to connection `fpc_WK-AP5vu_8Lrodrj` (billing account = Arcie org id). `runConnectionPush` sent 13 October days and then restated September: 84 records, all accepted.

| Window | Cencori `ai_requests` (raw rows) | CostGraph | Difference |
| --- | --- | --- | --- |
| September 2026 | $1.941727 (840 requests) | $1.941727 | $0 |
| October 1–13 | $35.163848 (1,334 requests) | $35.163848 | $0 |

Per-model figures match too (e.g. `anthropic/claude-opus-5-5` $24.4166, `maximo/maximo-atlas-1.3` $8.9745). One finding on our side: `cerebras/gpt-oss-120b` rows carry cost but zero tokens, so they export as request-priced rows and don't appear in CostGraph's tokens-by-model view. Cerebras usage reporting is worth checking.

The Arcie connection stays configured; the nightly `finops-push` cron continues it from 2026-10-14 once `ENABLE_VERCEL_CRON` is set.

**Window replace doesn't replace (found 2026-10-14).** After renaming `ServiceName` we re-sent September with `complete: true` and then `complete + overwrite: true` (the sibling usage endpoint's flag; CostGraph echoed `overwrite: true`). The old rows were **not** removed. September showed $1.94 under "Cencori AI Gateway" *and* $1.94 under "Cencori Text Generation", and stayed that way over several minutes. What actually happens is an upsert by row identity, and `ServiceName` is part of that identity. Re-sending identical rows is idempotent, which is why the earlier test passed, but any row whose identity changes leaves its old version behind.

**Deleting a connection does not purge its data either.** Rows are kept against the billing account, not the connection. After deleting the Arcie connection the tenant read empty, but creating a new connection for the same billing account (`fpc_vzVFxxZHkLgZ24-b`) brought every old "Cencori AI Gateway" row back. Re-sending September with an extra $0 row under the old service name (to see whether replace is scoped per service) changed nothing. **No API path removes ingested FOCUS data**; only CostGraph can purge it. The test tenant `cencori-focus-test` therefore double-counts Arcie (Sept $3.88 vs $1.94 real; Oct 1–13 $70.33 vs $35.16 real) and should be deleted, or purged by CostGraph. Consequences for us:

- Nightly pushes and month restatements are safe while row identity is stable.
- **Changing anything in a record's identity** (`ServiceName`, `SkuId`, sub-account mode, `ResourceId`) permanently double-counts the history already sent, with no way for us to undo it. Treat FOCUS identity columns as frozen; any future change ships only to new connections, or is coordinated with CostGraph to purge first.
- A record that disappears from a later restatement (e.g. usage reclassified) is not removed either.

**Official tenant (2026-10-14).** Tenant `Cencori` (`046ee51d-d1a3-4425-9790-f83df5c0c443`), connection `fpc_aHI0Rxdxnd8OXClP`, billing account = Arcie org, sub-account mode `project` (Arcie traffic has no tenants and only 2 internal end-user ids). Arcie's saved connection points there with the official key and reset progress. **Blocked on CostGraph:** every first push returns `500 Failed to record connection provider`, before any row is ingested (twice, minutes apart). Most likely the deleted test tenant's connection still holds the `cencori` binding for the same billing account. We don't work around it by sending another provider name, because the first binding is permanent. The nightly `finops-push` retries daily and sends October to date plus September on the first night it succeeds. Also: the official key carries every scope; replace it with a `focus:write`-only key when convenient.

**Still to verify:**

1. **`Base`/`BaseCompute` rows with a custom region** (`cencori-iad`) price through `/v1/pricing/compute` once Compute rates are published.
2. **Rate limits** on `/v1` and on FOCUS ingest. The client retries 429 and 5xx with `Retry-After`.

## 9. Asks for CostGraph

1. **Expose the model catalogue on the Pricing API.** Their "hosted reference rate" catalogue exists inside the platform but `/v1/marketplace/models` only lists our own rows. A public read lets us cross-check our `model_pricing` against an independent source, since catalogue drift has bitten us before.
2. **List Cencori as a first-class integration** (Integrations → Cencori), pre-wired to push or pull, next to LiteLLM, Helicone and OpenRouter. Today a customer has to find the generic "FOCUS push" card under "Anything Else", and the docs point to Settings.
3. **Price non-token units.** Their telemetry already captures images, audio seconds and characters but only prices tokens. Our voice, image and vision traffic needs that.
4. **Long-context tiers** in the model price schema (a threshold plus a second rate), or a documented convention.
5. **Fix the FOCUS push docs:** they show `Authorization: Bearer`, but the API only accepts `X-API-Key`. Anyone following them gets 401. Also unify the error shape (platform `{message,status}` vs Pricing API RFC 9457) and move the Pricing API off `baselinehq.cloud`.
6. **SDK distribution.** The TypeScript SDK is on GitHub Packages, which needs a token, and Python isn't on PyPI. Their own TS example uses `RecommendationsApi` without importing it.
7. **Docs vs reality.** The Pricing API intro lists 9 providers; the OpenAPI provider enum has about 50, including GPU clouds. Worth reconciling, since it undersells them.
8. **Marketplace write validation:** `model_id` fails as "not valid JSON" (400), and `source`/`source_url`/`effective_from` return 500 instead of a 422 naming the field. Provider isn't part of a model price's key, so one org can't price the same model from two upstreams under one name. Recording provider in the key, or documenting it, would avoid silent overwrites.
9. **Bugs found while integrating:** `/v1/recommendations/compute` returns 500 when the anchor is a `Base` shape; `same_continent` returns machines from other continents (au-mel, Sweden for a us-east-1 anchor); "only cheaper than the anchor" is undocumented and surprising for placement queries. An option to return every provider's cheapest regardless of anchor price would help.
10. **Make window replace work as documented, and let deletes delete.** `complete: true` (and `overwrite: true`) should delete what the connection previously ingested inside the window, not upsert by row identity. Deleting a connection should delete its data rather than leave it to reattach to the next connection for the same billing account. Today nothing a customer or partner can call removes ingested FOCUS data. **Immediate:** the first push to connection `fpc_aHI0Rxdxnd8OXClP` (tenant `Cencori`) fails with `500 Failed to record connection provider`. Please clear the stale `cencori` provider binding for billing account `850ca097-744c-4f19-b370-df75d69dbf6f` left by the deleted `cencori-focus-test` tenant, and make sure none of that tenant's rows reattach to the official one.

## 10. Commercial notes (for the partnership conversation)

- CostGraph pricing: Pricing API $0.001/request; Graph AI and MCP $0.01/request; compute monitoring free under $500/month of spend, then max($15/node, 2%).
- Our marketplace sync and placement quotes are low volume (one diffed sync a day, quotes on demand), so negligible cost.
- **Overlap to agree on:** CostGraph billing exports (to Stripe, Metronome, Orb, …) and Cencori end-user billing and rate plans both turn usage into customer invoices. Proposed line: Cencori meters and bills AI usage at request time; CostGraph allocates and reports total cloud spend. Neither invoices the other's line items.
- **Co-marketing:** "Cencori in CostGraph" integration page and docs (ours are written: `/docs/integrations/costgraph`).

## 11. Listing spec: how Cencori appears in CostGraph

**The rule.** CostGraph files every integration under a category string, and today Cencori would land next to LiteLLM, Helicone and OpenRouter as "AI gateway". That's wrong for us. Our canonical narrative (`docs/company/VOLUME_5_GTM.md`) is:

> **Cencori is a deep technology company building the infrastructure AI runs on.**

The Gateway is the live control-plane *foundation*, not the identity (GTM-02 §3). The listing has to pass GTM-08 Q1: *does this make Cencori sound like a deep technology company rather than a Gateway vendor?* It also has to obey the status rules: everything the card says must be live today (GTM-07). Models is **in development** and managed compute is **Next**, so neither appears as a capability.

### 11.1 The card (Integrations page)

Mapped to the fields of CostGraph's provider catalogue (`GET /api/v1/integrations/focus/providers`):

| Field | Value | Why |
| --- | --- | --- |
| `slug` | `cencori` | Already the provider our push connections bind to |
| `name` | **Cencori** | Company name only. Not "Cencori AI Gateway", "Cencori Gateway" or "Cencori AI" |
| `category` (first words on the card) | **AI infrastructure** | Their AI cards read "AI / LLM" or "AI gateway / observability". Ours says what the company is |
| Card body | **AI infrastructure. Cencori sends your model spend daily — by project and by customer.** | Their pattern is `<category>. <how data arrives>.`; everything here is live and verified |
| Tab | **AI and Machine Learning** | Not "Compute": managed compute is publicly "Next" |
| Logo | Cencori mark: four interlocking circles. `public/logos/icon-black.svg` (light UI) and `icon-white.svg` (dark UI), square SVG | — |
| Button | **Connect** (opens the preset push form, §11.2) | Same verb as every other card |
| Setup guide | https://cencori.com/docs/integrations/costgraph | Live |
| `grain` | day × project × model × customer, at what Cencori billed | Matches our FOCUS records |

**Provider page header** (`/cost/providers/cencori`, where CostGraph shows a description):

> Cencori is a deep technology company building the infrastructure AI runs on. This connection carries what your products spend through Cencori — model calls across text, embeddings, images, audio and vision — priced at what Cencori billed, by project and by customer.

### 11.2 Connect flow

Today a customer has to find the generic "FOCUS push" card under "Anything Else", leave Provider on "Detect from my first push", and guess what "billing account" means. The Cencori card should open the same push form, preset:

| Form field | Preset |
| --- | --- |
| Connection name | `Cencori` |
| Provider | **Cencori**, locked (not "Detect from my first push") |
| Billing account | Relabelled **Cencori organization ID**, helper text *"In Cencori: Organization settings → Advanced → Usage export → Billing account id"*, validated as a UUID |
| After create | Show the `fpc_` id **and** offer "Create a `focus:write` key for this tenant", so both values are on one screen to paste into Cencori |

**Next step (ask):** an API to create a push connection and its key, authorised with "Sign in with CostGraph" (`focus:write`). Then Cencori's console can offer a one-click **Connect CostGraph** and nobody copies ids between two dashboards.

### 11.3 Labels inside CostGraph come from our data

The card is one surface. Everything else CostGraph shows about us (service breakdowns, provider page, Graph AI answers) comes from the FOCUS columns we send. Today:

| Column | Sent today | Shown in CostGraph as | Proposed |
| --- | --- | --- | --- |
| `Provider` / `ProviderName` | `Cencori` | provider `cencori` | keep |
| `ServiceName` | ~~`Cencori AI Gateway`~~ on every row until 2026-10-14 | the top service label | **Changed 2026-10-14** to service lines by endpoint family (below); September and October restated in CostGraph |
| `ServiceCategory` / `ServiceSubcategory` | `AI and Machine Learning` / `Generative AI` | category | keep |
| `Publisher` | upstream model maker | publisher | keep |
| `SkuId` | `provider/model` | tokens-by-model | keep |

`ServiceName` values (live). They describe the work and don't invent product brands (GTM-02 §4: no casual commercial names):

| Endpoint family | `ServiceName` |
| --- | --- |
| chat, responses, sessions | Cencori Text Generation |
| embeddings, memory search | Cencori Embeddings |
| images | Cencori Image Generation |
| audio (speech, transcription) | Cencori Audio |
| vision | Cencori Vision |
| documents | Cencori Documents |
| moderation | Cencori Moderation |
| web | Cencori Web Search |

Changing it restates cleanly: the push replaces whole windows, so re-sending October relabels it in place.

### 11.4 Words to keep off the listing

- "AI gateway", "LLM gateway", "LLM proxy", "model router". Gateway is how traffic arrives, not what Cencori is.
- "OpenRouter / LiteLLM alternative", or any comparison to another listing (GTM-05).
- "One API for every model". Approved as Gateway copy only, never the company story (GTM-02 §8).
- "AI platform", "all-in-one", "complete stack" (restricted language).
- Cencori Models, Compute, Arcie's managed API, or any capability not live.

### 11.5 Approved lines for co-marketing

- Company: **Cencori is a deep technology company building the infrastructure AI runs on.**
- Integration: **Cencori spend in CostGraph, by model, project and customer.**
- Proof (internal until we publish the source): reconciled to the cent against Cencori's own records, Sept–Oct 2026 (§8).
- CTA on our side: **Build with Gateway** for the product, **Talk to Cencori** for the partnership (GTM-06).

A visual mockup of the card and the preset form is in `docs/partners/costgraph-listing-mockup.html`.
