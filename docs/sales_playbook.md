# CENCORI
## Sales Onboarding & Enablement Playbook

**Version 2.0**  
**Last Updated:** January 2026  
**Classification:** Internal Use Only

---

# Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Company Overview](#2-company-overview)
3. [The Platform](#3-the-platform)
4. [AI Gateway Deep Dive](#4-ai-gateway-deep-dive)
5. [Ideal Customer Profile](#5-ideal-customer-profile)
6. [Pricing & Packaging](#6-pricing--packaging)
7. [Competitive Landscape](#7-competitive-landscape)
8. [Objection Handling](#8-objection-handling)
9. [Sales Process](#9-sales-process)
10. [Discovery Framework](#10-discovery-framework)
11. [Demo Playbook](#11-demo-playbook)
12. [Email Templates](#12-email-templates)
13. [Resources & Links](#13-resources--links)

---

# 1. Executive Summary

## What Is Cencori?

Cencori is **the infrastructure for AI production**. We provide a complete platform for shipping AI — from gateway to compute to workflows — so teams can focus on building products, not infrastructure.

## The Platform Vision

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                               CENCORI                                   │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────────┤
│  AI Gateway │   Compute   │  Workflows  │ Integration │   Data Storage  │
│  (Live Now) │  (Coming)   │  (Coming)   │   (Coming)  │    (Coming)     │
├─────────────┴─────────────┴─────────────┴─────────────┴─────────────────┤
│                     Security • Observability • Scale                    │
└─────────────────────────────────────────────────────────────────────────┘
```

**Today:** AI Gateway is live — multi-provider routing, security, compliance, cost control.

**Tomorrow:** Compute, Workflows, Integration, and Data Storage will complete the platform.

## The One-Liner

> "Cencori is the infrastructure for AI production — everything you need to ship AI, starting with the gateway."

## Why It Matters

Companies building with AI face a growing set of challenges:

| Challenge | Reality |
|-----------|---------|
| **Infrastructure fragmentation** | Different tools for gateway, compute, workflows, observability |
| **Security gaps** | Prompt injection, PII leaks, unsafe content — no unified solution |
| **Compliance burden** | SOC 2, GDPR, HIPAA requirements scattered across tools |
| **Provider lock-in** | Tied to one AI provider with no easy way to switch |
| **Cost blindness** | No visibility into AI spend until the bill arrives |
| **Scaling pain** | What works in prototype breaks in production |

Cencori solves these by providing one platform that handles infrastructure so you can focus on your product.

## The Business Case

| Problem | Without Cencori | With Cencori |
|---------|-----------------|--------------|
| Security implementation | 3-6 months engineering | 10 minutes (AI Gateway) |
| Compliance readiness | 6-12 months + auditor costs | Built-in, audit-ready logs |
| Provider switching | Weeks of refactoring | One parameter change |
| Cost tracking | Monthly surprise bills | Real-time dashboards |
| Infrastructure management | Multiple vendors, integrations | One platform |

---

# 2. Company Overview

## About FohnAI

Cencori is built by **FohnAI**, an AI research and development company focused on making AI systems safer and more reliable for production use.

**Mission Statement:**  
*Be the foundation layer for every AI application — handling security, observability, and scale so developers can ship AI with confidence.*

**Company Values:**
- Security first, always
- Developer experience matters
- Transparency in pricing and data handling
- Ship fast, but ship right
- Build for the long term

## What We're Building

Cencori is not just a point solution — it's a platform. We're building the full stack for AI production:

| Product | Status | What It Does |
|---------|--------|--------------|
| **AI Gateway** | ✅ Live | Multi-provider routing, security, observability, cost control |
| **Cencori Scan** | ✅ Live | Security scanner for AI apps. CLI + Web Dashboard. Auto-fix with AI. |
| **Compute** | 🔜 Coming | Serverless functions, GPU access, edge deployment |
| **Workflows** | 🔜 Coming | Visual AI pipeline builder, orchestration, human-in-loop |
| **Integration** | 🔜 Coming | SDKs, agent frameworks, platform connectors |
| **Data Storage** | 🔜 Coming | Vector database, knowledge base, RAG infrastructure |

## Leadership

*[Add leadership bios here]*

## Funding & Stage

*[Add funding details here]*

---

# 3. The Platform

## Platform Philosophy

We believe AI infrastructure should work like modern web infrastructure:

| Web Infrastructure | AI Infrastructure (Cencori) |
|--------------------|----------------------------|
| Vercel handles deployment | Cencori handles AI gateway |
| Supabase handles database | Cencori handles AI data storage |
| Temporal handles workflows | Cencori handles AI workflows |

Instead of stitching together point solutions, developers get one platform purpose-built for AI.

## The Stack

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           YOUR APPLICATION                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           CENCORI PLATFORM                              │
│                                                                         │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────────────────┐ │
│  │ AI Gateway│  │  Compute  │  │ Workflows │  │  Integration + Data   │ │
│  │           │  │           │  │           │  │                       │ │
│  │ • Routing │  │ • GPU     │  │ • Chains  │  │ • SDKs                │ │
│  │ • Security│  │ • Edge    │  │ • Agents  │  │ • Vector DB           │ │
│  │ • Logging │  │ • Scale   │  │ • HITL    │  │ • RAG                 │ │
│  └───────────┘  └───────────┘  └───────────┘  └───────────────────────┘ │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │           Unified: Security • Observability • Billing               ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│           AI PROVIDERS: OpenAI • Anthropic • Google • etc.              │
└─────────────────────────────────────────────────────────────────────────┘
```

## Selling the Platform

When positioning Cencori, lead with the platform vision:

**For Executives:**
"Cencori is the infrastructure layer for AI — like Vercel for AI applications. You integrate once and get everything: gateway, compute, workflows, and data — with security and compliance built in."

**For Technical Buyers:**
"We're building the full stack so you don't have to. AI Gateway is live today. Compute and Workflows are coming. One SDK, one dashboard, one bill."

**For Developers:**
"It's everything you need to ship AI to production. Start with the gateway, grow into the platform."

---

# 4. AI Gateway Deep Dive

## What Is AI Gateway?

AI Gateway is the **first product** in the Cencori platform. It's a secure proxy layer between your application and AI providers.

```text
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Your App      │────▶│  AI Gateway     │────▶│  AI Provider    │
│                 │     │                 │     │ (OpenAI, etc.)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              │
                              ▼
                        ┌─────────────────┐
                        │  Security       │
                        │  Logging        │
                        │  Analytics      │
                        └─────────────────┘
```

**Integration is simple:** Replace your AI provider's endpoint with Cencori's. Your existing code stays the same.

```javascript
// Before (direct OpenAI)
const openai = new OpenAI({ apiKey: 'sk-...' });

// After (with Cencori)
const openai = new OpenAI({ 
  apiKey: 'cen_...', 
  baseUrl: 'https://api.cencori.com/v1' 
});
```

## Core Capabilities

### 1. Multi-Provider Routing

**What it does:** One API that routes to OpenAI, Anthropic, or Google based on the model you specify.

**Key benefit:** Switch providers with a single parameter. No code refactoring required.

**Supported Models:**

| Provider | Models Available |
|----------|------------------|
| OpenAI | GPT-4o, GPT-4 Turbo, GPT-4, GPT-3.5 Turbo, o1, o3 |
| Anthropic | Claude 3 Opus, Sonnet, Haiku, Claude 4 |
| Google | Gemini 2.5 Flash, Gemini 2.0, Gemini Pro |
| xAI | Grok 4 |
| Mistral | Large 3, Medium, Small |
| DeepSeek | V3.2 |

**Coming Soon:** Cohere, Perplexity, Meta Llama via Together.ai

### 2. Security Suite

**PII Detection & Redaction**
- Automatically detects and optionally redacts personally identifiable information
- Supports: emails, phone numbers, SSNs, credit cards, addresses, names
- Configurable: block, redact, or log-only modes

**Prompt Injection Defense**
- ML-based detection of injection attempts
- Pattern matching for known attack vectors
- Risk scoring for every request (0-100)
- Configurable thresholds and blocking rules

**Content Safety**
- Filters harmful, illegal, or unsafe content
- Customizable policies per project
- Works on both inputs and outputs

### 3. Compliance & Audit Logs

**What we log:**
- Full request/response payloads (encrypted)
- Timestamps, latency, token counts
- Model used, cost calculated
- Safety scores and flags
- User/session identifiers (if provided)

**Retention:**
- Default: 90 days
- Enterprise: Customizable (30 days to indefinite)

**Compliance Standards:**
- SOC 2 Type II (Expected Q2 2026)
- GDPR compliant
- HIPAA ready (Enterprise tier)

### 4. Cost Management

**Real-time tracking:**
- See costs as they happen, not end of month
- Breakdown by project, model, user, or feature
- Daily/weekly/monthly views

**Budgets & Alerts:**
- Set spending limits per project
- Email alerts at 50%, 80%, 100% of budget
- Hard caps available (requests blocked at limit)

### 5. Analytics & Observability

**Dashboard includes:**
- Request volume trends
- Latency percentiles (p50, p95, p99)
- Error rates and types
- Model usage distribution
- Security event timeline

**API Access:**
- All metrics available via API
- Export to your observability stack
- Webhooks for real-time events

---

# 5. Ideal Customer Profile

## Primary Target Market

### Company Characteristics

| Attribute | Ideal | Good Fit | Not a Fit |
|-----------|-------|----------|-----------|
| **Size** | 20-200 employees | 10-500 employees | < 10 or 5000+ |
| **Stage** | Series A - C | Seed to Series D | Pre-revenue or public |
| **Revenue** | $2M - $50M ARR | $500K - $100M ARR | < $100K ARR |
| **AI Maturity** | Using AI in production | Planning AI features | No AI plans |
| **Tech Stack** | Modern (Node, Python, React) | Mix of modern/legacy | Mainframe, COBOL |

### Industry Verticals (Priority Order)

1. **Fintech & Financial Services**
   - Why: Highest compliance requirements, PII sensitivity
   - Pain: Regulatory audits, data handling concerns
   - Example use cases: AI customer support, fraud detection, document processing

2. **Healthcare & Life Sciences**
   - Why: HIPAA requirements, sensitive data
   - Pain: PHI exposure risk, compliance burden
   - Example use cases: Patient communication, clinical documentation, diagnostics

3. **SaaS / Developer Tools**
   - Why: Tech-savvy buyers, fast decision cycles
   - Pain: Multi-tenant isolation, cost attribution
   - Example use cases: AI features in product, developer productivity

4. **Legal & Professional Services**
   - Why: Confidentiality requirements, audit trails
   - Pain: Privileged information exposure
   - Example use cases: Contract analysis, research, document drafting

5. **AI-Native Startups**
   - Why: Building AI-first products, need infrastructure
   - Pain: Don't want to build undifferentiated infrastructure
   - Example use cases: AI agents, chatbots, content generation

## Buyer Personas

### Primary Decision Maker: CTO / VP Engineering

**Profile:**
- Reports to CEO
- Owns technical architecture decisions
- Budget authority for infrastructure tools

**Key Motivations:**
- Reduce security risk and liability
- Avoid building undifferentiated infrastructure
- Ship AI features faster

**Pain Points:**
- "We don't have 6 months to build AI infrastructure"
- "I need one platform, not five point solutions"
- "I can't justify the engineering time for this"

**What They Care About:**
- Platform vision and roadmap
- Enterprise-grade security
- Reliable uptime and support

### Secondary Decision Maker: Engineering Lead / Staff Engineer

**Profile:**
- Reports to CTO/VPE
- Implements and maintains integrations
- Evaluates technical fit

**Key Motivations:**
- Clean, simple API
- Good documentation
- Minimal maintenance burden

**Pain Points:**
- "I don't want to maintain another internal tool"
- "Switching AI providers means weeks of work"
- "We have no visibility into what's happening in production"

**What They Care About:**
- Developer experience
- Clear documentation
- Responsive support

### Influencer: Security / Compliance Lead

**Profile:**
- Reports to CTO or CEO
- Owns security posture and compliance
- Drives vendor security reviews

**Key Motivations:**
- Check compliance boxes efficiently
- Reduce attack surface
- Demonstrate due diligence

**Pain Points:**
- "Our AI integration has no audit trail"
- "We found a prompt injection vulnerability in production"
- "We're manually reviewing AI outputs for PII"

**What They Care About:**
- SOC 2 certification status
- Data handling practices
- Security feature depth

## Buying Signals

**Strong signals (reach out immediately):**
- Posted a job for "AI Security Engineer" or "AI Platform Engineer"
- Had a public AI-related security incident
- Announced SOC 2 or HIPAA compliance initiative
- Recently raised Series A+ funding
- Mentioned AI infrastructure challenges in earnings call or interview

**Medium signals (add to outreach sequence):**
- Using OpenAI or Anthropic API (check job posts, GitHub)
- Building in regulated industry
- Growing engineering team rapidly
- Recently hired a CISO or compliance lead

**Weak signals (nurture):**
- General interest in AI/ML
- Using AI but only internal/experimental
- Early stage (pre-seed, seed)

---

# 6. Pricing & Packaging

## Pricing Philosophy

1. **Transparent**: No hidden fees, no surprises
2. **Scalable**: Start free, grow with usage
3. **Value-based**: Price reflects infrastructure you don't have to build

## Tier Comparison

| Feature | Free | Pro | Team | Enterprise |
|---------|------|-----|------|------------|
| **Price** | $0 | $49/mo | $149/mo | Custom |
| **Requests/month** | 1,000 | 50,000 | 250,000 | Unlimited |
| **Projects** | 1 | Unlimited | Unlimited | Unlimited |
| **Team Members** | 1 | 3 | 10 | Unlimited |
| **AI Gateway** | ✅ | ✅ | ✅ | ✅ |
| **Security Features** | Basic | All | All | All + Custom |
| **Support** | Community | Email (24hr) | Priority (4hr) | Dedicated |
| **Log Retention** | 30 days | 60 days | 90 days | Custom |
| **API Access** | No | Yes | Yes | Yes |
| **Webhooks** | No | Yes | Yes | Yes |
| **SSO/SAML** | No | No | No | Yes |
| **SLA** | No | No | No | Yes (99.9%+) |

## Understanding the Cost Model

**Customers pay two things:**

1. **Cencori Subscription**: Fixed monthly fee based on tier
2. **AI Usage**: Pass-through cost from providers + 10-20% markup

**Example calculation (Pro tier, 30K requests/month):**
- Cencori subscription: $49
- Average request cost: $0.002 (GPT-4o mini average)
- AI usage: 30,000 × $0.002 = $60
- Cencori markup (15%): $9
- **Total monthly cost: $49 + $60 + $9 = $118**

**Why markup on AI usage?**
- We handle all provider billing (consolidated invoice)
- We provide security scanning on every request
- We maintain the infrastructure and routing
- You're paying for infrastructure, not just pass-through

## Discount Guidelines

| Scenario | Discount Available |
|----------|-------------------|
| Annual commitment | 17% (2 months free) |
| Startup (< $2M raised) | Up to 50% first year |
| Non-profit / Education | Up to 50% |
| Multi-year contract | Negotiate with leadership |
| Competitive displacement | Case-by-case |

---

# 7. Competitive Landscape

## Market Positioning

Cencori competes in multiple categories because we're building a platform:

| Category | Competitors | How We Win |
|----------|-------------|------------|
| AI Gateway | Portkey, Helicone, LiteLLM | Security-first, platform vision |
| AI Observability | LangSmith, Braintrust | Gateway + future platform |
| AI Infrastructure | Build in-house | Time to value, breadth |

## Competitive Overview

### Direct Competitors

| Competitor | Focus Area | Strengths | Weaknesses |
|------------|------------|-----------|------------|
| **Portkey** | AI Gateway | Multi-provider, good docs | No platform vision, limited security |
| **Helicone** | Observability | Great logging UI, open source | No security features, no gateway |
| **LangSmith** | LangChain Ecosystem | Deep LangChain integration | Framework lock-in, narrow focus |
| **LiteLLM** | Open Source Gateway | Free, self-host | No managed service, no security |

### Indirect Competitors

| Competitor | Why They Come Up | Our Response |
|------------|------------------|--------------|
| **Build In-house** | "We can build this ourselves" | See objection handling |
| **Direct API** | "We'll just use OpenAI directly" | No security, compliance, or multi-provider |
| **Cloud Provider AI** | "We use AWS Bedrock / Azure OpenAI" | Single provider, limited security, no platform |

## Competitive Battle Cards

### vs. Portkey

**Their pitch:** "AI Gateway for production"

**Where they win:**
- Good multi-provider support
- Solid documentation
- Lower price point for basic use

**Where we win:**
- Deeper security features (PII, prompt injection)
- Compliance focus (audit logs, SOC 2 path)
- Platform vision (Compute, Workflows coming)
- Better positioned for regulated industries

**Landmine question:**
"What's your plan for meeting SOC 2 requirements for your AI features?"

**If they mention Portkey:**
"Portkey is a solid gateway product. The main differences are our security depth and our platform vision. We built Cencori for companies that need compliance-ready infrastructure today, and a full AI platform tomorrow. If you're in a regulated industry or expect to scale beyond just a gateway, we're a better long-term fit."

---

### vs. Helicone

**Their pitch:** "Open-source observability for LLMs"

**Where they win:**
- Open source (self-host option)
- Lower cost for pure logging use case
- Good developer community

**Where we win:**
- Security features (PII, prompt injection)
- Gateway functionality (routing, failover)
- Platform vision
- Managed service with SLA

**Landmine question:**
"How are you planning to handle PII detection and prompt injection protection?"

**If they mention Helicone:**
"Helicone is great for observability. We actually complement it — we focus on gateway and security, they focus on debugging and analytics. That said, if you need security and routing, you'll need something like Cencori regardless. And as our platform grows, observability is built in."

---

### vs. Building In-House

**Their pitch:** "We have engineers, we can build it"

**Where they win:**
- Full control
- No vendor dependency
- No per-request costs

**Where we win:**
- 3-6 months faster to production
- Continuous security updates
- No maintenance burden
- Platform grows with you

**Response framework:**

"You absolutely could build this. The question is whether you should. Let me break down what's involved:

**Just for the gateway:**
1. **Security layer**: PII detection, prompt injection defense, content filtering. 2-3 months, requires ML expertise.
2. **Audit logging**: SOC 2 compliant logging with encryption, retention, export. 1-2 months.
3. **Multi-provider routing**: Different SDKs, rate limits, error handling, failover. 1-2 months.
4. **Cost tracking**: Token counting, pricing, dashboards, alerts. 1 month.
5. **Ongoing maintenance**: Security patches, new attacks, API changes. Continuous.

**Total: 6-9 months, $300K+ in engineering cost.**

And that's just the gateway. When you need compute, workflows, or data storage, you build again.

Cencori gives you all of this in 10 minutes. And as our platform grows, you get Compute, Workflows, and more — without building."

---

# 8. Objection Handling

## Price Objections

### "It's too expensive"

**Response:**
"I understand. Let me break down the value:

- **Engineering time saved**: Building just the gateway in-house takes 3-6 months. At $150K/engineer fully loaded, that's $75K-$150K in salary alone.

- **Infrastructure you don't build**: We're not just a gateway. As our platform grows, you get Compute, Workflows, Data Storage — all without building.

- **Risk mitigation**: A single AI security incident can cost millions. We're insurance against that.

At $49-149/month, you're getting infrastructure that would cost you $300K+ to build.

What specific budget constraints are you working with?"

### "Can you do a discount?"

**Response:**
"We want to make this work. A few options:

1. **Annual commitment**: 17% off (2 months free)
2. **Startup program**: If you've raised less than $2M, 50% off first year
3. **Pilot pricing**: Short-term pilot at reduced cost to prove value

Which might work for your situation?"

---

## Technical Objections

### "What about latency?"

**Response:**
"Our overhead is typically 10-50ms for security checks.

Context: The AI model response itself takes 1-5 seconds. So we add less than 1-3% to total latency.

Our servers run on Vercel's edge network across 20+ regions, routing from the nearest location.

Want to run a quick latency test? I can set you up with a free tier instantly."

### "We're worried about vendor lock-in"

**Response:**
"That's actually one of our key value propositions. Cencori *reduces* lock-in:

1. **Provider independence**: Switch from OpenAI to Anthropic with one parameter change.

2. **Standard API**: We follow OpenAI's API structure, which is the industry standard. If you leave Cencori, your code works directly with providers.

3. **Data portability**: Export all logs and data anytime.

4. **No long-term contracts**: Monthly terms. Leave anytime.

The irony is using OpenAI directly creates *more* lock-in than using Cencori."

### "How do we know it's secure?"

**Response:**
"We take security seriously:

1. **Encryption**: TLS 1.3 in transit, AES-256 at rest
2. **SOC 2**: Type II certification in progress (expected Q2 2026)
3. **No training**: We never use your data to train models
4. **No sharing**: We don't share your data with third parties
5. **Infrastructure**: Built on SOC 2 compliant providers (Supabase, Vercel)

Happy to complete your security questionnaire or do a call with your security team."

---

## Strategic Objections

### "You're just a gateway — we need more"

**Response:**
"You're right that we lead with the gateway today. But Cencori is a platform:

- **Today**: AI Gateway with security, compliance, cost control
- **Coming**: Compute (serverless, GPU), Workflows (orchestration, agents), Data Storage (vector DB, RAG)

We're building the full stack for AI production. You start with the gateway, and as we ship more, you get access to the full platform with the same integration.

Would you like to see the roadmap?"

### "We need to talk to more stakeholders"

**Response:**
"Absolutely. Who else needs to be involved?

I can prepare materials for each stakeholder:
- **Security**: Our security whitepaper and SOC 2 roadmap
- **Finance**: ROI calculator and cost comparison
- **Engineering**: Technical docs and integration guide

Would it help if I sent those before the next conversation?"

### "We're not ready yet"

**Response:**
"Totally understand. When you say 'not ready,' is that:

a) You haven't started building AI features yet?
b) You have AI in production but infrastructure isn't a priority?
c) Bad timing — you're in the middle of something else?

*[Listen, then:]*

Many customers start with our free tier to get familiar before their AI initiative kicks into high gear. Would that be useful?"

---

# 9. Sales Process

## Sales Stages

| Stage | Definition | Exit Criteria |
|-------|------------|---------------|
| **Lead** | Inbound inquiry or outbound contact | Qualified as potential fit |
| **Discovery** | Initial call completed | Understand needs, timeline, budget |
| **Demo** | Product demonstrated | Technical fit confirmed |
| **Evaluation** | Trial or POC | Value proven in their environment |
| **Proposal** | Formal proposal sent | Pricing and terms discussed |
| **Negotiation** | Terms being finalized | Agreement on price and scope |
| **Closed Won** | Contract signed | 🎉 |
| **Closed Lost** | Deal not happening | Reason documented |

## Average Sales Cycle

| Segment | Typical Cycle |
|---------|---------------|
| Self-serve (Free → Pro) | Same day |
| SMB (Pro → Team) | 1-2 weeks |
| Mid-market (Team) | 2-4 weeks |
| Enterprise | 4-12 weeks |

## Key Metrics

- **Discovery to Demo**: Target 70%+
- **Demo to Trial**: Target 50%+
- **Trial to Close**: Target 60%+

---

# 10. Discovery Framework

## Pre-Call Research

1. **Company**: What do they do? Recent news? Funding?
2. **Person**: Role, tenure, LinkedIn background
3. **Tech Stack**: Check job posts, GitHub, case studies
4. **AI Usage**: Any public mention of AI features?

## Discovery Call Structure (30 minutes)

### Opening (2 min)
"Thanks for making time. I've done some research on [Company] and I'm excited to learn more. My goal is to understand your situation and see if Cencori is a fit. If it's not, I'll tell you honestly. Sound good?"

### Situation Questions (5 min)

1. "Tell me about your AI implementation. What models are you using and for what?"

2. "How are you integrating with AI providers today — direct API, framework, or something else?"

3. "How many requests per month? Growth trajectory?"

### Infrastructure Questions (8 min)

4. "Walk me through your current AI infrastructure stack. What tools are you using for gateway, observability, security?"

5. "What would happen if OpenAI had an outage? Do you have failover?"

6. "How are you handling security — PII detection, prompt injection protection?"

7. "Are you subject to compliance requirements — SOC 2, HIPAA, GDPR?"

8. "How do you track AI costs? Visibility into spend by customer or feature?"

### Platform Questions (5 min)

9. "Beyond the gateway, what else are you building? Agents, workflows, RAG?"

10. "How much engineering time is going into AI infrastructure vs. product features?"

### Impact Questions (5 min)

11. "If you could wave a magic wand and fix one thing about your AI infrastructure, what would it be?"

12. "What's the cost of *not* solving this? Projects blocked, risks you're carrying?"

### Timeline & Next Steps (5 min)

13. "What's your timeline for addressing this?"

14. "Who else would be involved in a decision?"

15. "What would you need to see to feel confident moving forward?"

**Close:**
"Based on what you've shared, I think there's a strong fit. Would you be open to a demo where I show you exactly how Cencori works?"

---

# 11. Demo Playbook

## Demo Preparation

1. Create a custom demo project with prospect's company name
2. Prepare example prompts relevant to their use case
3. Load sample data that mirrors their scenarios
4. Test your environment

## Demo Structure (25 minutes)

### 1. Set the Stage (3 min)

"[Name], last time we talked you mentioned [key pain point]. Today I'll show you how Cencori addresses that.

But first, let me set context: Cencori is the infrastructure for AI production. AI Gateway is live today, and we're building Compute, Workflows, and Data Storage to complete the platform. Today I'll focus on the gateway — that's where most customers start.

I'll cover:
1. How integration works
2. Security in action
3. Cost visibility

Then we'll leave time for questions."

### 2. Integration Demo (5 min)

Show the code change:
```javascript
// Before
const openai = new OpenAI({ apiKey: 'sk-...' });

// After  
const openai = new OpenAI({ 
  apiKey: 'cen_...', 
  baseUrl: 'https://api.cencori.com/v1' 
});
```

Key points:
- "This is the entire integration. Your existing code stays the same."
- "Switch models by changing one parameter."
- "Works with any OpenAI-compatible library."

Make a live request and show it succeed.

### 3. Security Demo (7 min)

**PII Detection:**
Send a prompt containing a fake email/phone:
- Show it being flagged in the dashboard
- Show the safety score
- Explain blocking vs. logging modes

**Prompt Injection:**
Send a known injection pattern:
- Show detection
- Show risk score
- Explain configurable thresholds

Key point:
"This happens on every request, automatically. No engineering work required."

### 4. Cost & Analytics Demo (5 min)

Show the dashboard:
- Real-time cost tracking
- Model usage breakdown
- Request trends

Key points:
- "Never be surprised by an AI bill again."
- "See exactly which features or customers drive costs."
- "Budget alerts before you exceed limits."

### 5. Platform Vision (2 min)

"What I've shown you is AI Gateway — our first product. Coming soon:

- **Compute**: Serverless functions, GPU access
- **Workflows**: Pipeline builder, agent orchestration
- **Data Storage**: Vector database, RAG

You start with the gateway. As we ship more, you get access to the full platform."

### 6. Q&A & Next Steps (3 min)

"What questions do you have?"

*[Answer questions]*

"Based on what you've seen, does this solve the problems we discussed?"

*[If yes]:* "Great. Next step is a trial in your environment. I can set you up on free tier today — takes 10 minutes. Would you have time tomorrow for a quick implementation call?"

---

# 12. Email Templates

## Initial Outreach (Cold)

**Subject:** [Company]'s AI infrastructure

Hi [Name],

I noticed [Company] is building with [AI use case — from job post or public info]. As you scale AI in production, I'm curious what your infrastructure stack looks like — gateway, security, observability.

Most teams I talk to either:
a) Are stitching together point solutions (gateway here, logging there, security somewhere else)
b) Building infrastructure in-house (expensive and slow)
c) Looking for something better

If you're in (a) or (b), Cencori might be worth a look. We're the infrastructure for AI production — starting with a gateway that handles security and compliance, with compute and workflows coming.

Worth a 15-minute call?

[Your name]

---

## Follow-up After Discovery

**Subject:** Cencori next steps — [Company]

Hi [Name],

Great talking today. To recap:

**What we heard:**
- [Pain point 1]
- [Pain point 2]
- [Timeline/urgency]

**What we can do:**
- [How Cencori solves pain point 1]
- [How Cencori solves pain point 2]
- [Platform vision if relevant]

**Next step:**
I'll send a calendar invite for a demo on [date]. I'll prepare examples specific to [their use case].

Resources:
- [Link to docs]
- [Link to case study if available]

[Your name]

---

## After Demo

**Subject:** Next steps with Cencori

Hi [Name],

Thanks for the demo today. Great questions from the team.

**Key takeaways:**
- [Takeaway 1]
- [Takeaway 2]

**Next step:** 
[Trial setup / Proposal / Security review — whatever was agreed]

I'll [action you're taking] by [date].

Questions? Just reply.

[Your name]

---

## Proposal Follow-up

**Subject:** Following up on Cencori proposal

Hi [Name],

Following up on the proposal I sent last week. Have you had a chance to review?

Happy to jump on a call to walk through questions or discuss terms.

[Your name]

---

# 13. Resources & Links

## Public Resources

| Resource | URL |
|----------|-----|
| Website | https://cencori.com |
| Documentation | https://cencori.com/docs |
| Pricing | https://cencori.com/pricing |
| Contact | https://cencori.com/contact |
| Quick Start | https://cencori.com/docs/quick-start |
| API Reference | https://cencori.com/docs/api |

## Internal Resources

| Resource | Location |
|----------|----------|
| Sales Deck | *[Add link]* |
| Security Whitepaper | *[Add link]* |
| ROI Calculator | *[Add link]* |
| Competitive Intel | *[Add link]* |
| Customer References | *[Add link]* |

## Support Contacts

| Need | Contact |
|------|---------|
| Technical Questions | support@cencori.com |
| Deal Support | *[Add sales lead email]* |
| Security/Compliance | *[Add security contact]* |

---

# Appendix: Quick Reference Card

## The Pitch (30 seconds)

"Cencori is the infrastructure for AI production. We're building the full stack — gateway, compute, workflows — so you can focus on your product instead of infrastructure.

AI Gateway is live today: one API for every provider, with security, compliance, and cost tracking built in.

You integrate once. As we ship more, you get access to the full platform."

## Key Numbers

- **10 minutes**: Average integration time
- **10-50ms**: Added latency
- **3-6 months**: Engineering time saved vs. build
- **$0**: Starting price (free tier)
- **15+**: AI providers supported

## Top 3 Differentiators

1. **Platform, not point solution** — Gateway today, Compute and Workflows coming
2. **Security-first** — PII detection, prompt injection defense built in
3. **Compliance-ready** — Audit logs, SOC 2 path, enterprise grade

---

*End of Sales Playbook*

*Version 2.0 — January 2026*

*For questions or updates, contact: [Sales Lead]*
