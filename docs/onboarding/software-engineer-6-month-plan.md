# Cencori — Software Engineer 6-Month Onboarding Program

> **Role:** Software Engineer (Fullstack, Beginner)
> **Start Date:** March 3, 2026
> **End Date:** August 28, 2026
> **Manager Review Cadence:** Weekly 1:1 + Monthly milestone review
> **Goal:** Grow into a confident, independent fullstack engineer who can own features end-to-end across AI, backend, frontend, database, DevOps, and security.

---

## How to Read This Document

Each week contains **one primary task** that spans all six engineering disciplines:

| Discipline | What It Means at Cencori |
|---|---|
| **AI** | LLM integrations, prompt engineering, embeddings, model routing, RAG pipelines |
| **Backend** | API routes (`app/api/`), server logic, SDK development, middleware |
| **Frontend** | React/Next.js pages, dashboard UI, components, client-side state |
| **Database** | Supabase (PostgreSQL), schema design, migrations, queries, RLS policies |
| **DevOps** | Vercel deployment, CI/CD, environment variables, monitoring, feature flags |
| **Security** | Auth (Supabase Auth), API key management, data rules, jailbreak detection, audit logs |

### Deadline Structure

- **Weekly deadline:** Each task must be completed by end-of-day Friday of that week
- **Monthly milestone:** All 4 weekly tasks must be completed and reviewed by the last Friday of the month
- **Monthly review gate:** Engineer cannot proceed to the next month until the monthly milestone is signed off by the manager

### Deliverables Per Task

Every weekly task must produce:
1. **Code** — A pull request (or set of PRs) with the implementation
2. **Tests** — Unit and/or integration tests covering the new functionality
3. **Documentation** — Updated README, inline comments, or docs page as relevant
4. **Demo** — A short recorded walkthrough or live demo in the weekly 1:1

### Evaluation Criteria

| Rating | Description |
|---|---|
| ✅ **Exceeds** | Completed early with polish, edge cases handled, proactive improvements |
| ☑️ **Meets** | Completed on time, all acceptance criteria satisfied |
| ⚠️ **Needs Improvement** | Completed late or missing acceptance criteria |
| ❌ **Not Met** | Not completed or fundamentally broken |

---

## Progress Tracker

| Month | Week | Task | Status | Rating |
|---|---|---|---|---|
| 1 | 1 | Health Check Dashboard Widget | ☐ | — |
| 1 | 2 | API Key Usage Sparkline | ☐ | — |
| 1 | 3 | Scan Results Export | ☐ | — |
| 1 | 4 | Model Availability Monitor | ☐ | — |
| 2 | 5 | Embeddings V1 Compatibility Route | ☐ | — |
| 2 | 6 | Security Incident Severity Classifier | ☐ | — |
| 2 | 7 | Scan False-Positive Feedback Loop | ☐ | — |
| 2 | 8 | Provider Latency Dashboard | ☐ | — |
| 3 | 9 | Memory Namespace Browser | ☐ | — |
| 3 | 10 | Webhook Delivery Logs | ☐ | — |
| 3 | 11 | RAG Source Attribution UI | ☐ | — |
| 3 | 12 | Budget Alert Notification System | ☐ | — |
| 4 | 13 | Custom Provider Onboarding Wizard | ☐ | — |
| 4 | 14 | Scan Scheduling & Cron System | ☐ | — |
| 4 | 15 | Rate Limit Analytics & Configuration UI | ☐ | — |
| 4 | 16 | AI Request Replay & Debugging Tool | ☐ | — |
| 5 | 17 | Multi-Model A/B Testing Framework | ☐ | — |
| 5 | 18 | Security Compliance Report Generator | ☐ | — |
| 5 | 19 | Scan Auto-Remediation Pipeline | ☐ | — |
| 5 | 20 | Team Permissions & RBAC Overhaul | ☐ | — |
| 6 | 21 | AI Cost Optimizer with Recommendations | ☐ | — |
| 6 | 22 | Real-Time Gateway Activity Stream | ☐ | — |
| 6 | 23 | End-to-End Observability Pipeline | ☐ | — |
| 6 | 24 | Capstone: Feature Flag-Gated Innovation Project | ☐ | — |

---
---

# MONTH 1 — FOUNDATION

> **Theme:** Learn the codebase, ship small features, establish engineering habits
> **Dates:** March 3 – March 28, 2026
> **Monthly Milestone Deadline:** Friday, March 27, 2026
> **Monthly Review:** All 4 weekly PRs merged, tests passing, demos recorded

---

## Week 1 — Health Check Dashboard Widget

> **Deadline:** Friday, March 6, 2026
> **Story Points:** 3
> **Difficulty:** ⭐ (Introductory)

### Overview

Build a dashboard widget that displays the real-time health status of Cencori's backend services. This is a gentle introduction to the entire stack — she'll touch an API route, a frontend component, a database table, a deployment, and security middleware without modifying anything mission-critical.

### Learning Objectives

- Understand the Next.js App Router file-based routing system
- Learn how Cencori's Supabase client (`lib/supabaseServer.ts`, `lib/supabaseClient.ts`) works
- Get familiar with the deployment pipeline on Vercel
- Understand API route authentication patterns

### AI Component

**Task:** Add an AI-powered "status summary" that uses the Gemini API to generate a natural-language summary of the current system health.

**Details:**
- Use the existing Gemini client in `lib/gemini.ts` to call the Gemini API
- The prompt should receive the raw health data (response times, error rates, uptime percentages) and return a 1–2 sentence human-readable summary
- Example output: *"All systems are operational. The AI gateway is responding in 45ms on average, which is 20% faster than yesterday."*
- Handle the case where the AI call itself fails — fall back to a static "All systems operational" message

**Files to study:**
- `lib/gemini.ts` — Existing Gemini client
- `app/api/ai/chat/route.ts` — Example of AI API route patterns

**Acceptance Criteria:**
1. AI summary is generated from real health data
2. Fallback message displays if Gemini API is unreachable
3. AI response is cached for 60 seconds to avoid excessive API calls

### Backend Component

**Task:** Create a new API route `app/api/health/detailed/route.ts` that aggregates health information from multiple internal services.

**Details:**
- Extend the existing `app/api/health/route.ts` pattern
- The route should check: database connectivity (Supabase ping), AI gateway availability (provider health), and memory service status
- Return a structured JSON response with status, latency, and timestamp for each service
- Add proper error handling — if one service is down, the others should still report

**Response shape:**
```json
{
  "status": "healthy",
  "timestamp": "2026-03-06T12:00:00Z",
  "services": {
    "database": { "status": "healthy", "latencyMs": 12 },
    "aiGateway": { "status": "healthy", "latencyMs": 45 },
    "memory": { "status": "healthy", "latencyMs": 23 }
  },
  "summary": "All systems are operational..."
}
```

**Files to study:**
- `app/api/health/route.ts` — Existing health check
- `lib/supabaseAdmin.ts` — Admin Supabase client
- `lib/providers/index.ts` — Provider system entry point

**Acceptance Criteria:**
1. Route returns correct health status for all 3 services
2. Individual service failures don't crash the entire endpoint
3. Response time is under 2 seconds

### Frontend Component

**Task:** Build a `HealthStatusWidget` React component and add it to the organization dashboard page.

**Details:**
- Create the component at `components/dashboard/HealthStatusWidget.tsx`
- Use the existing dashboard layout patterns from `app/dashboard/organizations/[orgSlug]/page.tsx`
- Display each service as a status card with a colored indicator (green/yellow/red)
- Show the AI-generated summary at the top
- Add a "Refresh" button that re-fetches the data
- Use `React.useState` and `fetch` — no external state management needed for this
- Style using CSS modules or the existing design system patterns in `app/globals.css`

**Visual Design:**
- Green dot + "Healthy" for operational services
- Yellow dot + "Degraded" for slow services (latency > 500ms)
- Red dot + "Down" for unreachable services
- Subtle fade-in animation when data loads
- Responsive layout — stacks vertically on mobile

**Files to study:**
- `app/dashboard/organizations/[orgSlug]/page.tsx` — Dashboard page patterns
- `app/globals.css` — Design system tokens

**Acceptance Criteria:**
1. Widget renders on the organization dashboard
2. Real-time data from the `/api/health/detailed` endpoint
3. Visual indicators match service status
4. Refresh button works without page reload
5. Component is responsive

### Database Component

**Task:** Create a `health_checks` table in Supabase to store historical health data for trend analysis.

**Details:**
- Design the table schema:
  ```sql
  CREATE TABLE health_checks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    checked_at TIMESTAMPTZ DEFAULT NOW(),
    service_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'down')),
    latency_ms INTEGER,
    error_message TEXT,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE
  );
  ```
- Add an index on `(project_id, checked_at DESC)` for efficient querying
- Write the migration SQL file
- Update the health API route to write to this table on each check
- Query the last 24 hours of data to show trends in the widget

**Files to study:**
- `lib/supabaseAdmin.ts` — How to use the admin client for writes
- Existing Supabase table patterns in the codebase

**Acceptance Criteria:**
1. Table is created via migration SQL
2. Health checks are persisted on each API call
3. Historical data is queryable by project and time range
4. Old records (>30 days) have a cleanup strategy documented

### DevOps Component

**Task:** Set up the health check as a Vercel Cron Job that runs every 5 minutes and configure environment variables.

**Details:**
- Add a cron configuration in `vercel.json` (or the existing cron pattern in `app/api/cron/`)
- The cron job should call the `/api/health/detailed` endpoint internally
- Add any needed environment variables to `.env.example` and document them
- Set up a simple alerting mechanism — if a service is down for 3 consecutive checks, log a warning
- Verify the cron job works in Vercel's preview deployment

**Files to study:**
- `app/api/cron/` — Existing cron patterns
- `vercel.json` — Deployment configuration
- `.env.example` — Environment variable documentation

**Acceptance Criteria:**
1. Cron job runs every 5 minutes on Vercel
2. Health data is automatically collected without manual triggers
3. Environment variables are documented in `.env.example`
4. Deployment to Vercel preview succeeds

### Security Component

**Task:** Secure the health endpoint and implement proper access controls.

**Details:**
- The detailed health endpoint should require authentication (Supabase session)
- Only users who are members of the organization should see their org's health data
- The cron job endpoint should be protected with a `CRON_SECRET` header to prevent unauthorized triggers
- Add Row Level Security (RLS) policy on the `health_checks` table so users can only read data for projects they have access to
- Sanitize any error messages in the response — don't leak internal service details to the client

**RLS Policy:**
```sql
CREATE POLICY "Users can view health checks for their projects"
ON health_checks FOR SELECT
USING (
  project_id IN (
    SELECT id FROM projects
    WHERE organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  )
);
```

**Files to study:**
- `lib/supabaseServer.ts` — Server-side auth patterns
- `app/api/projects/[projectId]/security/` — Security route patterns
- Existing RLS policies in the database

**Acceptance Criteria:**
1. Unauthenticated requests return 401
2. Users can only see health data for their own projects
3. Cron endpoint is protected with secret
4. Error messages don't leak internal details
5. RLS policy is tested with multiple user contexts

### Tests Required

| Test Type | What to Test | File |
|---|---|---|
| Unit | Health data aggregation logic | `lib/__tests__/health-aggregator.test.ts` |
| Unit | AI summary prompt construction | `lib/__tests__/health-summary.test.ts` |
| Integration | `/api/health/detailed` returns correct shape | `__tests__/integration/api/health-detailed.test.ts` |
| Component | `HealthStatusWidget` renders all states | `components/__tests__/HealthStatusWidget.test.tsx` |

### Definition of Done

- [ ] PR opened with all code changes
- [ ] All tests passing in CI
- [ ] Health widget visible on dashboard
- [ ] Cron job deployed and running on preview
- [ ] RLS policies applied to `health_checks` table
- [ ] Demo recorded and shared in weekly 1:1

---

## Week 2 — API Key Usage Sparkline

> **Deadline:** Friday, March 13, 2026
> **Story Points:** 3
> **Difficulty:** ⭐ (Introductory)

### Overview

Add a small sparkline chart next to each API key on the project's API keys page, showing the last 7 days of request volume. This teaches her to work with analytics data, charting libraries, and the API key security model.

### Learning Objectives

- Understand Cencori's API key system (`lib/api-keys.ts`)
- Learn how analytics data flows from the gateway to the database
- Practice building reusable chart components
- Understand API key security and encryption patterns

### AI Component

**Task:** Add an AI-powered "usage insight" tooltip that explains the API key's usage pattern.

**Details:**
- When hovering over the sparkline, show a tooltip with an AI-generated insight
- Use the Gemini API to analyze the 7-day usage data and generate a one-line insight
- Example: *"Usage peaked on Wednesday — 3x your daily average. Likely a batch job."*
- Cache insights per API key for 1 hour to avoid redundant AI calls
- If the key has zero usage, show: *"This key hasn't been used in the last 7 days."*

**Files to study:**
- `lib/gemini.ts` — Gemini client
- `lib/cache.ts` — Caching patterns

**Acceptance Criteria:**
1. AI insight appears on sparkline hover
2. Insights are cached for 1 hour
3. Zero-usage keys show a static message instead of calling the AI
4. AI failures gracefully fall back to "No insight available"

### Backend Component

**Task:** Create an API route `app/api/projects/[projectId]/api-keys/[keyId]/usage/route.ts` that returns daily request counts for the last 7 days.

**Details:**
- Query the `ai_requests` table (or equivalent logs table) grouped by day
- Return an array of `{ date: string, count: number }` objects
- Support a `period` query parameter (`7d`, `14d`, `30d`) with `7d` as default
- Use the existing authentication middleware pattern from other project routes
- Optimize the query with proper indexes if needed

**Response shape:**
```json
{
  "keyId": "ck_abc123",
  "period": "7d",
  "usage": [
    { "date": "2026-03-07", "count": 142 },
    { "date": "2026-03-08", "count": 89 },
    { "date": "2026-03-09", "count": 201 },
    { "date": "2026-03-10", "count": 56 },
    { "date": "2026-03-11", "count": 178 },
    { "date": "2026-03-12", "count": 95 },
    { "date": "2026-03-13", "count": 167 }
  ]
}
```

**Files to study:**
- `app/api/projects/[projectId]/api-keys/` — Existing API key routes
- `app/api/projects/[projectId]/analytics/` — Analytics query patterns
- `lib/api-keys.ts` — API key utilities

**Acceptance Criteria:**
1. Route returns daily usage for the specified period
2. Response is fast (<500ms) even with large datasets
3. Missing days return `count: 0` (no gaps in the array)
4. Route requires project-level authentication

### Frontend Component

**Task:** Build a `UsageSparkline` React component and integrate it into the API keys list page.

**Details:**
- Create `components/dashboard/UsageSparkline.tsx`
- Render a small inline SVG sparkline (no heavy charting library — use raw SVG path)
- The sparkline should be approximately 120px wide × 30px tall
- Color: green if usage is trending up, red if trending down, neutral gray if flat
- On hover, show the AI insight tooltip
- Add a loading skeleton state while data is fetching
- Make the component reusable — it should accept any `{ date, count }[]` array

**Visual Design:**
- Thin line (2px stroke) with a subtle gradient fill below
- Smooth curve interpolation (not jagged lines)
- Small dot on the most recent data point
- Tooltip appears above the sparkline on hover with a subtle shadow

**Files to study:**
- `app/dashboard/organizations/[orgSlug]/projects/[projectSlug]/` — Project dashboard patterns
- Existing chart patterns from analytics pages

**Acceptance Criteria:**
1. Sparkline renders inline next to each API key
2. Trend color changes based on usage direction
3. Hover tooltip shows AI insight
4. Loading skeleton displays during data fetch
5. Component works with any numeric time-series data

### Database Component

**Task:** Create materialized views or optimized queries for fast API key usage aggregation.

**Details:**
- Analyze the existing `ai_requests` table structure
- Create an index on `(api_key_id, created_at)` if not already present
- Consider creating a materialized view `api_key_daily_usage` that pre-aggregates daily counts
- Write the migration SQL for the index and/or materialized view
- Document the query plan showing the performance improvement
- Add a refresh strategy for the materialized view (refresh on cron or on-demand)

**Schema:**
```sql
CREATE MATERIALIZED VIEW api_key_daily_usage AS
SELECT
  api_key_id,
  DATE(created_at) AS usage_date,
  COUNT(*) AS request_count
FROM ai_requests
GROUP BY api_key_id, DATE(created_at);

CREATE UNIQUE INDEX idx_api_key_daily_usage
ON api_key_daily_usage (api_key_id, usage_date);
```

**Acceptance Criteria:**
1. Query returns results in <100ms for keys with 100k+ requests
2. Migration SQL is clean and reversible
3. Refresh strategy is documented and implemented
4. Existing queries are not negatively impacted

### DevOps Component

**Task:** Add a materialized view refresh step to the cron system and verify deployment.

**Details:**
- Add a cron job that refreshes the `api_key_daily_usage` materialized view every hour
- Add monitoring — log the refresh duration and row count
- Verify the sparkline feature works in Vercel preview deployment
- Add the feature behind a feature flag (`FEATURE_API_KEY_SPARKLINE=true`) so it can be toggled
- Document the feature flag in `.env.example`

**Files to study:**
- `app/api/cron/` — Existing cron patterns
- `vercel.json` — Cron configuration

**Acceptance Criteria:**
1. Materialized view refreshes every hour via cron
2. Refresh duration is logged
3. Feature flag controls sparkline visibility
4. Preview deployment shows the sparkline working

### Security Component

**Task:** Ensure usage data respects access controls and API key hashing.

**Details:**
- The usage endpoint must verify the requesting user has access to the project
- API key IDs in the response should be the public prefix only (e.g., `ck_abc...`), never the full key
- Add rate limiting to the usage endpoint (max 60 requests per minute per user)
- Ensure the materialized view doesn't expose data across project boundaries
- Add an RLS policy on the materialized view if needed, or enforce access control at the API layer

**Files to study:**
- `lib/api-keys.ts` — Key hashing and masking patterns
- `lib/rate-limit.ts` — Rate limiting utilities
- `lib/encryption.ts` — Encryption patterns

**Acceptance Criteria:**
1. Usage data is scoped to the authenticated user's projects
2. Full API keys are never exposed in any response
3. Rate limiting is enforced on the endpoint
4. Cross-project data leakage is impossible

### Tests Required

| Test Type | What to Test | File |
|---|---|---|
| Unit | Sparkline trend calculation (up/down/flat) | `components/__tests__/UsageSparkline.test.tsx` |
| Unit | Usage data aggregation with gap filling | `lib/__tests__/api-key-usage.test.ts` |
| Integration | `/api/projects/[id]/api-keys/[id]/usage` auth and response | `__tests__/integration/api/api-key-usage.test.ts` |
| Unit | AI insight caching logic | `lib/__tests__/usage-insight-cache.test.ts` |

### Definition of Done

- [ ] PR opened with all code changes
- [ ] Sparkline visible on API keys page
- [ ] AI insights working on hover
- [ ] Materialized view created and refreshing
- [ ] Rate limiting active on usage endpoint
- [ ] Feature flag documented and working
- [ ] Demo recorded

---

## Week 3 — Scan Results Export

> **Deadline:** Friday, March 20, 2026
> **Story Points:** 5
> **Difficulty:** ⭐⭐ (Beginner+)

### Overview

Build a feature that allows users to export their scan results as CSV, JSON, or PDF reports. This introduces her to data transformation, file generation, and the scan pipeline while touching all six disciplines.

### Learning Objectives

- Understand the scan pipeline (`lib/scan/`) end-to-end
- Learn server-side file generation patterns
- Practice building export UIs with download triggers
- Understand how scan data is structured in the database

### AI Component

**Task:** Add an AI-generated executive summary to the PDF export.

**Details:**
- When exporting as PDF, include a 1-paragraph executive summary at the top
- Use the Gemini API to analyze all scan findings and generate a summary
- The summary should include: total issues found, severity breakdown, top 3 recommendations
- Example: *"This scan of `acme/frontend` found 12 issues: 3 critical, 5 high, 4 medium. The most urgent findings involve exposed API keys in environment files. We recommend rotating the affected keys immediately and adding `.env` to your `.gitignore`."*
- Handle large scan results by truncating to the top 20 findings before sending to the AI

**Files to study:**
- `lib/scan/llm-filter.ts` — How scan results are processed by AI
- `lib/scan/research.ts` — How findings are structured
- `lib/gemini.ts` — Gemini client

**Acceptance Criteria:**
1. Executive summary is relevant and actionable
2. Large scans are handled without exceeding token limits
3. PDF export includes the summary at the top
4. AI failure doesn't block the export — summary section shows "Summary unavailable"

### Backend Component

**Task:** Create export API routes under `app/api/scan/projects/[projectId]/export/route.ts`.

**Details:**
- Support three export formats via `format` query param: `csv`, `json`, `pdf`
- CSV export: flat table with columns `severity, title, file, line, description, recommendation`
- JSON export: full structured scan result data
- PDF export: formatted report with executive summary, findings table, and metadata
- Use streaming for large exports to avoid memory issues
- Set appropriate `Content-Type` and `Content-Disposition` headers for browser downloads

**Libraries to use:**
- CSV: Build manually with string concatenation (no library needed)
- JSON: Native `JSON.stringify` with pretty printing
- PDF: Use `@react-pdf/renderer` or `pdfmake` (evaluate which is simpler)

**Files to study:**
- `app/api/scan/projects/` — Existing scan API routes
- `app/api/projects/[projectId]/export/route.ts` — Existing export patterns if any
- `lib/scan/repository-scan.ts` — Scan result structure

**Acceptance Criteria:**
1. All three formats download correctly in the browser
2. CSV is valid and importable into Excel/Google Sheets
3. JSON matches the internal scan result structure
4. PDF is well-formatted with proper headings and tables
5. Exports handle 1000+ findings without timing out

### Frontend Component

**Task:** Build an export dialog with format selection and add it to the scan results page.

**Details:**
- Create `components/scan/ExportDialog.tsx`
- Trigger via an "Export" button on the scan results page (`app/scan/projects/`)
- The dialog should show:
  - Format selector (CSV / JSON / PDF) with icons for each
  - Optional: date range filter for historical exports
  - "Include AI Summary" toggle (only for PDF, enabled by default)
  - Download button with loading state
  - Progress indicator for large exports
- Download should trigger a browser save dialog
- Show a success toast after download completes

**Visual Design:**
- Modal dialog with backdrop blur
- Radio buttons for format selection with visual previews
- Animated download icon during generation
- Success state with checkmark animation

**Files to study:**
- `app/scan/page.tsx` — Scan results page
- `app/scan/ScanLayoutClient.tsx` — Scan layout patterns

**Acceptance Criteria:**
1. Export dialog opens from scan results page
2. All three format options work
3. Loading state shown during generation
4. Browser download dialog appears on completion
5. Error states are handled gracefully

### Database Component

**Task:** Create an `exports` table to track export history and implement efficient scan data queries.

**Details:**
- Design the schema:
  ```sql
  CREATE TABLE scan_exports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    format TEXT NOT NULL CHECK (format IN ('csv', 'json', 'pdf')),
    finding_count INTEGER NOT NULL,
    file_size_bytes INTEGER,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
    error_message TEXT,
    download_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
  );
  ```
- Add an index on `(project_id, created_at DESC)`
- Optimize the scan findings query for bulk export — ensure it uses proper indexes
- Add a query that fetches all findings for a project with pagination support

**Acceptance Criteria:**
1. Export history is persisted in the database
2. Export status is trackable (pending → generating → completed/failed)
3. Scan findings query is optimized for bulk reads
4. Old export records are cleaned up after 90 days

### DevOps Component

**Task:** Handle file storage for generated exports and configure deployment.

**Details:**
- Generated PDF/CSV files should be stored temporarily (Supabase Storage or in-memory)
- Configure a Supabase Storage bucket `scan-exports` for generated files
- Set up automatic cleanup of files older than 24 hours
- Add appropriate Vercel function configuration for larger payload sizes (PDF generation may need more memory)
- Configure `maxDuration` for the export route in `vercel.json` if needed (PDF generation may take time)
- Test that exports work in both development and preview deployment

**Acceptance Criteria:**
1. Export files are stored in Supabase Storage
2. Files are automatically cleaned up after 24 hours
3. Vercel function has sufficient memory/timeout for PDF generation
4. Works in both development and production environments

### Security Component

**Task:** Secure the export system with access controls and audit logging.

**Details:**
- Export endpoint requires project-level authentication
- Users can only export scan results for projects they have access to
- Add an audit log entry for each export (who exported what, when, which format)
- Sanitize scan findings in exports — redact any credential-like values (API keys, tokens) found in the findings
- Rate limit exports: max 10 exports per hour per user to prevent abuse
- Download URLs for stored exports should be signed URLs with 1-hour expiry

**RLS Policy:**
```sql
CREATE POLICY "Users can view their own exports"
ON scan_exports FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create exports for their projects"
ON scan_exports FOR INSERT
WITH CHECK (
  project_id IN (
    SELECT id FROM projects
    WHERE organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  )
);
```

**Files to study:**
- `app/api/projects/[projectId]/security/audit/route.ts` — Audit logging patterns
- `lib/rate-limit.ts` — Rate limiting
- `lib/safety/custom-data-rules.ts` — Data redaction patterns

**Acceptance Criteria:**
1. Only authorized users can trigger exports
2. Audit log records every export action
3. Credentials in findings are redacted in exports
4. Rate limiting prevents export abuse
5. Download URLs expire after 1 hour

### Tests Required

| Test Type | What to Test | File |
|---|---|---|
| Unit | CSV generation with special characters | `lib/__tests__/scan-export-csv.test.ts` |
| Unit | AI executive summary truncation logic | `lib/__tests__/scan-export-summary.test.ts` |
| Unit | Credential redaction in exports | `lib/__tests__/scan-export-redaction.test.ts` |
| Integration | Export endpoint returns correct content types | `__tests__/integration/api/scan-export.test.ts` |
| Component | ExportDialog renders and handles all states | `components/__tests__/ExportDialog.test.tsx` |

### Definition of Done

- [ ] PR opened with all code changes
- [ ] CSV, JSON, and PDF exports working
- [ ] AI executive summary included in PDF
- [ ] Export history tracked in database
- [ ] Files stored in Supabase Storage with cleanup
- [ ] Audit logging for all exports
- [ ] Rate limiting active
- [ ] Demo recorded

---

## Week 4 — Model Availability Monitor

> **Deadline:** Friday, March 27, 2026
> **Story Points:** 5
> **Difficulty:** ⭐⭐ (Beginner+)

### Overview

Build a real-time model availability monitor that shows which AI models are currently available, their response times, and any degradation. This deepens understanding of the provider system — the heart of Cencori's AI gateway.

### Learning Objectives

- Deep dive into the provider system (`lib/providers/`)
- Understand multi-provider routing and failover
- Learn about circuit breakers and health checking patterns
- Practice real-time UI updates

### AI Component

**Task:** Use the AI gateway to perform periodic health pings to each model and generate availability reports.

**Details:**
- Create a lightweight ping function that sends a minimal completion request to each configured model
- Measure response time, success/failure, and token usage
- Use the existing provider routing logic in `lib/providers/router.ts` to test each provider
- Track metrics: P50/P95 latency, error rate, uptime percentage
- Generate an AI-powered weekly availability report using Gemini that summarizes trends

**Files to study:**
- `lib/providers/router.ts` — Provider routing logic
- `lib/providers/config.ts` — Model configurations
- `lib/providers/circuit-breaker.ts` — Circuit breaker implementation
- `lib/providers/failover.ts` — Failover logic

**Acceptance Criteria:**
1. Health pings are sent to all configured providers
2. Latency metrics are accurate to the millisecond
3. Circuit breaker status is reflected in availability
4. Weekly trend report is generated automatically

### Backend Component

**Task:** Create API routes for model monitoring under `app/api/projects/[projectId]/providers/health/route.ts`.

**Details:**
- `GET` — Return current availability status for all models in the project
- `POST` — Trigger a manual health check for a specific model
- Response should include: model name, provider, status, latency, last checked timestamp, uptime percentage (24h)
- Use the existing provider configuration from `lib/providers/config.ts` to enumerate all models
- Implement a background health checker that runs every 2 minutes

**Response shape:**
```json
{
  "models": [
    {
      "model": "gpt-4o",
      "provider": "openai",
      "status": "available",
      "latencyMs": 890,
      "lastChecked": "2026-03-27T12:00:00Z",
      "uptime24h": 99.8,
      "circuitBreaker": "closed"
    },
    {
      "model": "claude-3.5-sonnet",
      "provider": "anthropic",
      "status": "degraded",
      "latencyMs": 2340,
      "lastChecked": "2026-03-27T12:00:00Z",
      "uptime24h": 97.2,
      "circuitBreaker": "half-open"
    }
  ]
}
```

**Acceptance Criteria:**
1. All configured models are included in the response
2. Manual health check triggers work
3. Background checker runs reliably
4. Latency measurements are accurate

### Frontend Component

**Task:** Build a `ModelAvailabilityDashboard` page at `app/dashboard/organizations/[orgSlug]/projects/[projectSlug]/providers/health/page.tsx`.

**Details:**
- Create a grid of model cards showing availability status
- Each card shows: model name, provider logo, status badge, latency gauge, uptime percentage
- Sort models: unavailable first, then degraded, then available
- Add auto-refresh every 30 seconds with a countdown timer
- Include a "Check Now" button for manual health pings
- Add a 24-hour timeline view showing historical availability

**Visual Design:**
- Status badges: green (available), yellow (degraded), red (unavailable)
- Latency shown as a small gauge or bar chart
- Smooth animations when status changes
- Pulsing dot for actively checking models
- Dark-mode friendly color palette

**Acceptance Criteria:**
1. All models displayed with correct status
2. Auto-refresh works without full page reload
3. Manual check triggers and updates the UI
4. 24-hour timeline shows historical data
5. Responsive layout for mobile

### Database Component

**Task:** Create a `model_health_checks` table and optimize for time-series queries.

**Details:**
- Schema:
  ```sql
  CREATE TABLE model_health_checks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    model_name TEXT NOT NULL,
    provider TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('available', 'degraded', 'unavailable')),
    latency_ms INTEGER,
    error_message TEXT,
    checked_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```
- Add a composite index on `(project_id, model_name, checked_at DESC)`
- Implement data retention — keep only 7 days of per-check data, aggregate older data into hourly summaries
- Create a function to calculate uptime percentage for a given model and time range
- Write the aggregation query for the 24-hour timeline view

**Acceptance Criteria:**
1. Health check data is stored efficiently
2. Time-range queries perform well (<200ms for 7 days)
3. Data retention policy is implemented
4. Uptime calculation is accurate

### DevOps Component

**Task:** Set up the background health checker as a cron job and configure alerting.

**Details:**
- Add a cron job that runs the health checker every 2 minutes
- Configure environment variables for health check thresholds (degraded > 1000ms, unavailable > 5000ms or error)
- Add logging for health check results to help with debugging
- Set up a simple alerting pattern — if a model is unavailable for 3+ consecutive checks, trigger a notification
- Verify the cron job works in Vercel's deployment environment
- Consider the cold start impact on latency measurements

**Acceptance Criteria:**
1. Cron job runs every 2 minutes reliably
2. Threshold configuration is via environment variables
3. Alerts trigger after 3 consecutive failures
4. Cold start impact is documented and accounted for

### Security Component

**Task:** Secure health check data and prevent information leakage.

**Details:**
- Health check endpoints require project-level authentication
- Provider API keys used for health pings must never appear in responses or logs
- Error messages from providers should be sanitized — remove API keys, account IDs, internal URLs
- RLS on `model_health_checks` to scope data to the user's projects
- Rate limit manual health checks (max 5 per minute per user) to prevent using it as a proxy for API abuse
- Ensure health check pings don't count against the user's usage quotas

**Acceptance Criteria:**
1. Provider credentials never leaked in responses
2. RLS enforced on health check data
3. Rate limiting on manual checks
4. Health pings excluded from usage billing
5. Error messages are sanitized

### Tests Required

| Test Type | What to Test | File |
|---|---|---|
| Unit | Health ping latency measurement | `lib/__tests__/model-health-ping.test.ts` |
| Unit | Uptime percentage calculation | `lib/__tests__/model-uptime.test.ts` |
| Unit | Status determination logic (thresholds) | `lib/__tests__/model-status.test.ts` |
| Integration | Health check endpoint auth and response | `__tests__/integration/api/model-health.test.ts` |
| Component | ModelAvailabilityDashboard renders all states | `components/__tests__/ModelAvailabilityDashboard.test.tsx` |

### Definition of Done

- [ ] PR opened with all code changes
- [ ] Model availability dashboard accessible from project navigation
- [ ] Auto-refresh and manual check working
- [ ] Health data persisted with retention policy
- [ ] Cron job deployed and running
- [ ] RLS and rate limiting active
- [ ] Demo recorded

---

### Month 1 Milestone Review

> **Deadline:** Friday, March 27, 2026
> **Review Format:** 30-minute meeting with manager

**Checklist for sign-off:**

- [ ] All 4 weekly PRs are merged to main
- [ ] All tests are passing in CI
- [ ] All 4 features are deployed and functional on preview
- [ ] Engineer can explain the architecture of each feature
- [ ] Engineer can draw the data flow from frontend → API → database for any feature
- [ ] Engineer has identified at least one improvement they'd make to each feature
- [ ] All demos are recorded and accessible

**Growth Assessment:**

| Skill | Expected Level by Month 1 End |
|---|---|
| AI | Can call the Gemini API, construct prompts, handle failures |
| Backend | Can create API routes with authentication and proper error handling |
| Frontend | Can build React components with state, loading states, and responsive design |
| Database | Can design simple tables, write migrations, add indexes |
| DevOps | Can configure cron jobs, environment variables, feature flags |
| Security | Can implement basic auth checks, RLS policies, rate limiting |

---
---


# MONTH 2 — CORE PLATFORM

> **Theme:** Build real product features, deepen understanding of the AI gateway and security systems
> **Dates:** March 30 – April 24, 2026
> **Monthly Milestone Deadline:** Friday, April 24, 2026
> **Monthly Review:** All 4 weekly PRs merged, tests passing, demos recorded

---

## Week 5 — Embeddings V1 Compatibility Route

> **Deadline:** Friday, April 3, 2026
> **Story Points:** 5
> **Difficulty:** ⭐⭐ (Beginner+)

### Overview

Create an OpenAI-compatible `/api/v1/embeddings` route that delegates to the existing embeddings infrastructure. Users need this to use Cencori as a drop-in replacement for OpenAI's embedding API.

### Learning Objectives

- Understand Cencori's v1 API compatibility layer (`app/api/v1/`)
- Learn how the embeddings system works (`app/api/ai/embeddings/route.ts`)
- Practice API design and backward compatibility
- Understand request/response transformation patterns

### AI Component

**Task:** Implement model mapping for embeddings — translate OpenAI model names to Cencori's internal model identifiers.

**Details:**
- Map common embedding model names (e.g., `text-embedding-3-small`, `text-embedding-ada-002`) to Cencori's configured providers
- Use the model configuration in `lib/providers/config.ts` to resolve aliases
- Support Cencori's model routing — if the requested model is unavailable, fall back to an alternative
- Add support for `dimensions` parameter to request specific embedding dimensions
- Log model resolution for debugging (which model was requested vs. which was used)

**Files to study:**
- `lib/providers/config.ts` — Model configuration and aliases
- `app/api/ai/embeddings/route.ts` — Existing embeddings route
- `lib/providers/router.ts` — Provider routing logic

**Acceptance Criteria:**
1. OpenAI model names resolve to correct Cencori providers
2. Fallback works when primary model is unavailable
3. `dimensions` parameter is passed through correctly
4. Model resolution is logged for debugging

### Backend Component

**Task:** Create the `/api/v1/embeddings` route with full OpenAI API compatibility.

**Details:**
- Create `app/api/v1/embeddings/route.ts`
- Accept the OpenAI embeddings request format:
  ```json
  {
    "input": "The quick brown fox",
    "model": "text-embedding-3-small",
    "encoding_format": "float",
    "dimensions": 1536
  }
  ```
- Support both string and array inputs
- Return the OpenAI-compatible response format:
  ```json
  {
    "object": "list",
    "data": [
      {
        "object": "embedding",
        "embedding": [0.0023, -0.009],
        "index": 0
      }
    ],
    "model": "text-embedding-3-small",
    "usage": { "prompt_tokens": 8, "total_tokens": 8 }
  }
  ```
- Handle batch inputs (array of strings) correctly
- Add `X-Request-ID` header for tracing

**Files to study:**
- `app/api/v1/chat/route.ts` — V1 chat route as a reference pattern
- `app/api/v1/models/route.ts` — V1 models route
- `lib/gateway-middleware.ts` — Gateway middleware patterns

**Acceptance Criteria:**
1. `POST /api/v1/embeddings` works with OpenAI-compatible payload
2. Response shape matches OpenAI's embedding API exactly
3. Batch inputs (array of strings) are handled
4. Usage tokens are tracked correctly
5. Error responses match OpenAI error format

### Frontend Component

**Task:** Add an embeddings testing interface to the project dashboard.

**Details:**
- Create `components/dashboard/EmbeddingsPlayground.tsx`
- The UI should include:
  - Text input area for embedding input
  - Model selector dropdown (populated from `/api/v1/models` filtering embedding models)
  - Dimensions selector
  - "Generate" button
  - Results view showing: embedding vector (truncated), dimensions, token usage, latency
  - Visual similarity comparison — input two texts and show cosine similarity score
- Add the embeddings endpoint to API docs code samples

**Visual Design:**
- Clean code-focused layout similar to an API explorer
- Syntax-highlighted request/response panels
- Cosine similarity shown as a percentage bar (0–100%)
- Copy-to-clipboard for the generated embedding vector

**Acceptance Criteria:**
1. Embeddings playground is accessible from the project dashboard
2. Model selection works correctly
3. Embedding results display with vector preview
4. Similarity comparison feature works
5. Code samples are shown for curl, Python, and TypeScript

### Database Component

**Task:** Track embedding requests in the existing analytics tables and add embedding-specific metadata.

**Details:**
- Ensure embedding requests are logged in the `ai_requests` table with `request_type = 'embedding'`
- Store in the JSONB metadata column: input token count, embedding dimensions, input count (number of strings in batch), model used (after resolution)
- Create a query to aggregate embedding usage by model and time period
- Add an index on `(project_id, request_type, created_at)` to support filtering by request type

**Acceptance Criteria:**
1. Embedding requests are logged with correct metadata
2. Analytics queries can filter by request type
3. Token usage is accurately tracked
4. Batch sizes are recorded

### DevOps Component

**Task:** Configure the embeddings route for production and set up monitoring.

**Details:**
- Ensure the embeddings route has appropriate Vercel function configuration (timeout, memory)
- Add the route to the existing API rate limiting configuration
- Monitor embedding latency and error rates
- Add the route to the health check system (built in Week 4)
- Test with real OpenAI SDK client to verify compatibility:
  ```python
  from openai import OpenAI
  client = OpenAI(base_url="https://api.cencori.com/v1", api_key="ck_...")
  response = client.embeddings.create(input="Hello", model="text-embedding-3-small")
  ```

**Acceptance Criteria:**
1. Route works in production Vercel environment
2. Rate limiting is applied
3. Monitoring captures latency and error metrics
4. OpenAI Python SDK works as a drop-in client

### Security Component

**Task:** Implement API key authentication and input validation for the embeddings route.

**Details:**
- Authenticate requests using the `Authorization: Bearer ck_...` pattern matching v1 chat routes
- Validate input: reject empty strings, enforce max input length (8192 tokens), limit batch size (max 100 inputs)
- Run inputs through the existing content filter (`lib/safety/content-filter.ts`)
- Log the request in the security audit trail
- Ensure embedding vectors don't leak across projects
- Add CORS headers matching the existing v1 routes

**Acceptance Criteria:**
1. Invalid API keys return 401
2. Input validation rejects oversized or empty inputs
3. Content filter blocks unsafe embedding inputs
4. Project isolation is enforced

### Tests Required

| Test Type | What to Test | File |
|---|---|---|
| Unit | Model name mapping and resolution | `lib/__tests__/embeddings-model-map.test.ts` |
| Unit | Input validation (empty, oversized, batch) | `lib/__tests__/embeddings-validation.test.ts` |
| Integration | Full request/response cycle with auth | `__tests__/integration/api/v1-embeddings.test.ts` |
| Integration | OpenAI SDK compatibility | `__tests__/integration/api/v1-embeddings-compat.test.ts` |

### Definition of Done

- [ ] PR opened with all code changes
- [ ] `/api/v1/embeddings` is OpenAI-compatible
- [ ] Embeddings playground working on dashboard
- [ ] Requests logged in analytics
- [ ] Rate limiting and content filtering active
- [ ] OpenAI Python SDK tested as client
- [ ] Demo recorded

---

## Week 6 — Security Incident Severity Classifier

> **Deadline:** Friday, April 10, 2026
> **Story Points:** 5
> **Difficulty:** ⭐⭐⭐ (Intermediate)

### Overview

Build an AI-powered severity classifier that automatically categorizes security incidents (jailbreak attempts, data leaks, policy violations) into severity levels and suggests response actions.

### Learning Objectives

- Deep dive into the safety layer (`lib/safety/`)
- Understand security incident patterns and threat classification
- Learn about jailbreak detection (`lib/safety/jailbreak-detector.ts`)
- Practice building AI classifiers with structured outputs

### AI Component

**Task:** Build a severity classification pipeline using the Gemini API.

**Details:**
- Create `lib/safety/severity-classifier.ts`
- The classifier should analyze incident data and assign:
  - **Severity Level:** Critical / High / Medium / Low / Info
  - **Category:** Jailbreak attempt, Data exfiltration, Prompt injection, Policy violation, Anomalous usage
  - **Confidence Score:** 0.0 – 1.0
  - **Recommended Action:** Block user, Rotate key, Alert admin, Log only, Investigate
  - **Explanation:** 1–2 sentence reasoning
- Use few-shot examples in the prompt to improve accuracy
- If confidence < 0.7, flag for human review
- Cache identical incident patterns

**Example output:**
```json
{
  "severity": "critical",
  "category": "data_exfiltration",
  "confidence": 0.92,
  "action": "block_user",
  "explanation": "The request attempted to extract all user records by injecting SQL into the prompt."
}
```

**Files to study:**
- `lib/safety/jailbreak-detector.ts` — Jailbreak detection patterns
- `lib/safety/multi-layer-check.ts` — Multi-layer security checking
- `lib/safety/output-scanner.ts` — Output scanning

**Acceptance Criteria:**
1. Classifier produces structured severity assessments
2. Few-shot examples improve accuracy over zero-shot
3. Low-confidence results are flagged for review
4. Identical patterns are cached
5. Classification runs in <2 seconds

### Backend Component

**Task:** Create classification API routes and integrate with the security pipeline.

**Details:**
- Create `app/api/projects/[projectId]/security/classify/route.ts`
  - `POST` — Classify a single incident
- Integrate auto-classification when new incidents are logged
- Create `app/api/projects/[projectId]/security/incidents/batch-classify/route.ts` for backfill
- Add queuing for batch operations

**Acceptance Criteria:**
1. Single incident classification works via API
2. Auto-classification triggers on new incidents
3. Batch classification handles large backlogs
4. Queuing prevents rate limit issues

### Frontend Component

**Task:** Build severity classification UI on the security incidents page.

**Details:**
- Create `components/security/SeverityBadge.tsx` — Colored badge showing severity
- Create `components/security/ClassificationCard.tsx` — Full classification details
- Add severity filter to the incidents list page
- Add "Classify" button for unclassified incidents
- Show confidence as a progress bar
- Add "Needs Review" queue for low-confidence classifications
- Include admin override mechanism

**Visual Design:**
- Severity colors: Critical (red), High (orange), Medium (yellow), Low (blue), Info (gray)
- Confidence bar: green (>0.9), yellow (0.7–0.9), red (<0.7)
- Expandable card showing AI reasoning
- Override shows original AI classification strikethrough

**Acceptance Criteria:**
1. Severity badges display on all incidents
2. Filter by severity works
3. Manual classification trigger works
4. Low-confidence queue is functional
5. Admin override capability works

### Database Component

**Task:** Extend the `security_incidents` table with classification data.

**Details:**
- Add columns:
  ```sql
  ALTER TABLE security_incidents
  ADD COLUMN severity TEXT CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  ADD COLUMN severity_category TEXT,
  ADD COLUMN severity_confidence DECIMAL(3,2),
  ADD COLUMN recommended_action TEXT,
  ADD COLUMN classification_explanation TEXT,
  ADD COLUMN classified_at TIMESTAMPTZ,
  ADD COLUMN classified_by TEXT DEFAULT 'ai' CHECK (classified_by IN ('ai', 'manual')),
  ADD COLUMN manual_override_by UUID REFERENCES auth.users(id),
  ADD COLUMN manual_override_at TIMESTAMPTZ;
  ```
- Add indexes for severity filtering:
  ```sql
  CREATE INDEX idx_incidents_severity ON security_incidents (project_id, severity, created_at DESC);
  CREATE INDEX idx_incidents_unclassified ON security_incidents (project_id) WHERE severity IS NULL;
  ```
- Create a view for the "Needs Review" queue

**Acceptance Criteria:**
1. Migration adds all new columns safely
2. Existing incidents are not broken
3. Indexes support the new filter queries
4. "Needs Review" view returns correct results

### DevOps Component

**Task:** Set up batch classification and alerting for critical incidents.

**Details:**
- Create a cron job that classifies unclassified incidents every 30 minutes
- Alert if >5 critical incidents in 1 hour
- Add feature flag `FEATURE_AUTO_CLASSIFY=true`
- Track classification token usage separately
- Configure concurrency limits (max 5 concurrent AI calls)

**Acceptance Criteria:**
1. Cron job classifies backlog incidents
2. Critical incident alerting works
3. Feature flag controls the feature
4. Token usage tracked separately

### Security Component

**Task:** Secure the classification system and prevent gaming.

**Details:**
- Classification endpoints require admin or owner role
- Classification explanations must not echo back malicious content
- Audit log all manual overrides
- Rate limit (max 100 per hour per project)
- Anti-prompt-injection: sanitize incident content before classification, use system prompt that instructs model to ignore instructions in content, validate output schema

**Acceptance Criteria:**
1. Only admins can trigger classification
2. Malicious content is not echoed
3. Manual overrides are audit-logged
4. Classifier is resistant to prompt injection

### Tests Required

| Test Type | What to Test | File |
|---|---|---|
| Unit | Severity classification with various incident types | `lib/safety/__tests__/severity-classifier.test.ts` |
| Unit | Prompt injection resistance | `lib/safety/__tests__/classifier-injection.test.ts` |
| Unit | Classification caching | `lib/safety/__tests__/classification-cache.test.ts` |
| Integration | Classification API endpoint | `__tests__/integration/api/security-classify.test.ts` |

### Definition of Done

- [ ] PR opened with all code changes
- [ ] Auto-classification running on new incidents
- [ ] Severity badges visible on incidents page
- [ ] Needs Review queue functional
- [ ] Alerting for critical incidents
- [ ] Prompt injection resistance tested
- [ ] Demo recorded

---

## Week 7 — Scan False-Positive Feedback Loop

> **Deadline:** Friday, April 17, 2026
> **Story Points:** 5
> **Difficulty:** ⭐⭐⭐ (Intermediate)

### Overview

Build a feedback system where users can mark scan findings as false positives, and this feedback improves the LLM filter's accuracy over time. This is a full-stack ML feedback loop.

### Learning Objectives

- Understand the scan LLM filter (`lib/scan/llm-filter.ts`) deeply
- Learn about feedback loops and ML improvement cycles
- Practice building interactive UIs with state management
- Understand how user feedback informs AI behavior

### AI Component

**Task:** Modify the LLM filter to incorporate historical feedback.

**Details:**
- Create `lib/scan/feedback-engine.ts`
- Before the LLM filter classifies a finding, check for similar past false positives using embedding similarity
- If similarity >0.9 to a confirmed false positive, auto-suppress with "likely false positive" label
- If 0.7–0.9 similarity, include feedback context in the LLM prompt
- Track precision/recall metrics

**Files to study:**
- `lib/scan/llm-filter.ts` — Current LLM filter
- `lib/scan/research.ts` — Finding structure
- `lib/scan/scan-memory.ts` — Scan memory patterns

**Acceptance Criteria:**
1. Feedback-informed filtering reduces false positives
2. Similar findings detected via embedding similarity
3. Auto-suppression works for high-similarity matches
4. Precision/recall metrics are tracked

### Backend Component

**Task:** Create feedback API routes.

**Details:**
- Create `app/api/scan/projects/[projectId]/findings/[findingId]/feedback/route.ts`
  - `POST` — Submit feedback (true positive, false positive, unsure)
  - `GET` — Get feedback status
  - `DELETE` — Remove feedback
- Create `app/api/scan/projects/[projectId]/feedback/stats/route.ts`
- Support bulk feedback for multiple findings

**Request format:**
```json
{
  "verdict": "false_positive",
  "reason": "This is a test file, not production code",
  "applyToSimilar": true
}
```

**Acceptance Criteria:**
1. Feedback submission and retrieval works
2. Bulk feedback works
3. Feedback statistics are accurate
4. Future scans use historical feedback

### Frontend Component

**Task:** Build feedback UI integrated into scan results.

**Details:**
- Create `components/scan/FindingFeedback.tsx` — Thumbs up/down per finding
- Create `components/scan/FeedbackStats.tsx` — Feedback impact metrics
- Add "False Positive" quick-action button with reason popover
- Show "Similar findings suppressed" notification
- Include undo capability within 30 seconds

**Visual Design:**
- Thumbs up/down icons with hover animation
- Green highlight for true positives, red strikethrough for false positives
- Reason dropdown: "Test file", "Known pattern", "Not applicable", "Custom"
- Toast notification on feedback submission

**Acceptance Criteria:**
1. Feedback buttons on each finding
2. Quick-action workflow ≤2 clicks
3. Stats dashboard shows trends
4. Undo works within 30 seconds

### Database Component

**Task:** Create feedback storage with embedding-based similarity search.

**Details:**
- Schema:
  ```sql
  CREATE TABLE scan_finding_feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    finding_hash TEXT NOT NULL,
    finding_title TEXT NOT NULL,
    finding_description TEXT,
    finding_embedding VECTOR(1536),
    verdict TEXT NOT NULL CHECK (verdict IN ('true_positive', 'false_positive', 'unsure')),
    reason TEXT,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```
- Enable pgvector extension
- Create IVFFlat index for similarity search
- Create `find_similar_feedback()` Postgres function

**Acceptance Criteria:**
1. Feedback stored with embeddings
2. Similarity search works with pgvector
3. Performance < 200ms for similarity queries
4. Feedback updatable and deletable

### DevOps Component

**Task:** Enable pgvector and set up embedding generation pipeline.

**Details:**
- Enable `vector` extension in Supabase
- Background job to generate embeddings for feedback entries
- Monitor feedback loop metrics
- Add feature flag `FEATURE_FEEDBACK_LOOP=true`
- Test pgvector performance with realistic data volumes

**Acceptance Criteria:**
1. pgvector enabled and working
2. Embedding generation runs automatically
3. Metrics tracked and visible
4. Performance validated at scale

### Security Component

**Task:** Prevent feedback manipulation and ensure data integrity.

**Details:**
- Only project members can submit feedback
- Feedback attributed to user
- Rate limit: 50 submissions per hour per user
- Validate finding belongs to specified project
- Sanitize content before embedding generation
- Audit log all feedback actions
- RLS on `scan_finding_feedback` scoped to project members

**Acceptance Criteria:**
1. Only authorized users can submit
2. Rate limiting prevents spam
3. Audit logging captures all actions
4. Embedding poisoning prevented

### Tests Required

| Test Type | What to Test | File |
|---|---|---|
| Unit | Embedding similarity calculation | `lib/scan/__tests__/feedback-similarity.test.ts` |
| Unit | Feedback-informed filter decisions | `lib/scan/__tests__/feedback-engine.test.ts` |
| Unit | Auto-suppression threshold logic | `lib/scan/__tests__/feedback-suppression.test.ts` |
| Integration | Feedback API endpoints | `__tests__/integration/api/scan-feedback.test.ts` |

### Definition of Done

- [ ] PR opened with all code changes
- [ ] Feedback UI on scan results page
- [ ] Similarity search working with pgvector
- [ ] Feedback-informed filtering active
- [ ] Stats dashboard showing trends
- [ ] Rate limiting and audit logging active
- [ ] Demo recorded

---

## Week 8 — Provider Latency Dashboard

> **Deadline:** Friday, April 24, 2026
> **Story Points:** 5
> **Difficulty:** ⭐⭐⭐ (Intermediate)

### Overview

Build a comprehensive provider latency analytics dashboard that helps users understand AI provider performance characteristics.

### Learning Objectives

- Understand request lifecycle through the gateway
- Learn analytics aggregation and visualization at scale
- Practice building complex dashboard UIs with multiple chart types
- Understand performance optimization for analytics queries

### AI Component

**Task:** Add AI-powered latency anomaly detection and performance recommendations.

**Details:**
- Create `lib/providers/latency-analyzer.ts`
- Detect anomalies (sudden spikes, gradual degradation)
- Generate recommendations:
  - *"OpenAI latency increased 40%. Consider routing critical requests to Claude as fallback."*
  - *"Switching to GPT-4o-mini for non-critical requests could reduce latency to ~800ms."*
- Generate daily performance digests
- Detect cost-efficiency opportunities

**Acceptance Criteria:**
1. Anomaly detection identifies latency spikes
2. Recommendations are actionable
3. Daily digests are generated
4. Cost-efficiency analysis works

### Backend Component

**Task:** Create latency analytics API routes with flexible aggregation.

**Details:**
- Create `app/api/projects/[projectId]/analytics/latency/route.ts`
  - Query params: `period` (1h, 24h, 7d, 30d), `provider`, `model`, `granularity` (minute, hour, day)
- Return P50/P95/P99 latency, error rate, request count, time series per provider
- Create `app/api/projects/[projectId]/analytics/latency/compare/route.ts` for side-by-side comparison
- Optimize with window functions for percentile calculations

**Acceptance Criteria:**
1. Aggregated latency data for all granularities
2. Provider and model filtering works
3. Comparison endpoint returns meaningful diffs
4. Queries handle large datasets efficiently

### Frontend Component

**Task:** Build a full-featured latency analytics page.

**Details:**
- Create `app/dashboard/organizations/[orgSlug]/projects/[projectSlug]/analytics/latency/page.tsx`
- Visualizations:
  - **Line chart:** P50/P95/P99 over time with provider color coding
  - **Bar chart:** Request volume by provider
  - **Heatmap:** Latency by hour-of-day and day-of-week
  - **Comparison view:** Side-by-side provider performance
  - **Scorecard row:** Key metrics (avg latency, error rate, total requests, cost)
- Interactive controls: time range, provider filter, granularity toggle
- AI recommendations in collapsible panel
- Drill-down to individual requests

**Acceptance Criteria:**
1. All chart types render with real data
2. Filters and time range work
3. AI recommendations panel works
4. Drill-down to individual requests
5. Responsive and dark-mode friendly

### Database Component

**Task:** Build pre-aggregation tables for fast analytics.

**Details:**
- Create hourly aggregation table:
  ```sql
  CREATE TABLE provider_latency_hourly (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    hour TIMESTAMPTZ NOT NULL,
    request_count INTEGER NOT NULL,
    p50_latency_ms INTEGER,
    p95_latency_ms INTEGER,
    p99_latency_ms INTEGER,
    error_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_cost_cents INTEGER DEFAULT 0
  );
  ```
- Composite index: `(project_id, provider, hour DESC)`
- Create daily materialized view
- Populate from raw `ai_requests` via cron
- Data retention: raw 30 days, hourly 1 year

**Acceptance Criteria:**
1. Pre-aggregation populated hourly
2. Percentile queries accurate
3. Dashboard loads in <1 second with millions of requests
4. Data retention enforced

### DevOps Component

**Task:** Set up aggregation pipelines and performance monitoring.

**Details:**
- Cron job for hourly aggregation
- Monitor aggregation job performance
- Configure caching headers (1-min for real-time, 1-hour for historical)
- Add feature flag `FEATURE_LATENCY_DASHBOARD=true`
- Load test analytics queries at production scale

**Acceptance Criteria:**
1. Aggregation runs reliably
2. Dashboard loads in <2 seconds
3. API responses appropriately cached
4. Performance validated at scale

### Security Component

**Task:** Protect analytics data and prevent information disclosure.

**Details:**
- Analytics endpoints require project-level auth
- Don't leak provider API keys or routing decisions
- RLS on `provider_latency_hourly`
- Rate limit (max 120/min — dashboards auto-refresh)
- Anonymize individual request data in drill-down
- Prevent cross-project inference

**Acceptance Criteria:**
1. Data scoped to authenticated user's projects
2. No sensitive information in responses
3. Rate limiting handles auto-refresh
4. Drill-down views anonymize content

### Tests Required

| Test Type | What to Test | File |
|---|---|---|
| Unit | Percentile calculation accuracy | `lib/__tests__/latency-percentile.test.ts` |
| Unit | Anomaly detection algorithm | `lib/__tests__/latency-anomaly.test.ts` |
| Unit | Time range and granularity logic | `lib/__tests__/latency-aggregation.test.ts` |
| Integration | Analytics API with various filters | `__tests__/integration/api/latency-analytics.test.ts` |

### Definition of Done

- [ ] PR opened with all code changes
- [ ] Latency dashboard accessible from navigation
- [ ] All chart types working with real data
- [ ] AI recommendations displaying
- [ ] Aggregation pipeline running hourly
- [ ] Performance validated at scale
- [ ] Demo recorded

---

### 📋 Month 2 Milestone Review

> **Deadline:** Friday, April 24, 2026
> **Review Format:** 45-minute meeting with manager

**Checklist for sign-off:**

- [ ] All 4 weekly PRs are merged to main
- [ ] All tests are passing in CI
- [ ] All 4 features are deployed and functional
- [ ] Engineer can explain the AI gateway's request lifecycle
- [ ] Engineer can describe the security incident flow from detection to classification
- [ ] Engineer has contributed to at least one code review for another team member
- [ ] All demos are recorded and accessible

**Growth Assessment:**

| Skill | Expected Level by Month 2 End |
|---|---|
| AI | Can build AI-powered features with structured outputs, caching, and fallbacks |
| Backend | Can design complex API routes with aggregation, pagination, and streaming |
| Frontend | Can build dashboards with charts, filters, and interactive state management |
| Database | Can design analytics schemas, use materialized views, work with pgvector |
| DevOps | Can set up aggregation pipelines, feature flags, and performance monitoring |
| Security | Can implement role-based access, audit logging, and anti-manipulation measures |

---
---


# MONTH 3 — INTEGRATION & SCALE

> **Theme:** Connect systems together, handle edge cases, work with production-scale data
> **Dates:** April 27 – May 22, 2026
> **Monthly Milestone Deadline:** Friday, May 22, 2026
> **Monthly Review:** All 4 weekly PRs merged, tests passing, demos recorded

---

## Week 9 — Memory Namespace Browser

> **Deadline:** Friday, May 1, 2026
> **Story Points:** 5
> **Difficulty:** ⭐⭐⭐ (Intermediate)

### Overview

Build a visual browser for Cencori's memory system that lets users explore, search, and manage memory namespaces and stored documents. This teaches the full memory pipeline from storage to retrieval.

### Learning Objectives

- Understand Cencori's memory system (`app/api/memory/`, `packages/sdk/src/memory/`)
- Learn about vector storage and semantic search
- Practice building file-browser-style UIs
- Understand document chunking and embedding strategies

### AI Component

**Task:** Add semantic search across memory namespaces with AI-powered result summaries.

**Details:**
- Implement semantic search using embeddings to find relevant memories across namespaces
- Generate AI summaries of search results: *"Found 3 memories about authentication flow. The most relevant is from the API docs namespace, describing the OAuth2 implementation."*
- Add "Ask Memory" feature — natural language questions that search memories and synthesize answers
- Use RAG patterns from `app/api/ai/rag/route.ts` as a reference

**Files to study:**
- `app/api/ai/rag/route.ts` — RAG pipeline
- `app/api/memory/` — Memory API routes
- `packages/sdk/src/memory/index.ts` — Memory SDK

**Acceptance Criteria:**
1. Semantic search returns relevant results across namespaces
2. AI summaries are accurate and helpful
3. "Ask Memory" synthesizes answers from stored knowledge
4. Search handles empty results gracefully

### Backend Component

**Task:** Create memory browsing API routes with pagination, filtering, and search.

**Details:**
- Create `app/api/projects/[projectId]/memory/browse/route.ts`
  - `GET` with params: `namespace`, `page`, `limit`, `search`, `sortBy`
- Create `app/api/projects/[projectId]/memory/[id]/route.ts`
  - `GET` — Full memory document with metadata
  - `DELETE` — Remove a specific memory
  - `PATCH` — Update memory metadata or content
- Support bulk operations (delete multiple, move between namespaces)
- Return memory metadata: size, chunk count, created date, last accessed, embedding status

**Acceptance Criteria:**
1. Paginated browsing of all memories in a namespace
2. Full-text and semantic search work
3. CRUD operations on individual memories
4. Bulk operations work correctly

### Frontend Component

**Task:** Build a file-browser-style memory explorer page.

**Details:**
- Create `app/dashboard/organizations/[orgSlug]/projects/[projectSlug]/memory/browser/page.tsx`
- Left sidebar: namespace tree (collapsible folders)
- Main panel: memory document list with search bar
- Detail panel: selected memory content preview, metadata, chunks
- Actions: delete, move, re-embed, copy content
- Search with highlighting of matching terms
- Drag-and-drop between namespaces

**Visual Design:**
- File tree with folder icons for namespaces, document icons for memories
- Preview pane with markdown rendering for memory content
- Chunk visualization showing how documents are split
- Search results with relevance score bars
- Skeleton loading states during navigation

**Acceptance Criteria:**
1. Namespace tree navigation works
2. Memory list with pagination
3. Document preview with metadata
4. Search with result highlighting
5. Delete and move operations work

### Database Component

**Task:** Optimize memory queries and add metadata tracking.

**Details:**
- Add indexes for memory browsing queries:
  ```sql
  CREATE INDEX idx_memories_namespace ON memories (project_id, namespace, created_at DESC);
  CREATE INDEX idx_memories_search ON memories USING gin (content gin_trgm_ops);
  ```
- Enable the `pg_trgm` extension for trigram-based text search
- Create a view that aggregates namespace statistics (memory count, total size, last updated)
- Add `last_accessed_at` column for tracking stale memories
- Implement soft delete with a `deleted_at` column

**Acceptance Criteria:**
1. Browsing queries are fast (<200ms)
2. Full-text search returns relevant results
3. Namespace statistics are accurate
4. Soft delete works correctly

### DevOps Component

**Task:** Set up memory cleanup cron and storage monitoring.

**Details:**
- Cron job to purge soft-deleted memories after 30 days
- Monitor memory storage usage per project
- Alert when a project exceeds storage limits
- Add feature flag `FEATURE_MEMORY_BROWSER=true`
- Configure memory preview rendering limits (max 10KB preview)

**Acceptance Criteria:**
1. Soft-deleted memories are cleaned up
2. Storage usage is monitored
3. Feature flag controls access
4. Large memory previews don't crash the UI

### Security Component

**Task:** Implement granular access controls for memory operations.

**Details:**
- Memory browsing requires project membership
- Delete operations require admin or owner role
- Audit log all memory operations (create, read, update, delete)
- Memory content should be scanned for sensitive data before display (redact API keys, tokens)
- RLS policies ensure project isolation
- Rate limit memory search (max 30 searches per minute)

**Acceptance Criteria:**
1. Role-based access for destructive operations
2. Memory content is scanned for sensitive data
3. Audit logging captures all operations
4. Search is rate limited

### Tests Required

| Test Type | What to Test | File |
|---|---|---|
| Unit | Namespace tree building logic | `lib/__tests__/memory-namespace-tree.test.ts` |
| Unit | Memory search relevance ranking | `lib/__tests__/memory-search.test.ts` |
| Integration | Memory browse API with pagination | `__tests__/integration/api/memory-browse.test.ts` |
| Component | Memory browser renders all states | `components/__tests__/MemoryBrowser.test.tsx` |

### Definition of Done

- [ ] PR opened with all code changes
- [ ] Memory browser accessible from project dashboard
- [ ] Namespace navigation and search working
- [ ] CRUD operations functional
- [ ] Storage monitoring active
- [ ] Demo recorded

---

## Week 10 — Webhook Delivery Logs

> **Deadline:** Friday, May 8, 2026
> **Story Points:** 5
> **Difficulty:** ⭐⭐⭐ (Intermediate)

### Overview

Build a webhook delivery log system that shows users the history of webhook calls, their payloads, responses, and retry status. This deepens understanding of event-driven architecture and reliability patterns.

### Learning Objectives

- Understand Cencori's webhook system (`lib/webhooks.ts`, `lib/webhooks/`)
- Learn event-driven architecture patterns
- Practice building log viewer UIs with filtering and detail views
- Understand retry logic and delivery guarantees

### AI Component

**Task:** Add AI-powered webhook delivery analysis and troubleshooting.

**Details:**
- When a webhook fails, use the Gemini API to analyze the error and suggest fixes:
  - *"The webhook returned a 401. This usually means the authentication token has expired. Check the webhook secret in your settings."*
  - *"The webhook timed out after 30 seconds. Your endpoint is likely processing the payload synchronously. Consider using a queue."*
- Generate daily delivery reports: success rate, common failure patterns, latency trends
- Create a "Webhook Doctor" feature that proactively identifies unhealthy webhook configurations

**Files to study:**
- `lib/webhooks.ts` — Webhook delivery logic
- `lib/webhooks/` — Webhook infrastructure
- `app/api/projects/[projectId]/webhooks/` — Webhook API routes

**Acceptance Criteria:**
1. AI troubleshooting explains failures in plain language
2. Daily reports highlight delivery trends
3. "Webhook Doctor" identifies configuration issues
4. AI suggestions are actionable

### Backend Component

**Task:** Create webhook delivery log API routes with replay capability.

**Details:**
- Create `app/api/projects/[projectId]/webhooks/deliveries/route.ts`
  - `GET` — List deliveries with filtering (status, webhook ID, date range)
- Create `app/api/projects/[projectId]/webhooks/deliveries/[deliveryId]/route.ts`
  - `GET` — Full delivery details including payload and response
- Create `app/api/projects/[projectId]/webhooks/deliveries/[deliveryId]/replay/route.ts`
  - `POST` — Replay a failed delivery
- Support retry logic: exponential backoff, max 5 retries, dead letter after failure

**Acceptance Criteria:**
1. Delivery history with comprehensive filtering
2. Full payload and response inspection
3. Replay sends the same payload to the same endpoint
4. Retry logic with exponential backoff

### Frontend Component

**Task:** Build a webhook delivery log viewer.

**Details:**
- Create `app/dashboard/organizations/[orgSlug]/projects/[projectSlug]/webhooks/deliveries/page.tsx`
- List view: status icon, webhook name, timestamp, response code, latency
- Detail panel: request headers, payload (JSON formatted), response body, retry history
- Filters: status (success/failed/pending), webhook endpoint, date range
- "Replay" button with confirmation dialog
- Live updates — new deliveries appear without page refresh
- AI troubleshooting panel for failed deliveries

**Visual Design:**
- Status icons: green checkmark (200-299), yellow warning (300-499), red X (500+, timeout)
- Collapsible JSON viewer with syntax highlighting
- Timeline showing retry attempts
- Diff view comparing original and replayed responses

**Acceptance Criteria:**
1. Delivery list with all filter options
2. Detail panel shows full request/response
3. Replay triggers correctly
4. AI troubleshooting for failures
5. Live updates work

### Database Component

**Task:** Create webhook delivery log table with efficient querying.

**Details:**
- Schema:
  ```sql
  CREATE TABLE webhook_deliveries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    webhook_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    request_headers JSONB,
    response_status INTEGER,
    response_body TEXT,
    response_headers JSONB,
    latency_ms INTEGER,
    status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
    attempt_count INTEGER DEFAULT 1,
    max_attempts INTEGER DEFAULT 5,
    next_retry_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
  );
  ```
- Indexes: `(project_id, webhook_id, created_at DESC)`, `(status, next_retry_at)` for retry queries
- Data retention: keep deliveries for 30 days
- Partition by month if volume is high

**Acceptance Criteria:**
1. All delivery data is captured
2. Queries with filters are fast
3. Retry queue queries are efficient
4. Data retention is enforced

### DevOps Component

**Task:** Set up webhook retry processor and delivery monitoring.

**Details:**
- Cron job to process retry queue every minute
- Monitor delivery success rate per webhook endpoint
- Alert when a webhook endpoint has >50% failure rate over 1 hour
- Configure webhook timeout (default 30 seconds, configurable per endpoint)
- Set up dead letter logging for permanently failed deliveries

**Acceptance Criteria:**
1. Retry processor runs reliably
2. Delivery success rate is monitored
3. Alerts trigger for unhealthy endpoints
4. Dead letter logging captures permanent failures

### Security Component

**Task:** Secure webhook logs and implement payload sanitization.

**Details:**
- Webhook delivery logs require project admin access
- Payload inspection redacts sensitive fields (API keys, tokens, passwords)
- Replay requires explicit admin confirmation and generates audit log entry
- Webhook signing secrets are never exposed in delivery logs
- Rate limit replay endpoint (max 10 replays per minute)
- RLS on `webhook_deliveries` scoped to project

**Acceptance Criteria:**
1. Only admins can view delivery logs
2. Sensitive payload fields are redacted
3. Replay generates audit trail
4. Signing secrets never exposed

### Tests Required

| Test Type | What to Test | File |
|---|---|---|
| Unit | Retry backoff calculation | `lib/__tests__/webhook-retry.test.ts` |
| Unit | Payload sanitization | `lib/__tests__/webhook-sanitize.test.ts` |
| Unit | AI troubleshooting prompt | `lib/__tests__/webhook-troubleshoot.test.ts` |
| Integration | Delivery log API with filters | `__tests__/integration/api/webhook-deliveries.test.ts` |

### Definition of Done

- [ ] PR opened with all code changes
- [ ] Delivery log viewer accessible from webhooks page
- [ ] Replay capability working
- [ ] AI troubleshooting for failures
- [ ] Retry processor running
- [ ] Demo recorded

---

## Week 11 — RAG Source Attribution UI

> **Deadline:** Friday, May 15, 2026
> **Story Points:** 5
> **Difficulty:** ⭐⭐⭐ (Intermediate)

### Overview

Build a source attribution system for RAG (Retrieval-Augmented Generation) responses, showing users exactly which documents informed the AI's answer. This deepens understanding of the RAG pipeline.

### Learning Objectives

- Understand the RAG pipeline (`app/api/ai/rag/route.ts`)
- Learn about source attribution and citation systems
- Practice building interactive annotation UIs
- Understand chunking, retrieval, and generation flow

### AI Component

**Task:** Modify the RAG pipeline to track and return source attributions.

**Details:**
- Update `app/api/ai/rag/route.ts` to include source metadata with each response
- For each retrieved chunk, track: source document, chunk index, relevance score, exact text used
- Generate inline citations in the AI response: "According to [Source 1]..."
- Calculate confidence score for how well the response is grounded in sources
- Handle cases where the AI generates content beyond retrieved sources (flag as "ungrounded")

**Acceptance Criteria:**
1. Sources are tracked through the RAG pipeline
2. Inline citations appear in responses
3. Grounding confidence score is calculated
4. Ungrounded content is flagged

### Backend Component

**Task:** Create source attribution API routes.

**Details:**
- Extend the RAG response format:
  ```json
  {
    "answer": "The authentication flow uses OAuth2...",
    "sources": [
      {
        "id": "src_1",
        "title": "Authentication Guide",
        "namespace": "docs",
        "chunk": "OAuth2 is used for...",
        "relevance": 0.94,
        "citedInAnswer": true
      }
    ],
    "grounding": { "score": 0.91, "ungroundedSpans": [] }
  }
  ```
- Create `app/api/projects/[projectId]/rag/sources/route.ts` for source management
- Support source feedback: "Was this source helpful?"

**Acceptance Criteria:**
1. Sources included in RAG responses
2. Source management API works
3. Source feedback collection works
4. Grounding score is calculated

### Frontend Component

**Task:** Build source attribution UI for RAG responses.

**Details:**
- Create `components/ai/SourceAttribution.tsx` — Inline citation links in AI responses
- Create `components/ai/SourcePanel.tsx` — Side panel showing all sources
- Citation links highlight the relevant source in the panel when clicked
- Show relevance score as a colored bar per source
- "Ungrounded" text highlighted with a subtle warning style
- Source feedback buttons (helpful/not helpful)

**Visual Design:**
- Citations as superscript numbered links: "...uses OAuth2[1]..."
- Source panel slides in from the right
- Source cards with document title, namespace, chunk preview
- Relevance shown as a horizontal progress bar
- Ungrounded text with dotted underline and info tooltip

**Acceptance Criteria:**
1. Citations render as clickable links
2. Source panel shows detailed attribution
3. Click-to-highlight source mapping works
4. Grounding visualization is clear
5. Source feedback submits correctly

### Database Component

**Task:** Create source attribution tracking tables.

**Details:**
- Schema:
  ```sql
  CREATE TABLE rag_attributions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id UUID NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    source_id UUID NOT NULL,
    source_title TEXT,
    source_namespace TEXT,
    chunk_text TEXT NOT NULL,
    relevance_score DECIMAL(3,2),
    cited_in_answer BOOLEAN DEFAULT FALSE,
    grounding_score DECIMAL(3,2),
    user_feedback TEXT CHECK (user_feedback IN ('helpful', 'not_helpful')),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```
- Index on `(project_id, request_id)` and `(source_id, created_at DESC)`
- Create aggregation query for "most cited sources" analytics

**Acceptance Criteria:**
1. Attributions are stored per request
2. Queries for individual requests are fast
3. Analytics queries work for popular sources
4. Source feedback is tracked

### DevOps Component

**Task:** Monitor RAG quality and set up grounding alerts.

**Details:**
- Track grounding scores over time
- Alert when average grounding score drops below 0.7
- Monitor source retrieval latency
- Add feature flag `FEATURE_SOURCE_ATTRIBUTION=true`
- Configure attribution storage limits (max 50 sources per response)

**Acceptance Criteria:**
1. Grounding scores tracked
2. Alerts for quality degradation
3. Retrieval latency monitored
4. Feature flag works

### Security Component

**Task:** Secure source data and prevent information leakage.

**Details:**
- Only project members can view attributions
- Source chunks must respect document-level access controls
- Don't expose source content from namespaces the user doesn't have access to
- Audit log source feedback
- Rate limit source attribution lookups

**Acceptance Criteria:**
1. Namespace-level access controls enforced
2. Cross-namespace leakage impossible
3. Source feedback is audit-logged
4. Rate limiting active

### Tests Required

| Test Type | What to Test | File |
|---|---|---|
| Unit | Citation extraction from AI response | `lib/__tests__/rag-citation.test.ts` |
| Unit | Grounding score calculation | `lib/__tests__/rag-grounding.test.ts` |
| Integration | RAG response with attributions | `__tests__/integration/api/rag-attribution.test.ts` |
| Component | SourceAttribution rendering | `components/__tests__/SourceAttribution.test.tsx` |

### Definition of Done

- [ ] PR opened with all code changes
- [ ] Source attributions in RAG responses
- [ ] Citation UI working with click-to-highlight
- [ ] Grounding visualization clear
- [ ] Source feedback collecting
- [ ] Demo recorded

---

## Week 12 — Budget Alert Notification System

> **Deadline:** Friday, May 22, 2026
> **Story Points:** 5
> **Difficulty:** ⭐⭐⭐ (Intermediate)

### Overview

Build a notification system that alerts users when their AI spending approaches or exceeds budget limits. This integrates the budgets system with email, in-app, and webhook notifications.

### Learning Objectives

- Understand the budgets system (`lib/budgets.ts`)
- Learn notification system design (multi-channel delivery)
- Practice event-driven architecture
- Understand cost tracking and billing patterns

### AI Component

**Task:** Generate AI-powered budget insights and spending forecasts.

**Details:**
- Analyze spending patterns to predict when the user will exhaust their budget
- Generate alerts like: *"At current spending rate, you'll hit your $500 monthly budget by March 18 — 12 days early."*
- Recommend cost-saving actions: model switching, caching, request batching
- Create spending anomaly detection: *"Your spending today is 5x your daily average. This is unusual."*

**Acceptance Criteria:**
1. Spending forecast is reasonably accurate
2. Cost-saving recommendations are actionable
3. Anomaly detection catches unusual patterns
4. Forecasts update daily

### Backend Component

**Task:** Create budget notification API and event processing pipeline.

**Details:**
- Create `app/api/projects/[projectId]/budget/notifications/route.ts`
  - `GET` — List notification history
  - `POST` — Configure notification preferences (thresholds, channels)
- Create `lib/budget-notifications.ts` — Notification evaluation engine
  - Check budget thresholds: 50%, 75%, 90%, 100% of budget
  - Support notification channels: email, in-app, webhook
  - Implement notification deduplication (don't send same alert twice)
- Integrate with the existing budgets system in `lib/budgets.ts`

**Acceptance Criteria:**
1. Threshold-based notifications trigger correctly
2. Multi-channel delivery works
3. Deduplication prevents notification spam
4. Notification preferences are persisted

### Frontend Component

**Task:** Build budget notification configuration UI and in-app notification center.

**Details:**
- Create `components/dashboard/BudgetNotificationConfig.tsx`
  - Threshold sliders (50%, 75%, 90%, 100%)
  - Channel toggles (email, in-app, webhook)
  - Email recipient list management
- Create `components/dashboard/NotificationCenter.tsx`
  - Bell icon in the dashboard header with unread count badge
  - Dropdown showing recent notifications
  - Mark as read / dismiss
  - "View all" link to full notification history
- Budget spending bar with threshold markers

**Visual Design:**
- Threshold markers as colored lines on the budget bar
- Warning colors as spending approaches limits
- Notification bell with pulsing animation for unread
- Notification cards with severity-colored left border

**Acceptance Criteria:**
1. Threshold configuration works
2. Notification center shows alerts
3. Mark as read works
4. Budget bar shows threshold markers
5. Unread count updates in real time

### Database Component

**Task:** Create notification tables and budget threshold tracking.

**Details:**
- Schema:
  ```sql
  CREATE TABLE budget_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL,
    threshold_percent INTEGER,
    current_spend_cents INTEGER,
    budget_limit_cents INTEGER,
    message TEXT NOT NULL,
    channels TEXT[] NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    sent_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE budget_notification_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    thresholds INTEGER[] DEFAULT '{50, 75, 90, 100}',
    channels TEXT[] DEFAULT '{in_app}',
    email_recipients TEXT[],
    webhook_url TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```
- Index: `(project_id, user_id, created_at DESC)` for notification listing
- Index: `(project_id, threshold_percent)` for deduplication checks

**Acceptance Criteria:**
1. Notification history persisted
2. Preference management works
3. Deduplication query is efficient
4. Notification status tracking works

### DevOps Component

**Task:** Set up budget checking cron and multi-channel delivery.

**Details:**
- Cron job checks all project budgets every 15 minutes
- Email delivery via existing email service (`app/api/email/`)
- In-app notification delivery via database insert
- Webhook delivery via the webhook system (built in Week 10)
- Monitor notification delivery rates
- Feature flag `FEATURE_BUDGET_ALERTS=true`

**Acceptance Criteria:**
1. Budget checks run every 15 minutes
2. All channels deliver successfully
3. Delivery monitoring active
4. Feature flag controls the feature

### Security Component

**Task:** Secure notification system and prevent abuse.

**Details:**
- Only project admins can configure notification preferences
- Email recipients must be verified organization members
- Webhook URLs must use HTTPS
- Notification content doesn't expose exact spending amounts to non-admin users
- Rate limit: max 100 notifications per project per day
- Audit log all preference changes

**Acceptance Criteria:**
1. Admin-only preference configuration
2. Email recipients validated
3. HTTPS enforced for webhooks
4. Spending details scoped by role
5. Rate limiting prevents notification flood

### Tests Required

| Test Type | What to Test | File |
|---|---|---|
| Unit | Threshold evaluation logic | `lib/__tests__/budget-threshold.test.ts` |
| Unit | Notification deduplication | `lib/__tests__/budget-dedup.test.ts` |
| Unit | Spending forecast accuracy | `lib/__tests__/budget-forecast.test.ts` |
| Integration | Budget notification API | `__tests__/integration/api/budget-notifications.test.ts` |
| Component | NotificationCenter rendering | `components/__tests__/NotificationCenter.test.tsx` |

### Definition of Done

- [ ] PR opened with all code changes
- [ ] Budget alerts triggering at configured thresholds
- [ ] Multi-channel delivery (email, in-app, webhook)
- [ ] Notification center in dashboard header
- [ ] Spending forecasts displaying
- [ ] Demo recorded

---

### Month 3 Milestone Review

> **Deadline:** Friday, May 22, 2026
> **Review Format:** 45-minute meeting with manager

**Checklist for sign-off:**

- [ ] All 4 weekly PRs are merged to main
- [ ] All tests are passing in CI
- [ ] Engineer can explain event-driven architecture with examples from webhooks and notifications
- [ ] Engineer can describe RAG pipeline from query to cited response
- [ ] Engineer has independently debugged at least one production issue
- [ ] All demos are recorded and accessible

**Growth Assessment:**

| Skill | Expected Level by Month 3 End |
|---|---|
| AI | Can build RAG pipelines, semantic search, and AI-powered analysis features |
| Backend | Can design event-driven systems with retry logic and multi-channel delivery |
| Frontend | Can build complex UIs with file browsers, log viewers, and notification centers |
| Database | Can work with pgvector, full-text search (pg_trgm), and event-sourcing tables |
| DevOps | Can set up multi-job cron systems, monitoring, and alerting |
| Security | Can implement role-based access with granular operation-level permissions |

---
---
