# Task Brief: Model Evaluation Suite

**Assigned to:** Ifeoluwa Adebanjo
**Deadline:** 3 weeks from start date
**Priority:** High — this becomes a core product feature

---

## Overview

Build Cencori's Model Evaluation Suite — a system that lets users define test cases, run them against any AI model through our gateway, score the results, and view performance over time. This is the foundation of `cencori.eval`.

When you're done, a user should be able to:

1. Create a set of test cases (input prompt + expected output criteria)
2. Run those tests against one or more models with a single API call
3. See pass/fail rates, scores, and model comparisons in the dashboard
4. Use the TypeScript SDK: `cencori.eval.run({ ... })`

---

## Week 1: Database + API

### Database Schema

Create a new migration file: `database/migrations/022_eval_suite.sql`

You need these tables:

**`eval_suites`** — a named collection of test cases
- `id` (UUID, primary key, default gen_random_uuid())
- `project_id` (UUID, references projects.id)
- `name` (text, not null) — e.g., "Customer Support Quality"
- `description` (text)
- `created_by` (UUID, references auth.users.id)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

**`eval_cases`** — individual test cases within a suite
- `id` (UUID, primary key, default gen_random_uuid())
- `suite_id` (UUID, references eval_suites.id ON DELETE CASCADE)
- `name` (text) — optional label for this test case
- `input_messages` (JSONB, not null) — the messages array to send (same format as chat completions)
- `scoring_method` (text, not null) — one of: 'exact_match', 'contains', 'regex', 'llm_judge'
- `expected_output` (text) — the expected result (exact string, substring, or regex pattern)
- `llm_judge_criteria` (text) — natural language criteria for LLM judge (e.g., "Response should be polite and mention the refund policy")
- `weight` (float, default 1.0) — relative importance
- `created_at` (timestamptz, default now())

**`eval_runs`** — a single execution of a suite against a model
- `id` (UUID, primary key, default gen_random_uuid())
- `suite_id` (UUID, references eval_suites.id)
- `project_id` (UUID, references projects.id)
- `model` (text, not null) — the model tested (e.g., 'gpt-4o')
- `status` (text, default 'running') — 'running', 'completed', 'failed'
- `total_cases` (int)
- `passed` (int, default 0)
- `failed` (int, default 0)
- `score` (float) — weighted pass rate (0.0 to 1.0)
- `total_tokens` (int, default 0)
- `total_cost` (float, default 0)
- `total_latency_ms` (int, default 0)
- `started_at` (timestamptz, default now())
- `completed_at` (timestamptz)
- `created_by` (UUID, references auth.users.id)

**`eval_results`** — per-case results within a run
- `id` (UUID, primary key, default gen_random_uuid())
- `run_id` (UUID, references eval_runs.id ON DELETE CASCADE)
- `case_id` (UUID, references eval_cases.id)
- `model_output` (text) — what the model actually returned
- `passed` (boolean)
- `score` (float) — 0.0 to 1.0
- `scoring_details` (JSONB) — explanation of why it passed/failed
- `tokens_used` (int)
- `cost` (float)
- `latency_ms` (int)
- `created_at` (timestamptz, default now())

Add RLS policies:
- Users can only access eval data for projects they belong to
- Use the same pattern as other tables — check `organization_members` membership through `projects.organization_id`

### API Endpoints

Create these route files:

**`app/api/v1/eval/suites/route.ts`**
- `GET` — list all eval suites for a project (requires `x-project-id` header)
- `POST` — create a new suite with test cases

**`app/api/v1/eval/suites/[suiteId]/route.ts`**
- `GET` — get suite details with all test cases
- `PATCH` — update suite name/description
- `DELETE` — delete suite and all associated data

**`app/api/v1/eval/suites/[suiteId]/cases/route.ts`**
- `POST` — add test cases to a suite
- `DELETE` — remove specific test cases

**`app/api/v1/eval/run/route.ts`** — this is the main one
- `POST` — run an eval suite against a model
- Request body: `{ suite_id, model, temperature?, max_tokens? }`
- For each test case in the suite:
  1. Call the Cencori gateway internally (use the project's own API key)
  2. Score the output based on `scoring_method`:
     - `exact_match`: output === expected_output
     - `contains`: output.includes(expected_output)
     - `regex`: new RegExp(expected_output).test(output)
     - `llm_judge`: send the output + criteria to a strong model (gpt-4o) and ask it to score 0-1
  3. Save the result to `eval_results`
- After all cases complete, update `eval_runs` with final stats
- Return the run ID immediately, process cases in the background if possible

**`app/api/v1/eval/runs/route.ts`**
- `GET` — list runs for a suite, with pagination
- Query params: `suite_id`, `model` (optional filter)

**`app/api/v1/eval/runs/[runId]/route.ts`**
- `GET` — get run details with all individual results

### Authentication

All endpoints should authenticate using the Cencori API key from headers (same as the gateway). Look at how `extractCencoriApiKeyFromHeaders` works in `lib/api-keys.ts` and follow that pattern. The API key maps to a project, which gives you `project_id`.

### Week 1 Deliverable

By end of week 1, you should be able to:
- Create a suite with test cases via POST
- Run that suite against any model via POST
- Get results via GET
- Test everything with curl or Postman

---

## Week 2: Dashboard UI

### Location

Create the eval dashboard page at:
`app/dashboard/organizations/[orgSlug]/projects/[projectSlug]/eval/page.tsx`

### Design

Follow the existing dashboard patterns. Look at these files for reference:
- `app/dashboard/organizations/[orgSlug]/projects/[projectSlug]/ai/logs/page.tsx` — for table/list patterns
- `app/dashboard/organizations/[orgSlug]/projects/[projectSlug]/security/page.tsx` — for tabbed layouts

Use shadcn/ui components: Card, Button, Badge, Skeleton, Dialog, Input, Textarea, Select.
Use lucide-react for icons. Use TanStack React Query for data fetching.

### Pages/Views

**Main eval page** — 2 tabs: "Suites" and "Runs"

**Suites tab:**
- List of eval suites (name, description, # of test cases, last run date)
- "New Suite" button → opens a dialog/form to create a suite
- Click a suite → expands or navigates to show its test cases
- Each test case shows: name, scoring method, expected output (truncated)
- "Add Test Case" button within a suite
- "Run Eval" button on each suite → opens a dialog to pick a model, then triggers a run

**Runs tab:**
- List of eval runs (suite name, model, score, pass/fail count, date, status badge)
- Click a run → shows all individual case results
- Each result: test case name, model output (truncated, expandable), pass/fail badge, score, latency, tokens
- Color coding: green for passed, red for failed

**Model Comparison** (stretch goal):
- If a suite has been run against multiple models, show a comparison table
- Columns: test case name, Model A score, Model B score, ...
- Summary row with overall pass rate per model

### Navigation

Add an "Eval" link to the project sidebar. Look at how other sidebar items are added in the dashboard layout.

### Week 2 Deliverable

By end of week 2, you should be able to:
- Create suites and test cases from the UI
- Trigger eval runs from the UI
- View results with pass/fail indicators
- Everything looks clean and matches the existing dashboard style

---

## Week 3: SDK + LLM Judge + Polish

### TypeScript SDK

Add the `eval` namespace to the SDK.

**Location:** `packages/sdk/src/`

1. Create `eval.ts` with an `EvalNamespace` class (follow the pattern in `ai.ts`)
2. Register it in the main `Cencori` class in `index.ts` as `this.eval = new EvalNamespace(this.config)`
3. Add the export path in `package.json` under `exports`

**Methods to implement:**

```typescript
// Create a suite
const suite = await cencori.eval.createSuite({
  name: "Customer Support Quality",
  description: "Tests for our support chatbot",
  cases: [
    {
      name: "Greeting test",
      input: [{ role: "user", content: "Hello" }],
      scoring: "contains",
      expected: "hello",
    },
    {
      name: "Refund policy",
      input: [{ role: "user", content: "How do I get a refund?" }],
      scoring: "llm_judge",
      criteria: "Response should mention the 30-day refund policy and include steps",
    },
  ],
});

// Run evaluation
const run = await cencori.eval.run({
  suiteId: suite.id,
  model: "gpt-4o",
});

// Get results
const results = await cencori.eval.getRun(run.id);

// List runs for comparison
const runs = await cencori.eval.listRuns({ suiteId: suite.id });
```

### LLM Judge Implementation

This is the most interesting part. When `scoring_method` is `llm_judge`:

1. Take the original input, the model's output, and the `llm_judge_criteria`
2. Send them to a strong model (gpt-4o or claude-3-5-sonnet) with a system prompt like:

```
You are an AI output evaluator. Score the following model output on a scale of 0.0 to 1.0.

Criteria: {criteria}

Input: {original input}
Output: {model output}

Respond with ONLY a JSON object: { "score": 0.0-1.0, "reason": "brief explanation" }
```

3. Parse the response and use the score
4. A score >= 0.7 counts as "passed" (make this configurable later)

### Polish

- Add loading states and error handling everywhere
- Add empty states ("No eval suites yet. Create one to get started.")
- Make sure the eval run shows a progress indicator while cases are being processed
- Add toast notifications for actions (suite created, run started, etc.)
- Test the full flow end-to-end: SDK → API → Database → Dashboard

### Week 3 Deliverable

By end of week 3:
- SDK `cencori.eval` namespace works and is tested
- LLM judge scoring is functional
- Dashboard is polished with proper loading/error/empty states
- Full demo-able flow from SDK to dashboard

---

## Important Notes

### How to Run the Project
- `pnpm install` to install dependencies
- `pnpm dev` to start the dev server
- The project uses Next.js 16 with App Router
- Tailwind CSS v4 for styling
- Supabase for database — you'll need access to run migrations

### Code Patterns to Follow
- Use `"use client"` directive for components with interactivity
- Use TanStack React Query (`useQuery`, `useMutation`) for data fetching
- Use `createServerClient` from `@/lib/supabaseServer` in API routes
- Check existing API routes for auth patterns — don't invent your own
- Use the existing `extractCencoriApiKeyFromHeaders` for API key auth on public endpoints

### What NOT to Do
- Don't modify existing gateway code — your eval runner should call it as a consumer
- Don't skip RLS policies — every table needs them
- Don't hardcode project IDs or API keys
- Don't build a custom component library — use shadcn/ui
- Don't worry about the Python SDK — TypeScript only for now

### Questions?

If you're stuck:
1. Read existing code that does something similar (search the codebase)
2. Check the API route patterns in `app/api/v1/` for auth and error handling
3. Look at existing dashboard pages for UI patterns
4. Ask if you've been stuck for more than 30 minutes — don't spin your wheels

---

## Evaluation Criteria

You'll be evaluated on:
1. **Does it work?** — Can I create a suite, run it, and see results?
2. **Code quality** — Clean, readable, follows existing patterns
3. **Database design** — Proper schema, indexes, RLS policies
4. **UI polish** — Loading states, error handling, empty states, consistent with rest of dashboard
5. **SDK design** — Clean API, good TypeScript types, follows existing namespace pattern
