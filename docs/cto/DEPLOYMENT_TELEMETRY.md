# Deep Dive: Production Deployment & Telemetry

This document outlines Cencori's physical deployment strategy, edge routing configurations, and internal telemetry architectures.

## 1. Edge Routing & Subdomains

Cencori relies heavily on Vercel's Edge Network for global routing. The core logic for routing traffic to specific application segments (Marketing vs API vs Web App) happens at the Vercel level via `vercel.json` rewrites, rather than complex Next.js middleware.

### `api.cencori.com` Routing
To provide an OpenAI-compatible API interface without requiring developers to change their integration paths, `vercel.json` explicitly rewrites standard OpenAI routes:
- `/v1/chat/completions` → `/api/ai/chat`
- `/v1/models` → `/api/v1/models`

This allows Cencori to act as a drop-in proxy replacement for any standard OpenAI SDK client (Python, Node, Go) simply by overriding the `baseURL`.

### Subdomain Segmentation
Vercel rewrites also map Host headers to specific Next.js Route Groups.
- `design.cencori.com` → `/design`
- `pitch.cencori.com` → `/pitch`
- `scan.cencori.com` → `/scan`

This keeps the Monorepo structure clean (`app/(marketing)`, `app/(dashboard)`) while appearing as fully segmented properties to the end user.

## 2. Security Headers (`next.config.ts`)

Next.js automatically injects rigorous security headers on `/:path*`:
```typescript
{ key: "X-Content-Type-Options", value: "nosniff" },
{ key: "X-Frame-Options", value: "DENY" },
{ key: "X-XSS-Protection", value: "1; mode=block" },
{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
```
Additionally, `Cache-Control` is aggressively set to `public, max-age=31536000, immutable` for static assets and `/og-image.(jpg|png)` to maximize CDN hit ratios and reduce edge compute costs.

## 3. Telemetry Systems

Cencori operates telemetry in a privacy-first manner, particularly concerning the `Cencori Scan` CLI tool.

- **Storage Constraint**: Telemetry data never includes PII, intellectual property, or code snippets. 
- **Payload (`packages/scan/src/telemetry.ts`)**: It logs purely structural metadata:
  - `filesScanned`, `issuesFound`, `scanDuration`.
  - Aggregated enumerations (`secrets: 3, pii: 0`).
  - The security `score` (e.g., A, B, C).
- **Graceful Failure**: The `sendTelemetry()` function wraps the `fetch` call in a `.catch()` block that silently ignores network errors. Telemetry is a background non-blocking task that will never crash the core application or the CLI scanner.
