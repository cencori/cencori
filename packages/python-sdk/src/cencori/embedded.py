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

    def delegate(self, run_id: str, agent_version_id: str, payload: Optional[Dict[str, Any]] = None, idempotency_key: Optional[str] = None) -> Dict[str, Any]:
        """Delegate one bounded task to an allowed subagent version."""
        body: Dict[str, Any] = {"agent_version_id": agent_version_id, "input": payload or {}}
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

    def stage_import(self, url: Optional[str] = None, repository: Optional[str] = None, text: Optional[str] = None) -> Dict[str, Any]:
        """Stage an import (exactly one source)."""
        payload = {k: v for k, v in {"url": url, "repository": repository, "text": text}.items() if v is not None}
        return self._client._request("POST", "/v1/skill-imports", json=payload)

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
