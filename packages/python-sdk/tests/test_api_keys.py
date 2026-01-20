
import pytest
from unittest.mock import MagicMock
from cencori.api_keys import APIKeysModule
from cencori.types import CreateAPIKeyParams

@pytest.fixture
def mock_client():
    client = MagicMock()
    client._request = MagicMock()
    return client

def test_list_keys(mock_client):
    module = APIKeysModule(mock_client)
    mock_client._request.return_value = {
        "keys": [
            {
                "id": "k1", "name": "Key 1", "environment": "production", 
                "created_at": "now", "prefix": "csk_test"
            }
        ]
    }
    
    keys = module.list("p1", "production")
    
    assert len(keys) == 1
    assert keys[0].id == "k1"
    mock_client._request.assert_called_with("GET", "/api/projects/p1/api-keys?environment=production")

def test_create_key(mock_client):
    module = APIKeysModule(mock_client)
    mock_client._request.return_value = {
        "id": "k1", "name": "New Key", "environment": "production", 
        "created_at": "now", "key": "csk_secret_key"
    }
    
    params = CreateAPIKeyParams(name="New Key", environment="production")
    key = module.create("p1", params)
    
    assert key.key == "csk_secret_key"
    mock_client._request.assert_called_with(
        "POST", 
        "/api/projects/p1/api-keys", 
        json={"name": "New Key", "environment": "production"}
    )

def test_revoke_key(mock_client):
    module = APIKeysModule(mock_client)
    
    module.revoke("p1", "k1")
    
    mock_client._request.assert_called_with("DELETE", "/api/projects/p1/api-keys/k1")

def test_get_stats(mock_client):
    module = APIKeysModule(mock_client)
    mock_client._request.return_value = {
        "key_id": "k1",
        "total_requests": 50,
        "total_cost_usd": 0.5,
        "last_used_at": "now",
        "requests_by_day": [],
        "requests_by_model": {}
    }
    
    stats = module.get_stats("p1", "k1")
    
    assert stats.total_requests == 50
    mock_client._request.assert_called_with("GET", "/api/projects/p1/api-keys/k1/stats")
