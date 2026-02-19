# Cencori Technical Onboarding: The Institutional Bible

Welcome, CTO. This document is a deep-dive technical survey of the Cencori ecosystem. It bypasses high-level marketing summaries to provide you with the architectural decisions, core logic paths, and infrastructure primitives that power the platform.

---

## 🏗️ High-Level Architecture: The CIP Model

Cencori operates as a **Cloud Intelligence Provider (CIP)**. We reside between the application layer and the fragmented AI model layer. Our mission is to abstract the 4 horsemen of AI production: **Security, Reliability, Persistence, and Orchestration**.

### The 5 Primitives
1.  **AI Gateway**: Uniform model access, reliability, and security filtering.
2.  **AI Memory (Storage)**: Distributed semantic storage with automatic embedding management.
3.  **Compute**: Optimized inference and agentic execution environments.
4.  **Workflows**: Directed Acyclic Graph (DAG) based model orchestration.
5.  **Integrations**: Connectors for n8n, Zapier, and enterprise data sinks.

---

## 🧠 Core Primitive: AI Gateway

The AI Gateway is the most mission-critical component. It resides in `app/api/ai/chat/route.ts`.

### 1. Multi-Provider Routing & Load Balancing
- **Router** (`lib/providers/router.ts`): Acts as a factory for provider abstractions (OpenAI, Anthropic, Gemini, Cohere, etc.).
- **Failover Logic** (`lib/providers/failover.ts`): Transparently maps models across providers (e.g., if GPT-4o fails, it fails over to Claude 3.5 Sonnet).
- **Circuit Breaking** (`lib/providers/circuit-breaker.ts`): Uses a Redis-backed (Upstash) state machine to "open" circuits for failing providers, preventing cascading latency. Threshold: 5 failures / 60s.

### 2. The Request Lifecycle
1.  **Auth**: SHA-256 hash lookup of `CENCORI_API_KEY`. Supports standard and `cake_` (Agent) keys.
2.  **Quota/Billing**: Real-time counter check in Supabase + Spend Cap verification.
3.  **Input Security**:
    *   **Prompt Injection**: Scanned via `lib/safety/`.
    *   **Data Rules**: Recursive masking/tokenization of PII across conversation history (`custom_data_rules`).
4.  **LLM Execution**: `tryStreamWithFallback` manages the actual network requests to providers.
5.  **Output Security**: Real-time stream interception to detect and block data leakage before it reaches the client.
6.  **Observability**: Everything logged to `ai_requests` with precise latency and cost breakdowns.

---

## 🛡️ Core Product: Cencori Scan

The Scan engine is our primary security product, available via CLI and Dashboard.

### 1. Detection Engine (`packages/scan/`)
- **Pattern Matching**: Uses 50+ optimized regular expressions (`scanner/patterns.ts`) to detect:
    *   **Secrets**: API keys, private keys, service tokens.
    *   **PII**: Emails, SSNs, Credit Cards.
    *   **Vulnerabilities**: XSS, SQLi, insecure CORS.
- **Tier Scoring**: Generates a letter grade (A-F) based on weighted severity.

### 2. AI Auto-Fix Service
- **Logic**: CLI (`ai/index.ts`) calls the platform's own Gateway.
- **Process**:
    1.  **Analyze**: A Llama-based "Scout" model filters false positives.
    2.  **Generate**: A specialized security model generates corrected code snippets (e.g., replacing a secret with `process.env`).
    3.  **Apply**: CLI performs interactive diff-application.

---

## 📦 SDK Architecture & Cross-Language Consistency

We maintain `packages/sdk` (TypeScript) and `cencori-go` (Go) as first-class citizens.

### 1. Logical Interface Standardization
Both SDKs implement the same core service structure:
- `client.chat`: Gateway interactions.
- `client.memory`: Storage/Vector search.
- `client.projects`: Management API.

### 2. Implementation Differences
- **TypeScript**: Highly modular, functional style, built-in integrations for **Vercel AI SDK** and **TanStack**.
- **Go**: Idiomatic, goroutine-based streaming, strong typing for all API payloads, robust `doRequest` retry logic.

---

## 🗄️ Infrastructure, Tenancy & Security

### 1. Multi-Tenant Data Isolation
- **Supabase (PostgreSQL)**: The backbone of our state.
- **RLS (Row Level Security)**: Policies in `supabase/migrations/` ensure Org and Project isolation. Recent hardening focus: `20260217_190000_harden_agent_rls.sql`.

### 2. The Persistence Layer
- **Semantic Cache**: Uses `pgvector` and Upstash Redis to cache LLM responses based on semantic similarity, not just string matching.
- **AI Memory**: Real-time vectorization of user data for RAG (Retrieval Augmented Generation).

---

## 🚀 Key Entry Points for Deep Dives

| Module | Location | Why It Matters |
| :--- | :--- | :--- |
| **Main Gateway** | `app/api/ai/chat/route.ts` | The heart of product value. |
| **Scan Core** | `packages/scan/src/scanner/` | Security IP. |
| **Provider Layer** | `lib/providers/` | Reliability & Logic abstraction. |
| **Dashboard** | `app/dashboard/` | User experience and multi-tenancy. |
| **Data Layer** | `supabase/migrations/` | The ultimate source of truth for schema. |
| **SDK Internals** | `packages/sdk/src/` | Developer Experience core. |

---

## 🔎 Level 2 Subsystem Deep Dives

For more granular, subsystem-specific internals, reference these specialized deep dives written during the Level 2 architectural audit:

| Deep Dive | Path | Focus Area |
| :--- | :--- | :--- |
| **Security Tokenization** | `docs/cto/SECURITY_TOKENIZATION.md` | E2E flow of Custom Data Rules, AI-Detect classification, and bidirectional tokenization during inference. |
| **Dashboard State** | `docs/cto/DASHBOARD_STATE_MANAGEMENT.md` | `@tanstack/react-query` architecture, removing global stores, and managing API key configurations locally. |
| **Agent Databases** | `docs/cto/DATABASE_SCHEMA_AGENTS.md` | Schema design for the 'Remote Brain' OpenClaw integration and RLS limits on Agent Sessions. |
| **Deployment & Telemetry** | `docs/cto/DEPLOYMENT_TELEMETRY.md` | Edge-routing API requests via Vercel `rewrites`, domain segmentation, and silent scanner telemetry. |

---

## 🛠️ Developer Integration Reference

### Example: Production RAG Pattern
See `examples/recentraise-demo` for the canonical way to implement semantic search:
1.  **Extract**: Use `cencori.ai.chat` (GPT-4o-mini) to structure raw news.
2.  **Store**: `cencori.memory.store` in the `funding-rounds` namespace.
3.  **Query**: `cencori.memory.search` with natural language.

---

**CTO Note**: The system is designed for massive horizontal scale via Vercel Edge and Supabase. Your primary challenges will be improving the "Cold Start" latency of multi-provider routing and expanding the "Compute" primitive for long-running agent tasks.
