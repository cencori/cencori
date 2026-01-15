# CENCORI
## Sales Onboarding & Enablement Playbook

**Version 1.0**  
**Last Updated:** December 2025  
**Classification:** Internal Use Only

---

# Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Company Overview](#2-company-overview)
3. [Product Deep Dive](#3-product-deep-dive)
4. [Ideal Customer Profile](#4-ideal-customer-profile)
5. [Pricing & Packaging](#5-pricing--packaging)
6. [Competitive Landscape](#6-competitive-landscape)
7. [Objection Handling](#7-objection-handling)
8. [Sales Process](#8-sales-process)
9. [Discovery Framework](#9-discovery-framework)
10. [Demo Playbook](#10-demo-playbook)
11. [Email Templates](#11-email-templates)
12. [Resources & Links](#12-resources--links)

---

# 1. Executive Summary

## What Is Cencori?

Cencori is **the infrastructure for AI production**. We provide a unified API that connects to every major AI provider (OpenAI, Anthropic, Google) while automatically handling security, compliance, and cost tracking.

## The One-Liner

> "Cencori is the infrastructure for AI production — one integration for all providers, with security and compliance built in."

## Why It Matters

Companies building with AI face a growing set of challenges:

- **Security risks**: Prompt injection attacks, PII leaks, unsafe content generation
- **Compliance burden**: SOC 2, GDPR, HIPAA requirements with no easy solution
- **Provider lock-in**: Tied to one AI provider with no easy way to switch
- **Cost blindness**: No visibility into AI spend until the bill arrives
- **Integration complexity**: Different SDKs, rate limits, and error handling for each provider

Cencori solves all of these with a single integration that takes less than an hour to implement.

## The Business Case

| Problem | Without Cencori | With Cencori |
|---------|-----------------|--------------|
| Security implementation | 3-6 months engineering | 10 minutes |
| Compliance readiness | 6-12 months + auditor costs | Built-in, audit-ready logs |
| Provider switching | Weeks of refactoring | One line of code |
| Cost tracking | Monthly surprise bills | Real-time dashboards |

---

# 2. Company Overview

## About FohnAI

Cencori is built by **FohnAI**, an AI research and development company focused on making AI systems safer and more reliable for production use.

**Mission Statement:**  
*Make AI infrastructure as reliable as web infrastructure.*

**Company Values:**
- Security first, always
- Developer experience matters
- Transparency in pricing and data handling
- Ship fast, but ship right

## Leadership

*[Add leadership bios here]*

## Funding & Stage

*[Add funding details here]*

---

# 3. Product Deep Dive

## How Cencori Works

Cencori operates as an **AI gateway** — a secure proxy layer between your application and AI providers.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Your App      │────▶│    Cencori      │────▶│  AI Provider    │
│                 │     │   (Gateway)     │     │ (OpenAI, etc.)  │
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

## Core Features

### 1. Unified Multi-Provider API

**What it does:** One API that routes to OpenAI, Anthropic, or Google based on the model you specify.

**Key benefit:** Switch providers with a single line change. No code refactoring required.

**Supported Models:**

| Provider | Models Available |
|----------|------------------|
| OpenAI | GPT-4, GPT-4 Turbo, GPT-4 Mini, GPT-3.5 Turbo |
| Anthropic | Claude 3 Opus, Claude 3 Sonnet, Claude 3 Haiku |
| Google | Gemini 2.0 Flash, Gemini 1.5 Flash, Gemini 1.5 Pro |

**Coming Soon:** Mistral, Cohere, Groq, Llama via Together.ai

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
- SOC 2 Type II (Expected Q2 2025)
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

**Cost Optimization:**
- Model comparison recommendations
- Unused project identification
- Token efficiency insights

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

# 4. Ideal Customer Profile

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

5. **E-commerce & Retail**
   - Why: High volume, cost sensitivity
   - Pain: Customer data protection, cost control
   - Example use cases: Product recommendations, customer service, search

## Buyer Personas

### Primary Decision Maker: CTO / VP Engineering

**Profile:**
- Reports to CEO
- Owns technical architecture decisions
- Budget authority for infrastructure tools

**Key Motivations:**
- Reduce security risk and liability
- Meet compliance requirements efficiently
- Avoid building undifferentiated infrastructure

**Pain Points:**
- "We don't have 6 months to build AI security"
- "Our compliance audit found gaps in our AI logging"
- "I can't justify the engineering time for this"

**What They Care About:**
- Enterprise-grade security
- Compliance certifications
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
- Posted a job for "AI Security Engineer"
- Had a public AI-related security incident
- Announced SOC 2 or HIPAA compliance initiative
- Recently raised Series A+ funding
- Mentioned AI cost concerns in earnings call or interview

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

# 5. Pricing & Packaging

## Pricing Philosophy

1. **Transparent**: No hidden fees, no surprises
2. **Scalable**: Start free, grow with usage
3. **Value-based**: Price reflects risk mitigation and time saved

## Tier Comparison

| Feature | Free | Pro | Team | Enterprise |
|---------|------|-----|------|------------|
| **Price** | $0 | $49/mo | $149/mo | Custom |
| **Requests/month** | 1,000 | 50,000 | 250,000 | Unlimited |
| **Projects** | 1 | Unlimited | Unlimited | Unlimited |
| **Team Members** | 1 | 3 | 10 | Unlimited |
| **Security Features** | Basic | All | All | All + Custom |
| **Support** | Community | Email (24hr) | Priority (4hr) | Dedicated |
| **Log Retention** | 30 days | 60 days | 90 days | Custom |
| **API Access** | No | Yes | Yes | Yes |
| **Webhooks** | No | Yes | Yes | Yes |
| **SSO/SAML** | No | No | No | Yes |
| **SLA** | No | No | No | Yes (99.9%+) |
| **Custom Integrations** | No | No | No | Yes |

## Understanding the Cost Model

**Customers pay two things:**

1. **Cencori Subscription**: Fixed monthly fee based on tier
2. **AI Usage**: Pass-through cost from providers + 10-20% markup

**Example calculation (Pro tier, 30K requests/month):**
- Cencori subscription: $49
- Average request cost: $0.002 (GPT-4 Mini average)
- AI usage: 30,000 × $0.002 = $60
- Cencori markup (15%): $9
- **Total monthly cost: $49 + $60 + $9 = $118**

**Why markup on AI usage?**
- We handle all provider billing (consolidated invoice)
- We provide security scanning on every request
- We maintain the infrastructure and routing
- Customers save time managing multiple provider accounts

## Discount Guidelines

| Scenario | Discount Available |
|----------|-------------------|
| Annual commitment | 17% (2 months free) |
| Startup (< $2M raised) | Up to 50% first year |
| Non-profit / Education | Up to 50% |
| Multi-year contract | Negotiate with leadership |
| Competitive displacement | Case-by-case |

---

# 6. Competitive Landscape

## Competitive Overview

### Direct Competitors

| Competitor | Focus Area | Strengths | Weaknesses |
|------------|------------|-----------|------------|
| **Helicone** | Observability | Great logging UI, open source | No security features |
| **Portkey** | AI Gateway | Multi-provider, good docs | Less security focus |
| **LangSmith** | LangChain Ecosystem | Deep LangChain integration | Framework lock-in |
| **Braintrust** | Eval & Logging | Strong eval tools | Not a gateway |

### Indirect Competitors

| Competitor | Why They Come Up | Our Response |
|------------|------------------|--------------|
| **Build In-house** | "We can build this ourselves" | See objection handling |
| **Direct API** | "We'll just use OpenAI directly" | No security, compliance, or multi-provider |
| **Cloud Provider AI** | "We use AWS Bedrock / Azure OpenAI" | Single provider, limited security |

## Competitive Battle Cards

### vs. Helicone

**Their pitch:** "Open-source observability for LLMs"

**Where they win:**
- Open source (self-host option)
- Lower cost for pure logging use case
- Good developer community

**Where we win:**
- Security features (PII, prompt injection)
- Compliance focus (audit logs, SOC 2 path)
- Multi-provider routing
- Managed service with SLA

**Landmine question to ask prospect:**
"How are you planning to handle PII detection and prompt injection protection?"

**If they mention Helicone:**
"Helicone is great for observability. We actually complement it well — we focus on security and compliance, while they focus on debugging and analytics. Many customers use both. That said, if security and compliance are important, you'll need a solution like Cencori regardless."

---

### vs. Portkey

**Their pitch:** "AI Gateway for production"

**Where they win:**
- Good multi-provider support
- Solid documentation
- Lower price point for basic use

**Where we win:**
- Deeper security features
- Better compliance positioning
- Simpler pricing model
- More responsive support

**Landmine question to ask prospect:**
"What's your plan for meeting SOC 2 requirements for your AI features?"

**If they mention Portkey:**
"Portkey is a solid gateway product. The main difference is our security focus — we were built specifically for companies that need compliance-ready AI infrastructure. If you're in a regulated industry or expect to go through SOC 2, our audit logging and security features will save you significant time."

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
- Proven at scale

**Response framework:**

"You absolutely could build this. The question is whether you should. Let me break down what's involved:

1. **Security layer**: PII detection, prompt injection defense, content filtering. This alone is 2-3 months of work, and you need ML expertise.

2. **Audit logging**: SOC 2 compliant logging with encryption, retention policies, export capabilities. Another 1-2 months.

3. **Multi-provider routing**: Different SDKs, rate limits, error handling, failover. 1-2 months.

4. **Cost tracking**: Token counting, pricing calculation, dashboards, alerts. 1 month.

5. **Ongoing maintenance**: Security patches, new attack patterns, provider API changes. Continuous.

Total: 6-9 months of engineering time, plus ongoing maintenance. At a fully-loaded cost of $150-200K per engineer, you're looking at $300K+ for the initial build.

Cencori gives you all of this in a 10-minute integration for a fraction of the cost. That 6 months of engineering time could be spent on features that differentiate your product."

---

# 7. Objection Handling

## Price Objections

### "It's too expensive"

**Response:**
"I understand. Let's break down the value:

- **Engineering time saved**: Building this in-house would take 3-6 months of senior engineering time. At a fully-loaded cost of $150K/engineer, that's $75K-$150K just in salary.

- **Risk mitigation**: A single AI security incident can cost millions in breach notification, legal fees, and reputation damage. We're insurance against that.

- **Time to compliance**: SOC 2 readiness for AI takes 6-12 months to build. We give you audit-ready logs from day one.

At $49-149/month, you're getting enterprise-grade infrastructure for less than the cost of a single engineer-day per month.

What specific budget constraints are you working with? There may be ways we can structure this differently."

### "Can you do a discount?"

**Response:**
"We want to make this work for you. A few options:

1. **Annual commitment**: We offer 17% off for annual prepay (2 months free)
2. **Startup program**: If you've raised less than $2M, we have a startup tier with 50% off the first year
3. **Pilot pricing**: We can do a shorter-term pilot at reduced cost to prove value before full commitment

Which of these might work for your situation?"

---

## Technical Objections

### "What about latency?"

**Response:**
"Great question. Our overhead is typically 10-50ms for security checks. 

Here's context: The AI model response itself takes 1-5 seconds depending on the model and prompt. So our 10-50ms adds less than 1-3% to total latency.

Our servers run on Vercel's edge network across 20+ global regions, so requests route from the nearest location to minimize network latency.

Would you like to run a quick latency test in your environment? I can set you up with a free tier instantly."

### "We're worried about vendor lock-in"

**Response:**
"That's actually one of our key value propositions. Cencori *reduces* lock-in:

1. **Provider independence**: You can switch from OpenAI to Anthropic with a single parameter change. No code refactoring.

2. **Standard API**: We follow OpenAI's API structure, which is becoming the industry standard. If you ever leave Cencori, your code will work directly with any provider.

3. **Data portability**: You can export all your logs and data at any time. We don't hold your data hostage.

4. **No long-term contracts**: We offer monthly terms. You can leave anytime.

The irony is that using OpenAI directly creates *more* lock-in than using Cencori."

### "How do we know it's secure?"

**Response:**
"We take security seriously. Here's what we do:

1. **Encryption**: All data encrypted in transit (TLS 1.3) and at rest (AES-256)

2. **SOC 2**: We're currently in the SOC 2 Type II certification process (expected Q2 2025)

3. **No training**: We never use your data to train models. Period.

4. **No sharing**: We don't share your data with third parties

5. **Access controls**: Role-based access, audit logs on admin actions, SSO for enterprise

6. **Infrastructure**: Built on Supabase (SOC 2, HIPAA compliant) and Vercel (SOC 2, ISO 27001)

We're happy to complete your security questionnaire and do a call with your security team."

---

## Business Objections

### "We need to talk to more stakeholders"

**Response:**
"Absolutely. Who else needs to be involved in this decision? 

I'd be happy to join a call with your [Security team / Finance / Engineering leads] to address their specific concerns. I can also prepare materials tailored to each stakeholder:

- For Security: Our security whitepaper and SOC 2 roadmap
- For Finance: ROI calculator and cost comparison
- For Engineering: Technical documentation and integration guide

Would it be helpful if I sent those over before the next conversation?"

### "We're not ready yet"

**Response:**
"Totally understand. When you say 'not ready,' is that:

a) You haven't started building AI features yet?
b) You have AI in production but security isn't a priority right now?
c) You're in the middle of something else and timing is bad?

*[Listen to response, then:]*

That makes sense. A lot of our customers started with our free tier just to get familiar with the platform before their AI initiative kicked into high gear. Would it be useful to set that up now so you're ready when the time comes?"

### "We had a bad experience with a similar vendor"

**Response:**
"I'm sorry to hear that. Would you mind sharing what went wrong? I want to make sure we can address those concerns upfront.

*[Listen to response]*

Thank you for sharing that. Here's how we handle that differently:

*[Address specific concern with specific Cencori feature/policy]*

Would you be open to a short pilot to prove we can deliver where the other vendor fell short?"

---

# 8. Sales Process

## Sales Stages

| Stage | Definition | Exit Criteria |
|-------|------------|---------------|
| **Lead** | Inbound inquiry or outbound contact made | Qualified as potential fit |
| **Discovery** | Initial call completed | Understand needs, timeline, budget |
| **Demo** | Product demonstrated | Technical fit confirmed |
| **Evaluation** | Proof of concept or trial | Value proven in their environment |
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

## Key Metrics to Track

- **Discovery to Demo Conversion**: Target 70%+
- **Demo to Trial Conversion**: Target 50%+
- **Trial to Close Conversion**: Target 60%+
- **Average Deal Size**: Track by segment
- **Sales Cycle Length**: Track trend over time

---

# 9. Discovery Framework

## Pre-Call Research

Before every discovery call, research:

1. **Company**: What do they do? Recent news? Funding?
2. **Person**: Role, tenure, LinkedIn background
3. **Tech Stack**: Check job posts, GitHub, case studies
4. **AI Usage**: Any public mention of AI features?

## Discovery Call Structure (30 minutes)

### Opening (2 min)
"Thanks for making time today. I've done some research on [Company] and I'm excited to learn more about what you're building. My goal today is to understand your situation and see if Cencori might be a fit. If it's not, I'll tell you honestly. Sound good?"

### Situation Questions (5 min)

1. "Tell me about your current AI implementation. What models are you using and for what use cases?"

2. "How are you integrating with AI providers today? Direct API or through a framework?"

3. "How many requests per month are you doing? Any sense of growth trajectory?"

### Pain Questions (10 min)

4. "What happens if OpenAI has an outage? Do you have failover?"

5. "How are you handling security today — things like PII detection or prompt injection protection?"

6. "Are you subject to any compliance requirements like SOC 2, HIPAA, or GDPR?"

7. "How do you track AI costs today? Do you have visibility into spend by customer or feature?"

8. "What would happen if you needed to switch from OpenAI to Anthropic? How long would that take?"

### Impact Questions (5 min)

9. "If you could wave a magic wand and fix one thing about your AI infrastructure today, what would it be?"

10. "What's the cost of *not* solving this? Are there projects blocked or risks you're carrying?"

### Timeline & Next Steps (8 min)

11. "What's your timeline for addressing this?"

12. "Who else would be involved in making a decision?"

13. "What would you need to see from us to feel confident moving forward?"

**Close with next step:**
"Based on what you've shared, I think there's a strong fit here. Would you be open to a demo next week where I can show you exactly how Cencori would work in your environment?"

---

# 10. Demo Playbook

## Demo Preparation

1. **Create a custom demo project** with prospect's company name
2. **Prepare example prompts** relevant to their use case
3. **Load sample data** that mirrors their scenarios (fake/generic)
4. **Test your environment** — make sure everything works

## Demo Structure (20-25 minutes)

### 1. Recap & Agenda (2 min)

"[Name], last time we talked you mentioned [key pain point]. Today I'll show you exactly how Cencori addresses that. I'll cover:
1. How integration works
2. Security in action
3. Cost visibility

Then we'll leave time for questions. Does that work?"

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

Key talking points:
- "This is the entire integration. Your existing code stays the same."
- "You can switch models by changing one parameter."
- "Works with any OpenAI-compatible library or framework."

Make a live request and show it succeed.

### 3. Security Demo (7 min)

**PII Detection:**
Send a prompt containing a fake email/phone number:
- Show it being flagged in the dashboard
- Show the safety score
- Explain blocking vs. logging modes

**Prompt Injection:**
Send a known injection pattern:
- Show the injection being detected
- Show the risk score calculation
- Explain configurable thresholds

Key talking point:
"This is happening on every request, automatically. No engineering work required."

### 4. Cost & Analytics Demo (5 min)

Show the dashboard:
- Real-time cost tracking
- Model usage breakdown
- Request trends over time

Key talking points:
- "You'll never be surprised by an AI bill again."
- "You can see exactly which features or customers are driving costs."
- "Budget alerts notify you before you exceed limits."

### 5. Q&A & Next Steps (5 min)

"What questions do you have?"

*[Answer questions]*

"Based on what you've seen, does this solve the problems we discussed?"

*[If yes]:* "Great. The natural next step would be a trial in your environment. I can set you up on our free tier today — takes about 10 minutes. Would you have time tomorrow to do a quick implementation call?"

---

# 11. Email Templates

## Initial Outreach (Cold)

**Subject:** Quick question about [Company]'s AI security

Hi [Name],

I noticed [Company] is building with [AI use case/model — from job post or public info]. As you scale AI in production, I'm curious how you're handling security — things like prompt injection protection and PII detection.

Most teams I talk to either:
a) Haven't prioritized it yet (scary but common)
b) Are building something custom (expensive and slow)
c) Are looking for a better solution

If you're in category (b) or (c), Cencori might be worth a look. We're AI infrastructure with security built in — one integration, all providers.

Worth a 15-minute call to see if there's a fit?

[Your name]

---

## Follow-up After Discovery

**Subject:** Cencori next steps — [Company]

Hi [Name],

Great talking with you today. To recap:

**What we heard:**
- [Pain point 1]
- [Pain point 2]
- [Timeline/urgency]

**What we can do:**
- [How Cencori solves pain point 1]
- [How Cencori solves pain point 2]

**Next step:**
I'll send a calendar invite for a demo on [date]. I'll prepare examples specific to [their use case].

In the meantime, here are some resources:
- [Link to relevant docs]
- [Link to case study if available]

Let me know if you have any questions before then.

Best,
[Your name]

---

## After Demo

**Subject:** Next steps with Cencori

Hi [Name],

Thanks for your time in the demo today. Great questions from the team.

**As discussed:**
- [Key takeaway 1]
- [Key takeaway 2]

**Next step:** 
[Trial setup / Send proposal / Security review call — whatever was agreed]

I'll [action you're taking] and follow up by [date].

Questions in the meantime? Just reply here.

Best,
[Your name]

---

## Proposal Follow-up

**Subject:** Following up on Cencori proposal

Hi [Name],

Just following up on the proposal I sent last week. Have you had a chance to review?

Happy to jump on a quick call to walk through any questions or discuss terms.

Best,
[Your name]

---

# 12. Resources & Links

## Public Resources

| Resource | URL |
|----------|-----|
| Website | https://cencori.com |
| Documentation | https://cencori.com/docs |
| Pricing Page | https://cencori.com/pricing |
| Contact Form | https://cencori.com/contact |
| Quick Start Guide | https://cencori.com/docs/quick-start |
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
"Cencori is AI infrastructure for production. We're a unified API for every AI provider — OpenAI, Anthropic, Google — with security, compliance, and cost tracking built in. Think Stripe for AI. One integration, all providers, automatic security."

## Key Numbers
- **10 minutes**: Average integration time
- **10-50ms**: Added latency
- **3-6 months**: Engineering time saved vs. build
- **$0**: Starting price (free tier)
- **3**: AI providers supported today

## Top 3 Differentiators
1. Security-first (PII detection, prompt injection defense)
2. Compliance-ready (audit logs, SOC 2 path)
3. True multi-provider (one API, all providers)

---

*End of Sales Playbook*

*For questions or updates, contact: [Sales Lead]*
