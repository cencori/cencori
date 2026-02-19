# Deep Dive: Database Schema (Agents & OpenClaw)

Cencori's agent-infrastructure is designed around a **"Remote Brain" architecture**. Instead of executing arbitrary code on Cencori's servers, Cencori provides the orchestration, state management, and memory, while local clients (via `OpenClaw`) execute the actual system-level actions.

This architecture is physically enforced through our Supabase data model, primarily introduced in the `20260217_170000_openclaw_gateway.sql` migration.

## 1. Core Tables

### A. The Identity Layer (`public.agents`)
This table acts as the core registry for an agent within a project. It serves as the foreign key target for all state and configuration.

### B. The Configuration Layer (`public.agent_configs`)
Stores the deterministic settings for the agent.
- `model`: The LLM to route instructions through (e.g., `gpt-4o`).
- `system_prompt`: The over-arching instruction set.
- `temperature`: Inference determinism.
*Relationship*: `1:1` with `agents`.

### C. The Connection Layer (`public.agent_sessions`)
Manages the live websocket presence of the local execution environment (via Supabase Realtime).
- `socket_id`: Ties the database session to the active WebSocket.
- `status`: `online`, `offline`, `busy`.
- `last_heartbeat`: Used by cron-jobs to clean up dead sessions.
- `metadata`: OS, IP, version of the local OpenClaw runner.

### D. The Execution Layer (`public.agent_actions`)
This is the most critical operational table. It acts as an asynchronous job queue and an audit log.
- **Shadow Mode Queue**: When an LLM determines an action (e.g., "Run this bash script"), it is written to `agent_actions` with a `status` of `pending`.
- **Manual Intervention**: The dashboard UI polls/subscribes to `agent_actions`. A human can transition a `pending` action to `approved` or `rejected`.
- **Payloads**: The `payload` JSONB column stores the exact tool name and arguments. This ensures that the local runner only executes exactly what was committed to the database.

## 2. Row Level Security (RLS) Posture

Agent operations represent high risk, so RLS policies are tightly scoped. 
*Recent hardening (`20260217_190000_harden_agent_rls.sql`)* enforces that users can only view or manage agents mapped to their `organization_id` via the `projects` table.

```sql
CREATE POLICY "Users can update configs for their project agents"
    ON public.agent_configs FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.agents a
            JOIN public.projects p ON a.project_id = p.id
            WHERE a.id = agent_configs.agent_id
            AND auth.uid() IN (
                SELECT user_id FROM public.organization_members
                WHERE organization_id = p.organization_id
            )
        )
    );
```

## 3. BYOK (Bring Your Own Key) Vault

For agents, users can securely store API keys in `public.user_keys`.
- Keys are encrypted (`key_ciphertext`) using the organization ID as salt.
- Strict `USING (auth.uid() = user_id)` RLS ensures cross-tenant isolation, overriding project-level breadth.

## 4. Workflows

Workflows rely on a DAG (Directed Acyclic Graph) engine, orchestrating inputs/outputs between generic nodes (which may delegate to Agents via the Gateway). State is persisted in JSONB columns representing the DAG edges and current execution node pointers, enabling resumability for long-running processes.
