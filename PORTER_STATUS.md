# Porter — build status

**As of 7 September 2026.** Working document, safe to delete.
Branch `feat/porter-onboarding`, 16 commits ahead of `master`, plus uncommitted work listed at the end.

Porter is a first-party product on Cencori: paste a URL, it reads that site, and one line of script
puts an agent on it that answers customers from those pages with citations. Source of truth for
intent is `Porter_by_Cencori_PRD_v0.1.docx`; this file records what exists.

---

## 1. Where we are against the PRD's build order

| # | Milestone | State | Notes |
|---|---|---|---|
| 1 | Project recrawl | **done** | daily sweep, weekly per page, unchanged pages skipped |
| 2 | Porter model + chat endpoint | **done** | grounded, cited, refuses on wrong project/domain |
| 3 | Public session hardening | **done** | short-lived signed sessions; the key no longer works on chat |
| 4 | URL inference pass | **done** | name, brand, logo, prompt, contact from one page |
| 5 | porter.js | **done** | shadow DOM, streaming, accessible, 18 KB |
| 6 | Console flow | **partial** | link review, preview and canvas done; no watch-the-crawl, no plan step |
| 7 | Billing and limits | **not started** | nothing metered, nothing gated |
| 8 | Dogfood | **not started** | Cencori docs/Academy not running on Porter |
| 9 | Closed paid pilot | **not started** | |
| 10 | Public launch | **not started** | |

Five of seven build milestones. What remains is the commercial half and the last third of the
console experience.

---

## 2. What works end to end today

A person with no Cencori account can:

1. Sign up and pick **"Put an AI agent on my site"** at the onboarding fork
2. Type one web address — nothing else is asked
3. Get an organization, a project, a domain-locked publishable key and a Porter, all derived from
   that address, without meeting the words "organization", "project" or "API key"
4. See what their site contains, grouped by section, and uncheck what shouldn't be read
5. Have up to 25 pages read and indexed
6. Talk to their Porter in the console, with the pages each answer came from shown beneath it
7. Open a full-page preview running the real widget
8. Copy one line and paste it into their site
9. Have visitors get streamed, cited answers, rate-limited and guarded

An existing developer can do the same from **Porter** in the sidebar, without a second workspace.

---

## 3. What exists, by piece

### Database

| Migration | What it does | Applied |
|---|---|---|
| `20260904_100000_porters.sql` | the `porters` table, RLS, one-per-project index | yes |
| `20260904_140000_projects_region_default.sql` | stop `region` defaulting to a value its own check rejects | yes |
| `20260905_100000_project_slug_unique_per_org.sql` | project names unique per org, not per platform | yes |
| `20260905_140000_porter_publishable_key.sql` | keep the key where the snippet can show it | yes |

`porters` columns: `id`, `project_id`, `organization_id`, `name`, `greeting`, `system_prompt`,
`model`, `source_url`, `collection_id`, `enabled`, `surface`, `actions`, `brand`, `brand_overrides`,
`publishable_key`, `install_verified_at`, timestamps.

Reused rather than rebuilt: `web_documents` for knowledge, `api_keys` for the publishable key,
`ai_requests` for conversations, `organizations` / `projects` / `organization_members` for tenancy.

### Endpoints

**Public** (the widget talks to these)
- `POST /v1/porter/session` — mints a signed session after key, origin, rate-limit and readiness checks
- `POST /v1/porter/chat` — session-authenticated, retrieves, grounds, delegates to `/v1/chat/completions`
- `GET  /v1/porter/config` — name, greeting, colour, logo; accepts a key or a session

**Console** (membership-checked)
- `POST /api/onboarding/porter` — provisions org, project, key and Porter from one URL
- `POST /api/porter/create` — adds a Porter to a project that already exists
- `PATCH /api/porter/[id]` — allow-listed edits; currently `model` only
- `POST /api/porter/[id]/discover` — what the site contains, grouped, nothing indexed
- `POST /api/porter/[id]/crawl` — read a chosen list, or follow links if none given
- `POST /api/porter/[id]/conversations` — turns, read from `ai_requests`
- `POST /api/porter/[id]/key` — issue or replace the publishable key
- `POST /api/porter/[id]/preview-session` — a session authorised by membership, not origin

**Scheduled**
- `POST /api/cron/porter-recrawl` — daily sweep, `CRON_SECRET`-gated, GitHub Actions at `19 4 * * *`

### Library

| File | Responsibility |
|---|---|
| `lib/porter/provision.ts` | create a Porter and its key inside an existing project |
| `lib/porter/inference.ts` | read name, brand, logo, prompt, contact off a homepage |
| `lib/porter/knowledge.ts` | discover links, read pages, retrieve passages, weekly refresh |
| `lib/porter/session.ts` | mint and verify HMAC session tokens |
| `lib/porter/rate-limit.ts` | per-visitor and per-Porter limits, and a tighter one for minting |
| `lib/porter/models.ts` | the six models a Porter may use |

### Widget

`public/porter.js`, ~18 KB unminified, no dependencies. Shadow DOM with `all: initial`, streams SSE,
`role="dialog"`, polite live region, Escape closes, focus returns, `prefers-reduced-motion` honoured,
dark mode, launcher label truncates past 18 characters, accent contrast computed from luminance,
removes itself entirely if config fails.

### Console

`/{org}/{project}/porter` with its own sidebar section and a fixed-height shell:

- **Overview** — model picker, instructions, and the widget on a canvas
- **Knowledge** — discover, review by section, read, refresh state
- **Conversations** — questions, answers, `unsourced` flag, latency
- **Install** — snippet, copy, send-to-developer, replace key
- **Settings** — name, brand, escalation, prompt (read-only)

`/porter-preview/[porterId]` — standalone, no console chrome, runs the real `porter.js`.

### Tests

20 passing across `inference`, `knowledge` and `discover`. They cover: name preference and the
sentence-title rejection, hex-only theme colours, relative logo resolution, body tags not renaming a
business, snippet-not-content retrieval, host-scoped search, keyword fallback, sitemap-then-homepage
discovery, and www deduplication.

---

## 4. Bugs found and fixed along the way

Recorded because several were pre-existing and none were in the plan.

| Bug | Where | Consequence if unfixed |
|---|---|---|
| `region` defaulted to `'auto'`, which its own check constraint rejects | platform | **project creation failed for everyone** who didn't open the region dropdown |
| Same fault in a second creation form | platform | same, on the more travelled path |
| `projects.slug` unique per platform, not per org | platform | first customer to use "production" took it from everyone |
| `content_hash` is a hash of raw bytes | platform crawler | every page reports as changed forever; change detection is a no-op |
| `search_cencori_web_v2` matches public documents | platform | **a Porter could cite another site's pages** |
| Retrieval read `content`; the search returns `snippet` | Porter | Porter with 24 pages reported having none |
| Whole questions match nothing under AND semantics | Porter | natural questions returned zero results |
| `www.` and apex deduped as different pages | Porter | half the page allowance spent reading duplicates |
| Chat forwarded the session token to the gateway | Porter | delegation would have 401'd |
| React Query key unchanged after widening a select | Porter | new columns silently render as absent |

---

## 5. Open — in the order I would take them

### Blocking a launch

1. **Billing (milestone 7).** Nothing is metered or gated. The engine exists —
   `20260831_230000_basecode_billing.sql` already has dual-currency prices, `model_policy`, and both
   quota shapes. Porter needs to become its second tenant via a `product` column. PRD pricing:
   Starter ₦1,000 (25 pages, 50 conversations), Porter ₦2,500 (250 / 500), Business ₦10,000
   (3 Porters, 1,000 / 1,000).
2. **`PORTER_SESSION_SECRET` must reach production.** It exists only in `.env.local`. Without it the
   session endpoint returns 503 and no Porter can hold a conversation — deliberate, but it makes a
   deploy without it a dead product rather than a degraded one.
3. **Escalation delivers nothing.** `actions` holds an email address inferred from the contact page
   and nothing sends to it.
4. **Install is never verified.** `install_verified_at` exists as a column; nothing sets it. The
   console cannot tell a customer whether their snippet is live.

### The rest of milestone 6

5. **Watch it read.** The crawl is a request you wait on. The PRD asks for visible progress and a
   "knowledge still loading" state; there is no partial state to show because the crawl is atomic.
6. **Suggested questions.** A first-time visitor faces an empty box. Generating three from the
   crawled titles is the largest remaining usability win, and it is what Chatbase leads with.
7. **The plan step** in onboarding, which needs (1).

### Quality and correctness

8. **Retrieval is lexical only.** `semantic_score` is 0 on every result — document embeddings are
   never generated, so paraphrases miss. `web_embedding_jobs` exists but is for query embeddings.
9. **Answers take 15–22 seconds** end to end. Streaming hides it in the widget; it is still slow.
   Fewer passages, a faster default, or both.
10. **Two implementations of one chat UI.** `porter.js` and the console's `PorterPreview` have
    drifted three times and will again. The fix is a mount-target option on the widget so the canvas
    can host the real thing; the twin then disappears.
11. **`ai_requests` logs the raw pre-redaction message.** `promptPayload` is called before the input
    guard runs, so visitor text is stored unredacted. Fine for a developer's own data, different when
    strangers type into a support box. Platform-wide, not Porter's alone.
12. **The recrawl sweep caps at 20 Porters × 40 pages a day.** A ceiling around 100 customers, and
    it fails silently — Porters just fall behind.

### Product decisions still open

13. **Name.** "Porter" is a working name, untrademark-checked. Renaming after the table exists means
    a migration.
14. **Free tier.** The PRD has no free plan; the spec assumed one with the badge as the upgrade
    lever. These disagree and the PRD is newer.
15. **Live human handoff.** Out of v0. Every support buyer asks about it first.
16. **Workspace limits.** The Vercel model — one personal workspace free, more on a paid plan — is
    the intent, and nothing in the code enforces it. There is no tier check on organization creation
    anywhere.
17. **Anonymous preview.** PRD says not required. The growth loop it would enable is real but
    abusable.

---

## 6. Uncommitted right now

Console redesign and the model picker, all passing `tsc` and `eslint`:

```
M  app/(app)/layout.tsx                          fixed-height shell for /porter
M  app/(app)/[orgSlug]/OrganizationLayoutClient.tsx   same, inner shell
M  app/(app)/[orgSlug]/[projectSlug]/porter/page.tsx  two-pane overview, model picker
M  app/(app)/[orgSlug]/[projectSlug]/porter/shared.ts greeting + model on the shape
M  app/api/v1/porter/chat/route.ts               sources header
M  app/api/v1/porter/config/route.ts             accepts a session token
M  public/porter.js                              accepts a handed session
?? porter/layout.tsx, PorterCanvas, PorterPreview
?? app/api/porter/[porterId]/route.ts            PATCH, allow-listed
?? app/api/porter/[porterId]/preview-session/
?? app/porter-preview/
?? lib/porter/models.ts
```

Also modified and **not mine** — worth checking before committing:
`app/basecode/page.tsx` and `app/sitemap.ts`, two lines added to each.

### Test data to clean up

- Two Porters: `stripe.com` (enabled, 24 pages) and `bolabanjo.com` (never read)
- Publishable keys allowing `localhost` so the demo page works
- `public/porter-demo.html`, gitignored, holds a real key
