"""Tests for the Embedded Agents module."""

from unittest.mock import patch

from cencori import Cencori


class TestEmbeddedTenants:
    """Test tenant operations."""

    def test_create_tenant(self, api_key: str) -> None:
        """Test tenant creation."""
        client = Cencori(api_key=api_key)

        with patch.object(client, "_request", return_value={"id": "ten_123", "external_id": "company_123"}) as mock:
            result = client.embedded.tenants.create("company_123", "Acme Ltd", idempotency_key="tenant-acme-v1")

            assert result["id"] == "ten_123"
            mock.assert_called_once()
            args, kwargs = mock.call_args
            assert args[0] == "POST"
            assert args[1] == "/v1/tenants"
            assert kwargs["headers"] == {"Idempotency-Key": "tenant-acme-v1"}

    def test_upsert_user(self, api_key: str) -> None:
        """Test user upsert."""
        client = Cencori(api_key=api_key)

        with patch.object(client, "_request", return_value={"external_id": "u1"}) as mock:
            client.embedded.tenants.upsert_user("ten_123", "u1", display_name="Ada")

            args, _ = mock.call_args
            assert args[1] == "/v1/tenants/ten_123/users/u1"


class TestEmbeddedRuns:
    """Test run operations."""

    def test_create_run(self, api_key: str) -> None:
        """Test background run creation."""
        client = Cencori(api_key=api_key)

        with patch.object(client, "_request", return_value={"id": "run_123", "status": "queued"}) as mock:
            result = client.embedded.runs.create("agt_1", {"mode": "background", "input": {}}, idempotency_key="k1")

            assert result["status"] == "queued"
            args, kwargs = mock.call_args
            assert args[1] == "/v1/agents/agt_1/runs"
            assert kwargs["headers"] == {"Idempotency-Key": "k1"}

    def test_delegate(self, api_key: str) -> None:
        """Test subagent delegation."""
        client = Cencori(api_key=api_key)

        with patch.object(client, "_request", return_value={"child_run_id": "run_456"}) as mock:
            client.embedded.runs.delegate("run_123", "agv_1", {"task": "research"})

            args, _ = mock.call_args
            assert args[1] == "/v1/runs/run_123/delegate"


class TestEmbeddedActions:
    """Test action approvals."""

    def test_approve(self, api_key: str) -> None:
        """Test action approval."""
        client = Cencori(api_key=api_key)

        with patch.object(client, "_request", return_value={"status": "executed"}) as mock:
            result = client.embedded.actions.approve("act_123")

            assert result["status"] == "executed"
            args, _ = mock.call_args
            assert args[1] == "/v1/actions/act_123/approve"


class TestEmbeddedSkills:
    """Test skill operations."""

    def test_stage_and_publish_import(self, api_key: str) -> None:
        """Test import staging and publish."""
        client = Cencori(api_key=api_key)

        with patch.object(client, "_request", return_value={"id": "imp_1", "status": "ready_for_review"}) as mock:
            client.embedded.skills.stage_import(text="# Guide")

            args, kwargs = mock.call_args
            assert args[1] == "/v1/skill-imports"
            assert kwargs["json"] == {"text": "# Guide"}

        with patch.object(client, "_request", return_value={"status": "published"}) as mock:
            client.embedded.skills.publish_import("imp_1", name="Guide")

            args, _ = mock.call_args
            assert args[1] == "/v1/skill-imports/imp_1/publish"


class TestEmbeddedUsage:
    """Test usage reporting."""

    def test_summary(self, api_key: str) -> None:
        """Test usage summary."""
        client = Cencori(api_key=api_key)

        with patch.object(client, "_request", return_value={"totals": {}, "groups": []}) as mock:
            client.embedded.usage.summary(days=7, tenant_id="ten_1")

            args, _ = mock.call_args
            assert "days=7" in args[1] and "tenant_id=ten_1" in args[1]
