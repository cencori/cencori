# Porter implementation audit — 7 September 2026

Follow-up, 8 September: the four P1 fixes are implemented and locally verified. See the [implementation and rollout notes](/Users/apple/cencori/output/porter-p1-fixes-2026-09-08.md). The findings below preserve the original audit; production deployment remains pending.

Porter has a substantial working foundation, but the current implementation needs a correctness and access-control pass before billing or a paid pilot. Four high-priority defects affect credential scope, preview access, rate-limit recovery, and refresh coverage. The build-status document understates these defects and contains two stale technical claims.

This audit covers the local `feat/porter-onboarding` working tree, including its uncommitted console and widget changes. Application code was not changed. Production deployment settings, database migration state, payment configuration, and real provider latency were not verified. The referenced `Porter_by_Cencori_PRD_v0.1.docx` was not found in the workspace or attachments; pricing intent below comes from the pasted status document.

## Findings, in priority order

### 1. [P1] The published widget key permits direct general-purpose gateway calls

Provisioning creates an ordinary publishable project key without endpoint or model restrictions. A visitor on an allowed domain can submit that key directly to `/api/v1/chat/completions`, supplying a model and prompt and bypassing Porter sessions, readiness, retrieval, and Porter-specific limits.

Ordinary gateway guards, project rate limits, and configured budget controls still apply. However, Porter onboarding creates a free organization, and the gateway skips credit admission and debit for free tiers. There is no cumulative Porter entitlement to bound this exposure. This makes the documented billing gap more urgent than simply adding checkout.

Evidence: [key provisioning](/Users/apple/cencori/lib/porter/provision.ts:83), [gateway publishable-key admission](/Users/apple/cencori/lib/gateway-middleware.ts:546), [caller-selected model](/Users/apple/cencori/app/api/v1/chat/completions/route.ts:369), [free onboarding tier](/Users/apple/cencori/app/api/onboarding/porter/route.ts:120), [credit admission exception](/Users/apple/cencori/lib/gateway-middleware.ts:598), [debit exception](/Users/apple/cencori/lib/gateway-middleware.ts:1085).

Fix: give public Porter credentials a product/endpoint scope enforced by every gateway entry point, and make Porter-to-gateway delegation a trusted server operation. Bound model access and provider spend independently of request frequency. Keep the internal credential out of public configuration and snippets.

### 2. [P1] Both console previews fail the gateway's domain check

The preview route correctly authorizes organization membership and signs the customer's host into a session. Chat then substitutes the customer's publishable key but forwards the browser's actual console `Origin`. The gateway rejects `cencori.com` or localhost because normal keys allow only the customer's domains.

A local reproduction using the actual chat route and gateway validation returned `403 domain_not_allowed` for `https://cencori.com` and `http://localhost:3000`, and passed admission for the customer's origin with the same session/key. Expanded demo-key domain lists can hide this defect.

Evidence: [preview session claims](/Users/apple/cencori/app/api/porter/[porterId]/preview-session/route.ts:72), [delegated headers](/Users/apple/cencori/app/api/v1/porter/chat/route.ts:180), [gateway rejection](/Users/apple/cencori/lib/gateway-middleware.ts:551).

Fix: make delegation honor verified session and membership authorization while preserving domain validation at the public session boundary. Do not require customers to authorize the console as an embed domain. Replace the blanket header copy with an explicit allowlist: it also forwards client-controlled gateway prompt and routing headers.

### 3. [P1] Rate limits accumulate until traffic stops for a full window

Every attempt runs `INCR` followed by unconditional `EXPIRE`. The counter therefore measures requests since the last uninterrupted idle period. Denied attempts extend the expiry too.

Using the actual limiter with a simulated Redis clock, one request per minute from distinct visitors was rejected on request 601 after ten hours, although traffic was only 60 requests per hour. A retry 3,599 seconds later renewed the hour-long lockout. Session and visitor limits share this defect.

Evidence: [counter and expiry](/Users/apple/cencori/lib/porter/rate-limit.ts:54).

Fix: implement an atomic fixed or rolling window. Verify boundary recovery, concurrent increments, and recovery while traffic continues.

### 4. [P1] The refresh sweep can starve every Porter after the first 20

The cron route always selects the first 20 enabled Porters by `updated_at`. Refreshing knowledge updates document rows, not the Porters' ordering field, and there is no cursor. With stable Porter rows, every run selects the same 20, including those with no due pages; later Porters never get a turn.

This is a fairness defect beginning at 21 enabled Porters, rather than the approximate 100-customer capacity ceiling described in the status document.

Evidence: [selection](/Users/apple/cencori/app/api/cron/porter-recrawl/route.ts:36), [refresh loop](/Users/apple/cencori/app/api/cron/porter-recrawl/route.ts:50), [document-only rescheduling](/Users/apple/cencori/lib/porter/knowledge.ts:331).

Fix: claim due work with stable pagination or a durable queue. Record refresh outcomes, backlog age, and failures so an HTTP 200 cannot conceal stale customers. Verify with more than 20 Porters, including early entries with no work due.

### 5. [P2] Discovery breaks sitemap indexes and query-addressed pages

`parseSitemap` distinguishes page entries from nested sitemap entries, but discovery discards that distinction. A sitemap index becomes a list of XML files offered for indexing, and the child sitemaps are never fetched. Separately, discovery drops every query parameter, so `/help?id=1` and `/help?id=2` collapse to `/help`, which may represent neither article.

Both cases were reproduced using the actual discovery and sitemap parsing functions with mocked fetch responses.

Evidence: [sitemap entry handling](/Users/apple/cencori/lib/porter/knowledge.ts:145), [query removal](/Users/apple/cencori/lib/porter/knowledge.ts:177), [parser entry kinds](/Users/apple/cencori/lib/web/sitemap.ts:43).

Fix: expand child sitemaps with bounded depth and fetch counts, then reuse URL normalization that preserves meaningful query parameters. Filter to pages before displaying the selection.

### 6. [P2] The real widget has startup, citation, and stream-error defects

Three behaviors were reproduced by executing the actual `public/porter.js` in jsdom with mocked config and streaming responses:

- Clicking the launcher before config arrives creates a panel from `ready:false`. Returning `ready:true` updates the launcher but leaves the input and send button disabled. [Config completion](/Users/apple/cencori/public/porter.js:405).
- An answer containing `[1]` and a valid `X-Porter-Sources` header produces no source links. The deployed widget ignores the header and displays plain text. [Response handling](/Users/apple/cencori/public/porter.js:313), [answer rendering](/Users/apple/cencori/public/porter.js:378).
- A provider error frame after partial text is ignored. The partial answer appears complete and is saved into the next request's history. The console parser ignores the same frame shape. [Widget parser](/Users/apple/cencori/public/porter.js:369), [history write](/Users/apple/cencori/public/porter.js:323), [console parser](/Users/apple/cencori/app/(app)/[orgSlug]/[projectSlug]/porter/PorterPreview.tsx:116).

Fix: gate interaction on config readiness, render validated source links, and handle explicit stream errors and incomplete streams without remembering partial answers as successful turns. Move the corrected widget into the console canvas to remove the duplicate behavior.

### 7. [P2] Conversation history is neither isolated nor suitable for billing

The conversations endpoint reads all `ai_requests` for a project and filters only for a nonempty user question. Existing developer projects therefore show unrelated gateway calls as Porter conversations. Chat delegation carries no durable Porter/conversation attribution. Separately, the console's chat preview sends only the latest message, omitting its displayed prior turns.

Evidence: [project-wide log query](/Users/apple/cencori/app/api/porter/[porterId]/conversations/route.ts:102), [question-only filter](/Users/apple/cencori/app/api/porter/[porterId]/conversations/route.ts:126), [delegated body](/Users/apple/cencori/app/api/v1/porter/chat/route.ts:190), [console request](/Users/apple/cencori/app/(app)/[orgSlug]/[projectSlug]/porter/PorterPreview.tsx:73).

Fix: persist Porter and conversation identifiers through admission, execution, and logs; filter the console by them. Define a billable conversation separately from a request or expiring authorization token, then count it atomically. Send bounded history from the console or use the same widget implementation.

### 8. [P2] Key replacement can report success while breaking chat

Replacement deletes the old key before updating the Porter and ignores errors from both operations. If deletion succeeds and the update fails, the Porter points at a deleted key while the endpoint reports success. If deletion fails, revocation has not happened.

Evidence: [delete/update sequence](/Users/apple/cencori/app/api/porter/[porterId]/key/route.ts:90).

Fix: rotate the linked credential atomically and surface failures. Also enforce revocation in session/config key lookups; those currently omit `revoked_at IS NULL`, which matters for revocation paths that retain rows. [Session lookup](/Users/apple/cencori/app/api/v1/porter/session/route.ts:109), [config lookup](/Users/apple/cencori/app/api/v1/porter/config/route.ts:69).

## Corrections and remaining gaps

The status document's ordinary-chat logging claim is stale. The current success path runs the input guard, passes `guardedMessages` into the logger, and builds masked log payloads before inserting them. The cited pre-guard `promptPayload` is in optional memory retrieval, which Porter does not enable. This does not establish masking coverage for every failure/security log or every configured rule. [Guarded logging](/Users/apple/cencori/app/api/v1/chat/completions/route.ts:919), [masked payload construction](/Users/apple/cencori/lib/gateway/chat-post-success.ts:188).

Document embedding support already exists: indexing calls `embedWebDocument`, controlled by a semantic-search flag. Porter nevertheless hardcodes `queryEmbedding:null`, so enabling document embeddings alone will not provide semantic retrieval. [Document embedding](/Users/apple/cencori/lib/web/index.ts:72), [feature flag](/Users/apple/cencori/lib/web/embeddings.ts:14), [Porter search options](/Users/apple/cencori/lib/porter/knowledge.ts:354).

Retrieval also still includes the public collection for the same domain and its subdomains; domain filtering does not limit answers to the customer's selected collection. This is not evidence of another project's private-data exposure, but public pages outside the selected knowledge can appear. Host filtering uses the session's embed host, so a `www` visitor may miss documents stored under an apex canonical host. [Search collections and hosts](/Users/apple/cencori/supabase/migrations/20260808_120000_web_intelligence_v2.sql:120), [session-host retrieval](/Users/apple/cencori/app/api/v1/porter/chat/route.ts:160).

The 25-page limit is a per-request slice, not a total entitlement; repeated crawls can add more batches. The crawl writes pages individually and only enables Porter after the loop, so it is request-blocking rather than transactionally atomic. It needs durable progress and resumption before larger paid page limits are useful. [Read loop and enablement](/Users/apple/cencori/lib/porter/knowledge.ts:216).

The standalone preview also cannot renew its handed-in token after 30 minutes: `session()` always returns `givenSession`, while invalidation clears a different variable. [Session selection](/Users/apple/cencori/public/porter.js:264).

Billing, escalation delivery, install verification, onboarding plans, and suggested questions remain missing as documented. Production session-secret presence remains unverified. The reported 15–22-second latency was not remeasured.

## Recommended next work

1. **Close the four P1 defects first.** Scope public credentials, correct trusted preview delegation, repair rate-limit windows, and make refresh scheduling fair. Include a provider-spend ceiling and regression coverage for each reproduced failure.
2. **Make the existing customer promise reliable.** Fix sitemap discovery, canonical collection scoping, and the widget's startup, citations, and stream errors. Mount that widget in the console. Add durable crawl progress/resumption, atomic key rotation, and a verifiable installed state.
3. **Implement billing from explicit product semantics.** Decide billing ownership, pooled Business allowances, conversation boundaries, reset periods, preview accounting, and paid-only versus free access. Add durable usage identities and atomic page/conversation/Porter entitlements before presenting a checkout or onboarding plan step.
4. **Dogfood before the paid pilot.** Run Cencori docs/Academy through the real install and customer-domain flow. Exercise expiry, empty knowledge, unavailable providers, exhausted allowances, refreshed prices, and source links. Measure first-token and completion latency and answer grounding before prioritizing a faster model or semantic retrieval.

Basecode provides useful payment-verification and atomic-reservation patterns, but a `product` column alone is insufficient. Its accounts are unique by user, plan codes are globally keyed, quotas use weekly turns/cost, and gateway attribution selects a user's active reservation. Porter needs organization ownership and concurrent anonymous conversations. Current Basecode payments grant prepaid 30-day access with `auto_renews=false`; renewal and upgrade behavior must be chosen deliberately. [Account/plan schema](/Users/apple/cencori/supabase/migrations/20260831_230000_basecode_billing.sql:27), [weekly quota boundaries](/Users/apple/cencori/supabase/migrations/20260831_230000_basecode_billing.sql:274), [reservation attribution](/Users/apple/cencori/supabase/migrations/20260831_230000_basecode_billing.sql:510), [renewal setting](/Users/apple/cencori/supabase/migrations/20260831_230000_basecode_billing.sql:780).

## Verification

- `npm run test:run -- lib/porter/__tests__`: 20 passing across three files. These cover inference, discovery, and retrieval/prompt helpers, not public routes, rate limiting, refresh scheduling, or widget behavior.
- `npx tsc --noEmit --incremental false`: passed.
- ESLint over Porter libraries, console, widget, onboarding, public/console APIs, preview, and cron: zero errors; two warnings, for the console preview hook dependency and an unused widget catch variable.
- Local reproductions used real modules with mocked storage, clocks, fetches, or DOM APIs. They confirmed preview rejection, rate-limit lockout, gateway admission with the public key, the two discovery defects, and three widget defects. No production calls were made.

Only this audit report was added; the existing application changes were preserved.
