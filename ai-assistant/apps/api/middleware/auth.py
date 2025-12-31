"""
Authentication middleware.
"""

import os
import secrets
from typing import Callable

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = structlog.get_logger()

# Public endpoints that don't require auth
PUBLIC_ENDPOINTS = {"/", "/healthz", "/readyz", "/docs", "/redoc", "/openapi.json"}


class AuthMiddleware(BaseHTTPMiddleware):
    """
    Simple API key authentication middleware.
    
    For production, consider:
    - JWT tokens with refresh
    - OAuth2 integration
    - Rate limiting per API key
    """
    
    def __init__(self, app):
        super().__init__(app)
        self.enabled = os.getenv("API_KEY_ENABLED", "true").lower() == "true"
        self.api_keys = set(
            key.strip() 
            for key in os.getenv("API_KEYS", "").split(",") 
            if key.strip()
        )
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip auth for public endpoints
        if request.url.path in PUBLIC_ENDPOINTS:
            return await call_next(request)
        
        # Skip if auth is disabled
        if not self.enabled:
            return await call_next(request)
        
        # Check for API key
        api_key = request.headers.get("X-API-Key") or request.headers.get("Authorization", "").replace("Bearer ", "")
        
        if not api_key:
            logger.warning(
                "Missing API key",
                path=request.url.path,
                client_ip=request.client.host if request.client else "unknown"
            )
            return Response(
                content='{"error": "unauthorized", "message": "Missing API key"}',
                status_code=401,
                media_type="application/json"
            )
        
        # Validate API key
        if api_key not in self.api_keys:
            logger.warning(
                "Invalid API key",
                path=request.url.path,
                key_prefix=api_key[:8] + "..." if len(api_key) > 8 else "***"
            )
            return Response(
                content='{"error": "forbidden", "message": "Invalid API key"}',
                status_code=403,
                media_type="application/json"
            )
        
        # Add auth info to request state
        request.state.api_key = api_key
        request.state.authenticated = True
        
        return await call_next(request)
