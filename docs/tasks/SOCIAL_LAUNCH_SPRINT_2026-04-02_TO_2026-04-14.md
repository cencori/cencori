# Social Launch Sprint: April 2, 2026 to April 14, 2026

## Purpose

Turn the last 30 days of shipped work into a paced external launch campaign across X, LinkedIn, and supporting owned channels without dumping everything at once.

This sprint intentionally excludes:

- Auth
- Email lifecycle
- Onboarding reliability

Those are valuable product improvements, but they are not the strongest external launch hooks for the next two weeks.

## Sprint Window

- Start: `Thursday, April 2, 2026`
- End: `Tuesday, April 14, 2026`
- Cadence: one launch beat every 2 days
- Channels:
  - `X`
  - `LinkedIn`
  - `Changelog` support
  - optional founder reposts and personal amplification

## Launch Strategy

The goal is not to post “we shipped 20 things.”

The goal is to package the month into 7 externally legible stories:

1. A top-level “what shipped” reset
2. AI gateway + model expansion
3. Cencori Scan
4. Observability + anomaly intelligence
5. End-user billing + monetization controls
6. Edge + Vercel + custom provider integrations
7. Enterprise control plane + trust layer

This lets us:

- repeat the theme that Cencori is infrastructure for AI production
- avoid exhausting the audience with one giant changelog post
- give each feature family room to stand on its own
- reuse the same assets across channels with channel-specific framing

## Channel Rules

### X

- Prioritize crisp product statements, 1 proof point, 1 CTA.
- Use short threads only when the product needs context.
- Favor launch energy, screenshots, diagrams, and “what’s live now.”

### LinkedIn

- Lead with the customer problem, then explain what shipped.
- Use slightly more narrative framing and market context.
- Focus on why the feature matters for AI teams, infra leaders, and product teams.

### Owned Support

- Update the `Changelog` page and/or link to existing docs/blog posts where possible.
- Use one supporting landing page, doc page, or changelog URL per launch beat.
- Keep a consistent CTA path: docs, dashboard, or specific product page.

## Asset Package To Reuse Across The Sprint

- 1 master “what shipped” visual
- 1 AI gateway architecture or product card visual
- 1 Scan product workflow visual
- 1 observability screenshot set
- 1 billing / end-user controls screenshot
- 1 Vercel / edge integration screenshot or flow diagram
- 1 enterprise controls screenshot pack for audit logs, SSO, and governance

## Sprint Calendar

## Beat 1: Thursday, April 2, 2026

### Theme

March shipped a major platform surface area expansion.

### Core message

Cencori shipped a serious amount of product depth in the last 30 days across AI gateway, Scan, observability, billing, integrations, and enterprise controls.

### What to highlight

- GPT-5.3 Instant, GPT-5.4, GPT-5.4 Pro
- semantic caching and gateway hardening
- Scan maturity
- observability and anomaly intelligence
- end-user billing
- Vercel integration
- audit logs and enterprise controls

### Deliverables

- `X`: one summary thread with 5 to 7 bullets and one hero image
- `LinkedIn`: one “what we shipped in the last 30 days” narrative post
- `Owned`: publish or refresh the `Changelog` page with the same top-level buckets

### CTA

- “Explore what’s live at cencori.com/changelog”

### Success criteria

- establish the campaign umbrella
- create one URL that later posts can reference

## Beat 2: Saturday, April 4, 2026

### Theme

AI gateway expansion and reliability

### Core message

Cencori is becoming a stronger production gateway: more models, custom provider routing, semantic caching, and better behavior under infra failure.

### What to highlight

- custom provider endpoint routing
- GPT-5.3 Instant support
- GPT-5.4 and GPT-5.4 Pro availability
- semantic caching in chat
- fail-open reliability improvements for Redis and cache dependencies

### Deliverables

- `X`: product thread focused on “ship AI without brittle gateway edges”
- `LinkedIn`: explain why infra reliability matters more than raw model access
- `Owned`: point to gateway docs and model catalog docs

### Visuals

- gateway request flow diagram
- model catalog screenshot
- cache / reliability callout graphic

### CTA

- docs or dashboard project setup

## Beat 3: Monday, April 6, 2026

### Theme

Cencori Scan got materially better

### Core message

Scan is no longer just a basic scan output surface. It now supports repo-aware chat, continuity memory, AI quality review, more resilient investigations, and cleaner remediation actions.

### What to highlight

- repo-aware chat
- project brief and continuity memory
- enriched investigation stream
- stale-run recovery and live-stream resilience
- persistent Diff and Create PR actions
- manual guidance when AI fixes are unavailable

### Deliverables

- `X`: thread with before/after framing around scan reliability and fix UX
- `LinkedIn`: post about reducing the gap between “scan found issues” and “team can actually act on them”
- `Owned`: link to Scan page, launch post, or docs

### Visuals

- scan screen recording or screenshot carousel
- fix action panel screenshot
- investigation stream screenshot

### CTA

- “Try Scan on a repo”

## Beat 4: Wednesday, April 8, 2026

### Theme

Observability moved from charts to intelligence

### Core message

Cencori observability now spans unified traffic views, anomaly intelligence, event tracking, circuit breakers, geo visualization, and auditability.

### What to highlight

- unified HTTP traffic view across API and web
- intelligence panel and anomaly detection
- platform-wide event tracking
- configurable circuit breaker thresholds
- custom geo map
- organization-level audit logs and export/backfill

### Deliverables

- `X`: compact thread focused on “what teams actually need to debug AI systems in prod”
- `LinkedIn`: higher-level infra leadership post on why observability must include governance and anomaly detection
- `Owned`: route to observability page, audit logs docs, or product page

### Visuals

- observability dashboard screenshots
- anomaly panel close-up
- geo map image

### CTA

- “See how your AI traffic behaves in production”

## Beat 5: Friday, April 10, 2026

### Theme

Monetization and usage controls for AI products

### Core message

Cencori now helps teams do more than route AI traffic. It supports end-user billing, usage-based control planes, Stripe Connect invoicing, and budget visibility.

### What to highlight

- end-user usage billing
- gateway integration
- Stripe Connect
- invoicing support
- usage billing docs
- budget and cost-control landing sections

### Deliverables

- `X`: one monetization-focused post for builders shipping paid AI features
- `LinkedIn`: post framed around turning AI features into managed, billable product surfaces
- `Owned`: direct to billing docs or relevant dashboard screenshots

### Visuals

- end-user billing UI screenshots
- Stripe / invoicing workflow image
- budget control page visual

### CTA

- “Launch billable AI features with usage control built in”

## Beat 6: Sunday, April 12, 2026

### Theme

Integrations: Vercel native flow, edge, and custom providers

### Core message

Cencori is becoming easier to plug into real-world stacks, especially for Vercel and custom AI provider setups.

### What to highlight

- Vercel native integration flow
- edge integration hardening
- webhook provisioning and ownership fixes
- custom provider support
- public integration contract cleanup

### Deliverables

- `X`: integration-focused thread with a setup screenshot and one key workflow diagram
- `LinkedIn`: explain why integration polish is essential for adoption, not just “nice to have”
- `Owned`: point to Vercel integration docs or integration pages

### Visuals

- Vercel integration flow screenshot
- custom provider configuration panel
- simple flow diagram

### CTA

- “Connect your stack without rebuilding your AI control plane”

## Beat 7: Tuesday, April 14, 2026

### Theme

Enterprise control plane and trust close-out

### Core message

Across the last 30 days, Cencori shipped not just features, but more of the control plane enterprises need: SSO/SAML, audit logs, model mappings, export surfaces, and project-level safety controls.

### What to highlight

- SSO/SAML
- audit log export
- organization-level audit logs
- model mappings
- configurable circuit breaker thresholds
- security false-positive reduction
- usage export

### Deliverables

- `X`: close-out post that reframes the month as “what makes AI systems production-ready”
- `LinkedIn`: strong enterprise credibility post aimed at technical buyers and platform leaders
- `Owned`: route to enterprise-facing docs or platform page

### Visuals

- enterprise settings screenshots
- audit log screenshot
- model mapping or governance screenshot

### CTA

- “If you’re building AI for production, this is the layer we’re building”

## Daily Execution Template

For each launch beat, the team should execute the same mini-checklist:

1. Finalize the one-sentence message
2. Pick the one supporting screenshot or visual
3. Draft the X version
4. Draft the LinkedIn version
5. Choose the destination URL
6. Prepare founder/team repost copy
7. Publish
8. Capture performance after 24 hours
9. Feed learnings into the next beat

## Recommended Owners

- Product narrative: founder / product lead
- Screenshot capture and visual cleanup: design or product marketing
- Post drafting: marketing / founder / content lead
- Publishing and scheduling: social or operations owner
- Comment/reply management: founder + one operator

## Success Metrics

Track per launch beat:

- impressions by channel
- engagement rate by channel
- clicks to docs / shipped / product pages
- signups or project creations if trackable
- reposts from team members
- which feature themes earned the strongest response

At the end of the sprint, answer:

- which story resonated most: gateway, Scan, observability, billing, integrations, or enterprise controls
- which channel worked better for which theme
- which assets should be reused in future launches

## Post-Launch Follow-Through

After April 14, 2026:

- turn the strongest beat into a longer-form blog or customer story
- turn the strongest visual carousel into a permanent `Shipped` page section
- reuse the best-performing theme in founder outbound, demos, and sales collateral
- convert the sprint into a repeatable monthly launch operating rhythm

## Notes

- This sprint is intentionally external-facing.
- Internal admin/email/auth wins are excluded to keep the launch story focused.
- If bandwidth gets tight, keep all 7 beats but reduce each to one strong X post plus one LinkedIn post rather than trying to over-produce assets.
