"""
Structured logging middleware with trace IDs.
"""

import os
import uuid
from typing import Callable

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = structlog.get_logger()

# PII patterns for redaction
PII_REDACTION_ENABLED = os.getenv("PII_REDACTION_ENABLED", "true").lower() == "true"


class LoggingMiddleware(BaseHTTPMiddleware):
    """
    Structured logging middleware.
    
    - Generates trace IDs for request tracking
    - Logs request/response metadata
    - Redacts PII from logs if enabled
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate trace ID
        trace_id = request.headers.get("X-Trace-ID", str(uuid.uuid4())[:8])
        request.state.trace_id = trace_id
        
        # Bind trace ID to logger context
        structlog.contextvars.bind_contextvars(trace_id=trace_id)
        
        # Log request
        logger.info(
            "Request started",
            method=request.method,
            path=request.url.path,
            client_ip=self._redact_ip(request.client.host) if request.client else "unknown",
            user_agent=request.headers.get("User-Agent", "")[:100]
        )
        
        # Process request
        response = await call_next(request)
        
        # Log response
        logger.info(
            "Request completed",
            status_code=response.status_code,
            content_length=response.headers.get("Content-Length", "unknown")
        )
        
        # Add trace ID to response
        response.headers["X-Trace-ID"] = trace_id
        
        # Clear context
        structlog.contextvars.unbind_contextvars("trace_id")
        
        return response
    
    def _redact_ip(self, ip: str) -> str:
        """Redact IP address for PII compliance."""
        if not PII_REDACTION_ENABLED:
            return ip
        
        if "." in ip:  # IPv4
            parts = ip.split(".")
            return f"{parts[0]}.{parts[1]}.xxx.xxx"
        elif ":" in ip:  # IPv6
            return ip[:10] + "::xxxx"
        return ip
