"""
SubstrateOS AI Assistant API
Production-grade FastAPI application with streaming, RAG, and monitoring.
"""

import os
import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

from apps.api.routers import chat, rag, agent, health
from apps.api.middleware.auth import AuthMiddleware
from apps.api.middleware.rate_limit import RateLimitMiddleware
from apps.api.middleware.logging import LoggingMiddleware
from apps.api.services.prompt_registry import PromptRegistry
from apps.api.services.llm_client import LLMClient
from rag.retrieve import RAGRetriever

# =============================================================================
# Logging Setup
# =============================================================================
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
    logger_factory=structlog.PrintLoggerFactory(),
)
logger = structlog.get_logger()

# =============================================================================
# Metrics
# =============================================================================
REQUEST_COUNT = Counter(
    "api_requests_total",
    "Total API requests",
    ["method", "endpoint", "status"]
)
REQUEST_LATENCY = Histogram(
    "api_request_latency_seconds",
    "Request latency in seconds",
    ["method", "endpoint"]
)
LLM_TOKENS = Counter(
    "llm_tokens_total",
    "Total LLM tokens used",
    ["model", "type"]  # type: prompt | completion
)
RAG_RETRIEVAL = Histogram(
    "rag_retrieval_latency_seconds",
    "RAG retrieval latency"
)

# =============================================================================
# Application State
# =============================================================================
class AppState:
    prompt_registry: PromptRegistry
    llm_client: LLMClient
    rag_retriever: RAGRetriever | None = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """Application startup and shutdown."""
    logger.info("Starting SubstrateOS AI Assistant")
    
    # Initialize services
    app.state.prompt_registry = PromptRegistry("./prompts")
    app.state.llm_client = LLMClient()
    
    # Initialize RAG if vectors exist
    vector_path = os.getenv("VECTOR_STORE_PATH", "./data/vectors")
    if os.path.exists(vector_path):
        app.state.rag_retriever = RAGRetriever(vector_path)
        logger.info("RAG retriever initialized", vector_path=vector_path)
    else:
        app.state.rag_retriever = None
        logger.warning("RAG vectors not found, run 'make ingest' first")
    
    logger.info("Application started successfully")
    yield
    
    # Cleanup
    logger.info("Shutting down application")


# =============================================================================
# FastAPI Application
# =============================================================================
app = FastAPI(
    title="SubstrateOS AI Assistant",
    description="AI-powered shell assistant with RAG and agent capabilities",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# =============================================================================
# Middleware (order matters - last added = first executed)
# =============================================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom middleware
app.add_middleware(LoggingMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(AuthMiddleware)


# =============================================================================
# Request Metrics Middleware
# =============================================================================
@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    
    # Record metrics
    endpoint = request.url.path
    REQUEST_COUNT.labels(
        method=request.method,
        endpoint=endpoint,
        status=response.status_code
    ).inc()
    REQUEST_LATENCY.labels(
        method=request.method,
        endpoint=endpoint
    ).observe(duration)
    
    # Add timing header
    response.headers["X-Response-Time"] = f"{duration:.3f}s"
    return response


# =============================================================================
# Routes
# =============================================================================
app.include_router(health.router, tags=["Health"])
app.include_router(chat.router, prefix="/v1", tags=["Chat"])
app.include_router(rag.router, prefix="/v1", tags=["RAG"])
app.include_router(agent.router, prefix="/v1", tags=["Agent"])


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint."""
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )


# =============================================================================
# Error Handlers
# =============================================================================
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(
        "Unhandled exception",
        error=str(exc),
        path=request.url.path,
        method=request.method,
        exc_info=True
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_server_error",
            "message": "An unexpected error occurred",
            "trace_id": request.state.trace_id if hasattr(request.state, "trace_id") else None
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.getenv("API_HOST", "0.0.0.0"),
        port=int(os.getenv("API_PORT", 8000)),
        reload=True
    )
