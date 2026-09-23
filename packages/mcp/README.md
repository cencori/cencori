# @cencori/mcp

Official MCP server for Cencori: first-party web search, documentation, gateway, Embedded Agents, memory, sessions, governance, and multimodal inference.

It is a thin stdio adapter over Cencori's public HTTP APIs. The platform enforces authentication, project isolation, quota, policy, and audit logging; the MCP server adds capability flags and tool annotations for reads, writes, destructive changes, and open-web access.

## Quick start

```bash
npx -y @cencori/mcp@latest
```

Docs and `how_to_*` guidance work without an API key. Add a project key for Web and platform reads:

```json
{
  "mcpServers": {
    "cencori": {
      "command": "npx",
      "args": ["-y", "@cencori/mcp@latest"],
      "env": {
        "CENCORI_API_KEY": "csk_..."
      }
    }
  }
}
```

Enable operations that enqueue work, incur inference cost, or change state:

```json
{
  "CENCORI_API_KEY": "csk_...",
  "CENCORI_MCP_WRITE": "1"
}
```

## Cencori Web tools

Version 0.8.0 includes first-party Web access and read-only Embedded Agents inspection. Search uses Cencori's own crawler, corpus, embeddings, and ranking pipeline—not a third-party search API.

| Tier | Tools |
|---|---|
| Read | `web_search`, `web_fetch`, `web_extract`, `get_web_browser_job` |
| Write | `web_browse`, `web_crawl`, `request_web_takedown` |

Web tools carry `openWorldHint: true`. Returned page content is untrusted data, never instructions. Browser jobs are asynchronous; call `get_web_browser_job` with the id from `web_browse`.

To expose only Web and docs:

```json
{
  "mcpServers": {
    "cencori-web": {
      "command": "npx",
      "args": ["-y", "@cencori/mcp@latest"],
      "env": {
        "CENCORI_API_KEY": "csk_...",
        "CENCORI_MCP_FEATURES": "web,docs",
        "CENCORI_MCP_WRITE": "1"
      }
    }
  }
}
```

## Action tiers

| Tier | Gate | Surface |
|---|---|---|
| Public | none | docs search/fetch/list, `llm.txt`, and manual `how_to_*` guidance |
| Read | `CENCORI_API_KEY` | Web reads, metrics, health, quota, Embedded Agents, agents, memory, sessions, governance |
| Write | `CENCORI_MCP_WRITE=1` | Web actions, inference, memory/agent/session writes, governance drafts |
| Destructive | `CENCORI_MCP_DESTRUCTIVE=1` | delete and approve/reject tools; implies write |

Credential, billing, access, and governance-activation decisions are never executed. Their `how_to_*` tools only return instructions and dashboard links.

## Tool surface

Public:

- `search_docs`, `get_doc`, `list_docs`, `get_integration_guide`
- API key, governance, billing, and membership `how_to_*` tools

Authenticated reads:

- Web: search, fetch, extract, and browser-job polling
- Gateway: models, metrics, health, and quota
- Agents, memory, sessions, and governance list/get/search tools
- Embedded Agents: tenants, versions, installations, runs, actions, knowledge, skills, providers, usage, webhooks, and remote MCP snapshots

Write:

- Web browse, project crawl, and takedown request
- Text/RAG/embedding/moderation/image/vision/document/audio inference
- Memory, agent, session, and governance-draft creation/update tools

Destructive:

- `delete_memory`, `delete_agent`, `delete_session`, `approve_session`, `reject_session`

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `CENCORI_API_KEY` | — | Secret project key for authenticated tools. |
| `CENCORI_MCP_WRITE` | `false` | Enable additive writes, inference, and Web actions. |
| `CENCORI_MCP_DESTRUCTIVE` | `false` | Enable destructive tools; implies write. |
| `CENCORI_MCP_FEATURES` | all | `docs,guidance,gateway,agents,memory,sessions,web,governance,multimodal,embedded` |
| `CENCORI_BASE_URL` | `https://cencori.com` | Platform API host. |
| `CENCORI_DOCS_BASE_URL` | `https://cencori.com` | Documentation API host. |

Restart the client after changing environment variables.

To expose only Embedded Agents inspection, use `CENCORI_MCP_FEATURES=embedded`. These tools are read-only: `list_tenants`, `get_tenant`, `list_agent_versions`, `list_installations`, `get_run`, `get_run_events`, `get_action`, `list_knowledge_bases`, `search_knowledge_base`, `list_skills`, `list_provider_connections`, `get_usage`, `list_webhooks`, `list_webhook_deliveries`, `list_mcp_servers`, and `list_mcp_server_tools`.

## Development

```bash
cd packages/mcp
npm install
npm run build
npm test
```

Package layout:

```text
src/
├── index.ts
├── server.ts
├── config.ts
├── client.ts
├── docs/client.ts
└── tools/
    ├── web.ts
    ├── docs.ts
    ├── gateway.ts
    ├── agents.ts
    ├── memory.ts
    ├── sessions.ts
    ├── governance.ts
    ├── multimodal.ts
    ├── audio.ts
    ├── guidance.ts
    └── shared.ts
```

- stdout is reserved for JSON-RPC; operational logging must use stderr.
- The built artifact receives its shebang from `tsup.config.ts`.
- `Authorization: Bearer <key>` is used for Cencori API calls.

Full documentation: https://cencori.com/docs/mcp
