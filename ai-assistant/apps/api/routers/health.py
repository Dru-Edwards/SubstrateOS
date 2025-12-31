"""
Health check endpoints for Kubernetes/Docker health probes.
"""

from fastapi import APIRouter, Response
from pydantic import BaseModel
import time

router = APIRouter()

START_TIME = time.time()


class HealthResponse(BaseModel):
    status: str
    uptime_seconds: float
    version: str = "1.0.0"


class ReadyResponse(BaseModel):
    status: str
    checks: dict[str, bool]


@router.get("/healthz", response_model=HealthResponse)
async def health_check():
    """
    Liveness probe - indicates the application is running.
    Returns 200 if the process is alive.
    """
    return HealthResponse(
        status="healthy",
        uptime_seconds=time.time() - START_TIME
    )


@router.get("/readyz", response_model=ReadyResponse)
async def readiness_check():
    """
    Readiness probe - indicates the application is ready to serve traffic.
    Checks dependencies like database, vector store, etc.
    """
    checks = {
        "api": True,
        "llm_client": True,  # TODO: Add actual health check
        "vector_store": True,  # TODO: Add actual health check
    }
    
    all_ready = all(checks.values())
    
    return ReadyResponse(
        status="ready" if all_ready else "not_ready",
        checks=checks
    )


@router.get("/")
async def root():
    """API root - basic info."""
    return {
        "service": "SubstrateOS AI Assistant",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/healthz",
        "ready": "/readyz"
    }
