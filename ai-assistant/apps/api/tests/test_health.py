"""
Tests for health check endpoints.
"""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    """Create test client."""
    from apps.api.main import app
    return TestClient(app)


def test_healthz(client):
    """Test liveness probe."""
    response = client.get("/healthz")
    assert response.status_code == 200
    
    data = response.json()
    assert data["status"] == "healthy"
    assert "uptime_seconds" in data


def test_readyz(client):
    """Test readiness probe."""
    response = client.get("/readyz")
    assert response.status_code == 200
    
    data = response.json()
    assert data["status"] in ["ready", "not_ready"]
    assert "checks" in data


def test_root(client):
    """Test API root."""
    response = client.get("/")
    assert response.status_code == 200
    
    data = response.json()
    assert data["service"] == "SubstrateOS AI Assistant"
    assert "version" in data


def test_metrics(client):
    """Test metrics endpoint."""
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "api_requests_total" in response.text
