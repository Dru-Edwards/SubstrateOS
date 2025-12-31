"""
Rate limiting middleware using token bucket algorithm.
"""

import os
import time
from collections import defaultdict
from typing import Callable

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = structlog.get_logger()


class TokenBucket:
    """Simple in-memory token bucket for rate limiting."""
    
    def __init__(self, capacity: int, refill_rate: float):
        self.capacity = capacity
        self.refill_rate = refill_rate  # tokens per second
        self.tokens = capacity
        self.last_refill = time.time()
    
    def consume(self, tokens: int = 1) -> bool:
        """Try to consume tokens. Returns True if successful."""
        self._refill()
        if self.tokens >= tokens:
            self.tokens -= tokens
            return True
        return False
    
    def _refill(self):
        now = time.time()
        elapsed = now - self.last_refill
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
        self.last_refill = now


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware.
    
    Limits requests per client (by IP or API key).
    """
    
    def __init__(self, app):
        super().__init__(app)
        self.requests_limit = int(os.getenv("RATE_LIMIT_REQUESTS", 100))
        self.window_seconds = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", 60))
        self.refill_rate = self.requests_limit / self.window_seconds
        
        # Per-client buckets
        self.buckets: dict[str, TokenBucket] = defaultdict(
            lambda: TokenBucket(self.requests_limit, self.refill_rate)
        )
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Get client identifier (prefer API key over IP)
        client_id = getattr(request.state, "api_key", None)
        if not client_id:
            client_id = request.client.host if request.client else "unknown"
        
        bucket = self.buckets[client_id]
        
        if not bucket.consume():
            logger.warning(
                "Rate limit exceeded",
                client_id=client_id[:20] + "..." if len(client_id) > 20 else client_id,
                path=request.url.path
            )
            return Response(
                content='{"error": "rate_limited", "message": "Too many requests"}',
                status_code=429,
                media_type="application/json",
                headers={
                    "Retry-After": str(int(1 / self.refill_rate)),
                    "X-RateLimit-Limit": str(self.requests_limit),
                    "X-RateLimit-Remaining": "0"
                }
            )
        
        response = await call_next(request)
        
        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(self.requests_limit)
        response.headers["X-RateLimit-Remaining"] = str(int(bucket.tokens))
        
        return response
