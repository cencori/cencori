# Cencori Architecture

> **Version**: 1.0  
> **Status**: Living Document  
> **Last Updated**: 2026-02-04

This document defines the canonical architecture of Cencori, the unified infrastructure for AI production.

---

## Overview

Cencori is a **Cloud Intelligence Provider (CIP)** — the AWS of AI. We abstract the complexities of building production-grade AI systems (security, orchestration, storage, and integrations) into a single, unified platform.

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Application                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      CENCORI PLATFORM                       │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐ │
│  │ Gateway │ │ Compute │ │Workflow │ │ Storage │ │  Integ │ │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              AI Providers (OpenAI, Anthropic, etc.)         │
└─────────────────────────────────────────────────────────────┘
```

---

## The 5 Primitives

Every AI application requires these foundational building blocks. Cencori provides them as first-class platform services.

### 1. AI Gateway

**Purpose**: The secure, unified API for all AI models.

| Capability | Description |
|------------|-------------|
| Multi-Provider Routing | One API for OpenAI, Anthropic, Gemini, Llama, and more |
| Security Layer | PII detection, prompt injection protection, content filtering |
| Observability | Complete audit logs, latency tracking, cost attribution |
| Streaming | Real-time SSE with token counting |

**Entry Point**: `POST /api/ai/chat`

### 2. Compute

**Purpose**: Serverless execution for AI agents and logic.

| Capability | Description |
|------------|-------------|
| Secure Sandbox | Execute untrusted code in an isolated environment |
| Edge Inference | Run lightweight models closer to users |
| Auto-Scaling | Scale from prototype to millions of requests |

**Entry Point**: `POST /api/compute/run` (Planned)

### 3. Workflow

**Purpose**: Visual orchestration for complex AI pipelines.

| Capability | Description |
|------------|-------------|
| Multi-Step Agents | Chain AI calls, logic steps, and human approvals |
| Circuit Breakers | Prevent cascading failures in autonomous systems |
| State Management | Persistent state for long-running processes |

**Entry Point**: `POST /api/workflow/execute` (Planned)

### 4. Data Storage

**Purpose**: AI-native storage for context and integrity.

| Capability | Description |
|------------|-------------|
| Vector Sync | Manage and query vector embeddings for RAG |
| Audit Logs | Immutable traceability for compliance |
| Semantic Cache | Reduce costs by caching similar responses |

**Entry Point**: `POST /api/storage/vectors` (Planned)

### 5. Integration

**Purpose**: Connect AI to external tools and systems.

| Capability | Description |
|------------|-------------|
| Business Connectors | Salesforce, Slack, GitHub, databases |
| Credential Vault | Securely store and inject third-party keys |
| Event Triggers | Start workflows from external system events |

**Entry Point**: `POST /api/integrations/{connector}` (Planned)

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Web Framework** | Next.js 15 (App Router) | Full-stack React with SSR |
| **Auth & Database** | Supabase | PostgreSQL + RLS + Auth |
| **Language** | TypeScript | Type safety across the stack |
| **Deployment** | Vercel | Global edge network, CI/CD |
| **SDKs** | TypeScript, Python, Go | First-class multi-language support |

---

## Design Principles

1.  **Unified by Default**: A single integration point handles routing, security, and observability.
2.  **Secure by Default**: Every request is filtered and logged. There is no "insecure" mode.
3.  **Provider Agnostic**: Switch AI providers with a parameter change, not a rewrite.
4.  **Observable Always**: If it happens, it's logged. No black boxes.

---

## Future Considerations

- **Self-Hosted Gateway**: Allow enterprises to run the Gateway within their VPC.
- **Custom Primitives**: Enable users to define their own Workflow steps and Compute functions.
