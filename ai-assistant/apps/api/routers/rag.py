"""
RAG (Retrieval Augmented Generation) endpoints.
"""

import structlog
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field

logger = structlog.get_logger()

router = APIRouter()


# =============================================================================
# Request/Response Models
# =============================================================================
class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    top_k: int = Field(default=5, ge=1, le=20)
    threshold: float = Field(default=0.0, ge=0.0, le=1.0)
    rerank: bool = True


class RetrievedChunk(BaseModel):
    id: str
    content: str
    score: float
    metadata: dict


class QueryResponse(BaseModel):
    query: str
    chunks: list[RetrievedChunk]
    latency_ms: int


class IngestRequest(BaseModel):
    source: str  # File path or URL
    chunk_size: int = Field(default=512, ge=100, le=2000)
    chunk_overlap: int = Field(default=50, ge=0, le=500)


class IngestResponse(BaseModel):
    status: str
    documents_processed: int
    chunks_created: int
    errors: list[str]


# =============================================================================
# Endpoints
# =============================================================================
@router.post("/rag/query", response_model=QueryResponse)
async def rag_query(request: Request, body: QueryRequest):
    """
    Query the RAG pipeline for relevant documentation.
    """
    import time
    start = time.time()
    
    rag_retriever = request.app.state.rag_retriever
    
    if not rag_retriever:
        raise HTTPException(
            status_code=503,
            detail="RAG not initialized. Run 'make ingest' first."
        )
    
    try:
        results = await rag_retriever.retrieve(
            query=body.query,
            top_k=body.top_k,
            threshold=body.threshold,
            rerank=body.rerank
        )
        
        chunks = [
            RetrievedChunk(
                id=r.id,
                content=r.content,
                score=r.score,
                metadata=r.metadata
            )
            for r in results
        ]
        
        latency_ms = int((time.time() - start) * 1000)
        
        logger.info(
            "RAG query complete",
            query_length=len(body.query),
            results_count=len(chunks),
            latency_ms=latency_ms
        )
        
        return QueryResponse(
            query=body.query,
            chunks=chunks,
            latency_ms=latency_ms
        )
        
    except Exception as e:
        logger.error("RAG query failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rag/ingest", response_model=IngestResponse)
async def rag_ingest(request: Request, body: IngestRequest):
    """
    Ingest documents into the RAG pipeline.
    
    Note: For large corpora, use the CLI: make ingest
    """
    from rag.ingest import ingest_documents
    
    logger.info(
        "Starting document ingestion",
        source=body.source,
        chunk_size=body.chunk_size
    )
    
    try:
        result = await ingest_documents(
            source=body.source,
            chunk_size=body.chunk_size,
            chunk_overlap=body.chunk_overlap
        )
        
        return IngestResponse(
            status="complete",
            documents_processed=result["documents"],
            chunks_created=result["chunks"],
            errors=result.get("errors", [])
        )
        
    except Exception as e:
        logger.error("Ingestion failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/rag/stats")
async def rag_stats(request: Request):
    """
    Get RAG pipeline statistics.
    """
    rag_retriever = request.app.state.rag_retriever
    
    if not rag_retriever:
        return {
            "status": "not_initialized",
            "message": "Run 'make ingest' to initialize"
        }
    
    stats = await rag_retriever.get_stats()
    return {
        "status": "initialized",
        "total_chunks": stats.get("total_chunks", 0),
        "embedding_model": stats.get("embedding_model", "unknown"),
        "vector_dimensions": stats.get("dimensions", 0),
        "last_updated": stats.get("last_updated", None)
    }
