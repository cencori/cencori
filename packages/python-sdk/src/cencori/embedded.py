"""Embedded Agents module for multi-tenant agent backends."""

from typing import TYPE_CHECKING, Any, Dict, List, Optional

if TYPE_CHECKING:
    from .client import Cencori


class TenantsModule:
    """Downstream tenant directory (upsert, users, export, delete)."""

    def __init__(self, client: "Cencori") -> None:
        self._client = client

    def create(self, external_id: str, name: str, idempotency_key: Optional[str] = None, **kwargs: Any) -> Dict[str, Any]:
        """Create or upsert a tenant by external_id."""
        payload: Dict[str, Any] = {"external_id": external_id, "name": name, **kwargs}
        headers = {"Idempotency-Key": idempotency_key} if idempotency_key else None
        return self._client._request("POST", "/v1/tenants", json=payload, headers=headers)

    def list(self, limit: int = 20, cursor: Optional[str] = None, status: Optional[str] = None) -> Dict[str, Any]:
        """List tenants."""
        path = f"/v1/tenants?limit={limit}"
        if cursor:
            path += f"&cursor={cursor}"
        if status:
            path += f"&status={status}"
        return self._client._request("GET", path)

    def get(self, tenant_id: str) -> Dict[str, Any]:
        """Get a tenant."""
        return self._client._request("GET", f"/v1/tenants/{tenant_id}")

    def delete(self, tenant_id: str) -> Dict[str, Any]:
        """Hard-delete a tenant (cascades)."""
        return self._client._request("DELETE", f"/v1/tenants/{tenant_id}")

    def upsert_user(self, tenant_id: str, external_user_id: str, **kwargs: Any) -> Dict[str, Any]:
        """Upsert a user within a tenant."""
        return self._client._request("PUT", f"/v1/tenants/{tenant_id}/users/{external_user_id}", json=kwargs or None)


class RunsModule:
    """Background and synchronous agent runs."""

    def __init__(self, client: "Cencori") -> None:
        self._client = client

    def create(self, agent_id: str, payload: Dict[str, Any], idempotency_key: Optional[str] = None) -> Dict[str, Any]:
        """Create a run (idempotent with a key)."""
        headers = {"Idempotency-Key": idempotency_key} if idempotency_key else None
        return self._client._request("POST", f"/v1/agents/{agent_id}/runs", json=payload, headers=headers)

    def get(self, run_id: str) -> Dict[str, Any]:
        """Get a run."""
        return self._client._request("GET", f"/v1/runs/{run_id}")

    def events(self, run_id: str, after: Optional[str] = None, limit: int = 50) -> Dict[str, Any]:
        """Read the durable run event log."""
        path = f"/v1/runs/{run_id}/events?limit={limit}"
        if after:
            path += f"&after={after}"
        return self._client._request("GET", path)

    def cancel(self, run_id: str) -> Dict[str, Any]:
        """Cancel a run (cascades to child runs)."""
        return self._client._request("POST", f"/v1/runs/{run_id}/cancel", json={})

    def delegate(self, run_id: str, agent_version_id: str, payload: Optional[Dict[str, Any]] = None, idempotency_key: Optional[str] = None, installation_id: Optional[str] = None) -> Dict[str, Any]:
        """Delegate one bounded task to an allowed subagent version."""
        body: Dict[str, Any] = {"agent_version_id": agent_version_id, "input": payload or {}}
        if installation_id:
            body["installation_id"] = installation_id
        headers = {"Idempotency-Key": idempotency_key} if idempotency_key else None
        return self._client._request("POST", f"/v1/runs/{run_id}/delegate", json=body, headers=headers)


class ActionsModule:
    """Approval-gated actions with exactly-once claims."""

    def __init__(self, client: "Cencori") -> None:
        self._client = client

    def create(self, tool: str, arguments: Optional[Dict[str, Any]] = None, idempotency_key: Optional[str] = None, **kwargs: Any) -> Dict[str, Any]:
        """Create an approval-gated action."""
        payload: Dict[str, Any] = {"tool": tool, "arguments": arguments or {}, **kwargs}
        headers = {"Idempotency-Key": idempotency_key} if idempotency_key else None
        return self._client._request("POST", "/v1/actions", json=payload, headers=headers)

    def get(self, action_id: str) -> Dict[str, Any]:
        """Get an action (sanitized)."""
        return self._client._request("GET", f"/v1/actions/{action_id}")

    def approve(self, action_id: str, approved_by: Optional[str] = None) -> Dict[str, Any]:
        """Approve (idempotent, executes once)."""
        return self._client._request("POST", f"/v1/actions/{action_id}/approve", json={"approved_by": approved_by} if approved_by else {})

    def reject(self, action_id: str, reason: Optional[str] = None) -> Dict[str, Any]:
        """Reject (idempotent)."""
        return self._client._request("POST", f"/v1/actions/{action_id}/reject", json={"reason": reason} if reason else {})


class KnowledgeModule:
    """Knowledge bases, sources, grants, and cited search."""

    def __init__(self, client: "Cencori") -> None:
        self._client = client

    def create_base(self, name: str, **kwargs: Any) -> Dict[str, Any]:
        """Create a knowledge base."""
        return self._client._request("POST", "/v1/knowledge-bases", json={"name": name, **kwargs})

    def add_inline_source(self, kb_id: str, text: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Ingest inline text."""
        return self._client._request("POST", f"/v1/knowledge-bases/{kb_id}/sources", json={"text": text, "metadata": metadata or {}})

    def search(self, kb_id: str, query: str, top_k: int = 5, installation_id: Optional[str] = None) -> Dict[str, Any]:
        """Grant-filtered search with chunk citations."""
        payload: Dict[str, Any] = {"query": query, "top_k": top_k}
        if installation_id:
            payload["installation_id"] = installation_id
        return self._client._request("POST", f"/v1/knowledge-bases/{kb_id}/search", json=payload)

    def grant(self, kb_id: str, subject_type: str, subject_id: str) -> Dict[str, Any]:
        """Grant a knowledge base to an installation/group/role/user."""
        return self._client._request("POST", f"/v1/knowledge-bases/{kb_id}/grants", json={"subject_type": subject_type, "subject_id": subject_id})

    def list_sources(self, kb_id: str) -> Dict[str, Any]:
        """List ingested sources."""
        return self._client._request("GET", f"/v1/knowledge-bases/{kb_id}/sources")

    def sync_source(self, kb_id: str, source_id: str, text: Optional[str] = None) -> Dict[str, Any]:
        """Re-ingest a source (checksum-idempotent)."""
        return self._client._request("POST", f"/v1/knowledge-bases/{kb_id}/sources/{source_id}/sync", json={"text": text} if text else {})


class SkillsModule:
    """Organization skill library with staged imports."""

    def __init__(self, client: "Cencori") -> None:
        self._client = client

    def create(self, name: str, **kwargs: Any) -> Dict[str, Any]:
        """Create a skill identity."""
        return self._client._request("POST", "/v1/skills", json={"name": name, **kwargs})

    def list(self, visibility: Optional[str] = None) -> Dict[str, Any]:
        """List skills."""
        path = "/v1/skills"
        if visibility:
            path += f"?visibility={visibility}"
        return self._client._request("GET", path)

    def get(self, skill_id: str) -> Dict[str, Any]:
        """Get a skill."""
        return self._client._request("GET", f"/v1/skills/{skill_id}")

    def update(self, skill_id: str, **kwargs: Any) -> Dict[str, Any]:
        """Update skill metadata."""
        return self._client._request("PATCH", f"/v1/skills/{skill_id}", json=kwargs)

    def list_versions(self, skill_id: str) -> Dict[str, Any]:
        """List skill versions."""
        return self._client._request("GET", f"/v1/skills/{skill_id}/versions")

    def get_version(self, skill_id: str, version: str) -> Dict[str, Any]:
        """Get a skill version with content."""
        return self._client._request("GET", f"/v1/skills/{skill_id}/versions/{version}")

    def create_version(self, skill_id: str, version: str, content: Optional[str] = None, files: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """Draft a version with scan findings attached."""
        payload: Dict[str, Any] = {"version": version}
        if content is not None:
            payload["content"] = content
        if files is not None:
            payload["files"] = files
        return self._client._request("POST", f"/v1/skills/{skill_id}/versions", json=payload)

    def publish_version(self, skill_id: str, version: str, reviewed_by: Optional[str] = None) -> Dict[str, Any]:
        """Publish a version (blocked while scan findings are blocking)."""
        return self._client._request("POST", f"/v1/skills/{skill_id}/versions/{version}/publish", json={"reviewed_by": reviewed_by} if reviewed_by else {})

    def deprecate_version(self, skill_id: str, version: str) -> Dict[str, Any]:
        """Deprecate a version."""
        return self._client._request("POST", f"/v1/skills/{skill_id}/versions/{version}/deprecate", json={})

    def stage_import(self, url: Optional[str] = None, repository: Optional[str] = None, text: Optional[str] = None) -> Dict[str, Any]:
        """Stage an import (exactly one source)."""
        payload = {k: v for k, v in {"url": url, "repository": repository, "text": text}.items() if v is not None}
        return self._client._request("POST", "/v1/skill-imports", json=payload)

    def get_import(self, import_id: str) -> Dict[str, Any]:
        """Get a staged import with findings."""
        return self._client._request("GET", f"/v1/skill-imports/{import_id}")

    def publish_import(self, import_id: str, name: Optional[str] = None, skill_id: Optional[str] = None, version: str = "1.0.0") -> Dict[str, Any]:
        """Review-gate publish of a staged import."""
        payload: Dict[str, Any] = {"version": version}
        if name:
            payload["name"] = name
        if skill_id:
            payload["skill_id"] = skill_id
        return self._client._request("POST", f"/v1/skill-imports/{import_id}/publish", json=payload)


class UsageModule:
    """Tenant/agent-attributed usage and invoice export."""

    def __init__(self, client: "Cencori") -> None:
        self._client = client

    def summary(self, days: int = 30, tenant_id: Optional[str] = None, agent_id: Optional[str] = None) -> Dict[str, Any]:
        """Usage summary grouped by tenant/agent/installation."""
        path = f"/v1/usage?days={days}"
        if tenant_id:
            path += f"&tenant_id={tenant_id}"
        if agent_id:
            path += f"&agent_id={agent_id}"
        return self._client._request("GET", path)

    def export_csv(self, days: int = 30) -> str:
        """Invoice CSV export (raw text)."""
        import httpx

        url = f"{self._client._base_url}/v1/usage/export?format=csv&days={days}"
        headers = {"CENCORI_API_KEY": self._client._api_key}
        with httpx.Client(timeout=self._client._timeout) as client:
            response = client.request("GET", url, headers=headers)
            response.raise_for_status()
            return response.text


class EmbeddedModule:
    """Multi-tenant agent backend (tenants, runs, actions, knowledge, skills, usage)."""

    def __init__(self, client: "Cencori") -> None:
        self.tenants = TenantsModule(client)
        self.runs = RunsModule(client)
        self.actions = ActionsModule(client)
        self.knowledge = KnowledgeModule(client)
        self.skills = SkillsModule(client)
        self.usage = UsageModule(client)
        self.client_tokens = ClientTokensModule(client)
        self.models = ModelsModule(client)
        self.provider_connections = ProviderConnectionsModule(client)
        self.agent_versions = AgentVersionsModule(client)
        self.installations = InstallationsModule(client)
        self.connections = ToolConnectionsModule(client)
        self.mcp_servers = McpServersModule(client)
        self.webhooks = WebhooksModule(client)
        self.end_users = EndUsersModule(client)
        self.rate_plans = RatePlansModule(client)


class ClientTokensModule:
    """Short-lived browser-safe tokens."""

    def __init__(self, client: "Cencori") -> None:
        self._client = client

    def mint(self, tenant_id: str, external_user_id: str, **kwargs: Any) -> Dict[str, Any]:
        """Mint a 15-minute token (secret-key only)."""
        return self._client._request("POST", "/v1/client-tokens", json={"tenant_id": tenant_id, "external_user_id": external_user_id, **kwargs})


class ModelsModule:
    """Unified model registry (only discovery surface)."""

    def __init__(self, client: "Cencori") -> None:
        self._client = client

    def list(self, available: Optional[bool] = None, provider: Optional[str] = None, source: Optional[str] = None) -> Dict[str, Any]:
        """List models with availability metadata."""
        path = "/v1/models"
        query = []
        if available is not None:
            query.append(f"available={'true' if available else 'false'}")
        if provider:
            query.append(f"provider={provider}")
        if source:
            query.append(f"source={source}")
        if query:
            path += "?" + "&".join(query)
        return self._client._request("GET", path)


class ProviderConnectionsModule:
    """BYOK and OpenAI-compatible provider management plus model sync."""

    def __init__(self, client: "Cencori") -> None:
        self._client = client

    def create(self, name: str, provider: str, idempotency_key: Optional[str] = None, **kwargs: Any) -> Dict[str, Any]:
        """Create a provider connection."""
        headers = {"Idempotency-Key": idempotency_key} if idempotency_key else None
        return self._client._request("POST", "/v1/provider-connections", json={"name": name, "provider": provider, **kwargs}, headers=headers)

    def list(self) -> Dict[str, Any]:
        """List provider connections."""
        return self._client._request("GET", "/v1/provider-connections")

    def validate(self, provider: str, **kwargs: Any) -> Dict[str, Any]:
        """Ephemeral validation without persisting."""
        return self._client._request("POST", "/v1/provider-connections/validate", json={"provider": provider, **kwargs})

    def test(self, connection_id: str) -> Dict[str, Any]:
        """Test a saved connection."""
        return self._client._request("POST", f"/v1/provider-connections/{connection_id}/test", json={})

    def preview_sync(self, connection_id: str) -> Dict[str, Any]:
        """Preview an upstream model sync."""
        return self._client._request("POST", f"/v1/provider-connections/{connection_id}/model-syncs", json={})

    def apply_sync(self, connection_id: str, sync_id: str, idempotency_key: Optional[str] = None) -> Dict[str, Any]:
        """Apply an exact sync preview."""
        headers = {"Idempotency-Key": idempotency_key} if idempotency_key else None
        return self._client._request("POST", f"/v1/provider-connections/{connection_id}/model-syncs/{sync_id}/apply", json={}, headers=headers)


class AgentVersionsModule:
    """Draft, validate, test, review, publish lifecycle."""

    def __init__(self, client: "Cencori") -> None:
        self._client = client

    def create(self, agent_id: str, version: str, **kwargs: Any) -> Dict[str, Any]:
        """Draft a version."""
        return self._client._request("POST", f"/v1/agents/{agent_id}/versions", json={"version": version, **kwargs})

    def list(self, agent_id: str, status: Optional[str] = None) -> Dict[str, Any]:
        """List versions."""
        path = f"/v1/agents/{agent_id}/versions"
        if status:
            path += f"?status={status}"
        return self._client._request("GET", path)

    def get(self, agent_id: str, version: str) -> Dict[str, Any]:
        """Get a version."""
        return self._client._request("GET", f"/v1/agents/{agent_id}/versions/{version}")

    def validate(self, agent_id: str, version: str) -> Dict[str, Any]:
        """Validate manifest and capabilities."""
        return self._client._request("POST", f"/v1/agents/{agent_id}/versions/{version}/validate", json={})

    def test(self, agent_id: str, version: str, input: Optional[str] = None, test_connection_ids: Optional[List[str]] = None) -> Dict[str, Any]:
        """Sandboxed model test with dependency readiness checks; stores test evidence."""
        body: Dict[str, Any] = {}
        if input:
            body["input"] = input
        if test_connection_ids is not None:
            body["test_connection_ids"] = test_connection_ids
        return self._client._request("POST", f"/v1/agents/{agent_id}/versions/{version}/test", json=body)

    def submit(self, agent_id: str, version: str) -> Dict[str, Any]:
        """Submit for review."""
        return self._client._request("POST", f"/v1/agents/{agent_id}/versions/{version}/submit", json={})

    def review(self, agent_id: str, version: str, decision: str, **kwargs: Any) -> Dict[str, Any]:
        """Review (approve → published, reject → draft)."""
        return self._client._request("POST", f"/v1/agents/{agent_id}/versions/{version}/review", json={"decision": decision, **kwargs})

    def publish(self, agent_id: str, version: str) -> Dict[str, Any]:
        """Publish (self-serve fast path)."""
        return self._client._request("POST", f"/v1/agents/{agent_id}/versions/{version}/publish", json={})

    def deprecate(self, agent_id: str, version: str) -> Dict[str, Any]:
        """Deprecate a version."""
        return self._client._request("POST", f"/v1/agents/{agent_id}/versions/{version}/deprecate", json={})

    def retire(self, agent_id: str, version: str) -> Dict[str, Any]:
        """Retire a version."""
        return self._client._request("POST", f"/v1/agents/{agent_id}/versions/{version}/retire", json={})

    def catalog(self, visibility: Optional[str] = None) -> Dict[str, Any]:
        """Published catalog (default public + unlisted)."""
        path = "/v1/agent-catalog"
        if visibility:
            path += f"?visibility={visibility}"
        return self._client._request("GET", path)


class InstallationsModule:
    """Tenant-scoped agent installations with upgrade/rollback."""

    def __init__(self, client: "Cencori") -> None:
        self._client = client

    def create(self, tenant_id: str, agent_id: str, **kwargs: Any) -> Dict[str, Any]:
        """Install an agent for a tenant."""
        return self._client._request("POST", "/v1/agent-installations", json={"tenant_id": tenant_id, "agent_id": agent_id, **kwargs})

    def list(self, tenant_id: Optional[str] = None) -> Dict[str, Any]:
        """List installations."""
        path = "/v1/agent-installations"
        if tenant_id:
            path += f"?tenant_id={tenant_id}"
        return self._client._request("GET", path)

    def get(self, installation_id: str) -> Dict[str, Any]:
        """Get an installation."""
        return self._client._request("GET", f"/v1/agent-installations/{installation_id}")

    def upgrade(self, installation_id: str, version: Optional[str] = None) -> Dict[str, Any]:
        """Upgrade to an explicit or latest stable version."""
        return self._client._request("POST", f"/v1/agent-installations/{installation_id}/upgrade", json={"version": version} if version else {})

    def rollback(self, installation_id: str) -> Dict[str, Any]:
        """Roll back to the previous version."""
        return self._client._request("POST", f"/v1/agent-installations/{installation_id}/rollback", json={})


class ToolConnectionsModule:
    """Tenant/user-owned credentialed tool connections plus MCP registry."""

    def __init__(self, client: "Cencori") -> None:
        self._client = client

    def create(self, connector: str = "gmail", **kwargs: Any) -> Dict[str, Any]:
        """Create a connection (secret-key only)."""
        return self._client._request("POST", "/v1/connections", json={"connector": connector, **kwargs})

    def list(self, tenant_id: Optional[str] = None) -> Dict[str, Any]:
        """List connections (no secrets)."""
        path = "/v1/connections"
        if tenant_id:
            path += f"?tenant_id={tenant_id}"
        return self._client._request("GET", path)

    def authorize(self, connection_id: str, **kwargs: Any) -> Dict[str, Any]:
        """Start OAuth consent (returns authorize_url)."""
        return self._client._request("POST", f"/v1/connections/{connection_id}/authorize", json=kwargs)

    def test(self, connection_id: str) -> Dict[str, Any]:
        """Health check."""
        return self._client._request("POST", f"/v1/connections/{connection_id}/test", json={})

    def refresh(self, connection_id: str) -> Dict[str, Any]:
        """Rotate the access token."""
        return self._client._request("POST", f"/v1/connections/{connection_id}/refresh", json={})


class McpServersModule:
    """Remote MCP server registry with discovery."""

    def __init__(self, client: "Cencori") -> None:
        self._client = client

    def list(self, tenant_id: Optional[str] = None) -> Dict[str, Any]:
        """List registered servers."""
        path = "/v1/mcp/servers"
        if tenant_id:
            path += f"?tenant_id={tenant_id}"
        return self._client._request("GET", path)

    def get(self, server_id: str) -> Dict[str, Any]:
        """Get a server."""
        return self._client._request("GET", f"/v1/mcp/servers/{server_id}")

    def register(self, name: str, url: str, **kwargs: Any) -> Dict[str, Any]:
        """Register and discover."""
        return self._client._request("POST", "/v1/mcp/servers", json={"name": name, "url": url, **kwargs})

    def update(self, server_id: str, **kwargs: Any) -> Dict[str, Any]:
        """Update a server."""
        return self._client._request("PATCH", f"/v1/mcp/servers/{server_id}", json=kwargs)

    def remove(self, server_id: str) -> Dict[str, Any]:
        """Disable a server."""
        return self._client._request("DELETE", f"/v1/mcp/servers/{server_id}")

    def test(self, server_id: str) -> Dict[str, Any]:
        """Live handshake probe."""
        return self._client._request("POST", f"/v1/mcp/servers/{server_id}/test", json={})

    def tools(self, server_id: str) -> Dict[str, Any]:
        """Stored tool snapshot."""
        return self._client._request("GET", f"/v1/mcp/servers/{server_id}/tools")

    def refresh_tools(self, server_id: str) -> Dict[str, Any]:
        """Re-discover with diff."""
        return self._client._request("POST", f"/v1/mcp/servers/{server_id}/refresh-tools", json={})


class WebhooksModule:
    """Signed subscriptions with delivery log and replay."""

    def __init__(self, client: "Cencori") -> None:
        self._client = client

    def create(self, name: str, url: str, events: Optional[List[str]] = None) -> Dict[str, Any]:
        """Subscribe."""
        return self._client._request("POST", "/v1/webhooks", json={"name": name, "url": url, "events": events or ["run.completed"]})

    def list(self) -> Dict[str, Any]:
        """List subscriptions."""
        return self._client._request("GET", "/v1/webhooks")

    def update(self, webhook_id: str, **kwargs: Any) -> Dict[str, Any]:
        """Update a subscription."""
        return self._client._request("PATCH", f"/v1/webhooks/{webhook_id}", json=kwargs)

    def remove(self, webhook_id: str) -> Dict[str, Any]:
        """Delete a subscription."""
        return self._client._request("DELETE", f"/v1/webhooks/{webhook_id}")

    def deliveries(self) -> Dict[str, Any]:
        """Delivery log."""
        return self._client._request("GET", "/v1/webhook-deliveries")

    def replay(self, delivery_id: str) -> Dict[str, Any]:
        """Replay a delivery."""
        return self._client._request("POST", f"/v1/webhook-deliveries/{delivery_id}/replay", json={})


class EndUsersModule:
    """End-user directory (secret-key administration)."""

    def __init__(self, client: "Cencori") -> None:
        self._client = client

    def list(self, limit: int = 20) -> Dict[str, Any]:
        """List end users."""
        return self._client._request("GET", f"/v1/end-users?limit={limit}")

    def upsert(self, external_id: str, **kwargs: Any) -> Dict[str, Any]:
        """Upsert by external_id."""
        return self._client._request("POST", "/v1/end-users", json={"external_id": external_id, **kwargs})


class RatePlansModule:
    """Rate-plan administration (secret-key)."""

    def __init__(self, client: "Cencori") -> None:
        self._client = client

    def list(self) -> Dict[str, Any]:
        """List rate plans."""
        return self._client._request("GET", "/v1/rate-plans")

    def create(self, name: str, **kwargs: Any) -> Dict[str, Any]:
        """Create a rate plan."""
        return self._client._request("POST", "/v1/rate-plans", json={"name": name, **kwargs})
