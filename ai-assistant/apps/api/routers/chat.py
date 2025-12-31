"""
Chat endpoint with streaming responses.
"""

import json
import time
from typing import AsyncGenerator

import structlog
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

logger = structlog.get_logger()

router = APIRouter()


# =============================================================================
# Request/Response Models
# =============================================================================
class Message(BaseModel):
    role: str = Field(..., pattern="^(system|user|assistant)$")
    content: str = Field(..., min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    messages: list[Message]
    stream: bool = True
    temperature: float = Field(default=0.7, ge=0, le=2)
    max_tokens: int = Field(default=1024, ge=1, le=4096)
    prompt_version: str | None = None  # Specific prompt version to use
    include_rag: bool = True  # Whether to augment with RAG


class ChatResponse(BaseModel):
    id: str
    model: str
    content: str
    usage: dict[str, int]
    sources: list[dict] | None = None
    prompt_version: str


class StreamChunk(BaseModel):
    id: str
    delta: str
    done: bool = False
    sources: list[dict] | None = None


# =============================================================================
# Endpoints
# =============================================================================
@router.post("/chat")
async def chat(request: Request, body: ChatRequest):
    """
    Chat completion with optional RAG augmentation.
    Supports streaming responses.
    """
    start_time = time.time()
    trace_id = getattr(request.state, "trace_id", "unknown")
    
    logger.info(
        "Chat request received",
        trace_id=trace_id,
        message_count=len(body.messages),
        stream=body.stream,
        include_rag=body.include_rag
    )
    
    # Get services from app state
    prompt_registry = request.app.state.prompt_registry
    llm_client = request.app.state.llm_client
    rag_retriever = request.app.state.rag_retriever
    
    # Load prompt
    prompt_version = body.prompt_version or "latest"
    system_prompt = prompt_registry.get_prompt("shell_assistant", prompt_version)
    
    # Get user's last message
    user_message = body.messages[-1].content if body.messages else ""
    
    # RAG augmentation
    sources = []
    context = ""
    if body.include_rag and rag_retriever:
        try:
            rag_results = await rag_retriever.retrieve(user_message, top_k=5)
            sources = [
                {"id": r.id, "content": r.content[:200], "score": r.score}
                for r in rag_results
            ]
            context = "\n\n".join([r.content for r in rag_results[:3]])
            logger.info("RAG retrieval complete", source_count=len(sources))
        except Exception as e:
            logger.warning("RAG retrieval failed", error=str(e))
    
    # Build messages with context
    messages = [{"role": "system", "content": system_prompt}]
    
    if context:
        messages.append({
            "role": "system",
            "content": f"Relevant documentation:\n{context}"
        })
    
    for msg in body.messages:
        messages.append({"role": msg.role, "content": msg.content})
    
    # Generate response
    if body.stream:
        return StreamingResponse(
            stream_chat_response(
                llm_client=llm_client,
                messages=messages,
                temperature=body.temperature,
                max_tokens=body.max_tokens,
                sources=sources,
                trace_id=trace_id
            ),
            media_type="text/event-stream"
        )
    else:
        # Non-streaming response
        response = await llm_client.complete(
            messages=messages,
            temperature=body.temperature,
            max_tokens=body.max_tokens
        )
        
        latency = time.time() - start_time
        logger.info(
            "Chat response complete",
            trace_id=trace_id,
            latency_ms=int(latency * 1000),
            tokens=response.usage
        )
        
        return ChatResponse(
            id=trace_id,
            model=response.model,
            content=response.content,
            usage=response.usage,
            sources=sources if sources else None,
            prompt_version=prompt_version
        )


async def stream_chat_response(
    llm_client,
    messages: list[dict],
    temperature: float,
    max_tokens: int,
    sources: list[dict],
    trace_id: str
) -> AsyncGenerator[str, None]:
    """Stream chat response as Server-Sent Events."""
    
    try:
        # First chunk with sources
        if sources:
            yield f"data: {json.dumps({'sources': sources})}\n\n"
        
        # Stream LLM response
        async for chunk in llm_client.stream(
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        ):
            yield f"data: {json.dumps({'delta': chunk, 'done': False})}\n\n"
        
        # Final chunk
        yield f"data: {json.dumps({'delta': '', 'done': True})}\n\n"
        
    except Exception as e:
        logger.error("Stream error", trace_id=trace_id, error=str(e))
        yield f"data: {json.dumps({'error': str(e)})}\n\n"


@router.post("/chat/feedback")
async def chat_feedback(request: Request, chat_id: str, rating: int, comment: str = ""):
    """
    Record user feedback for a chat response.
    Used for evaluation and improvement.
    """
    if rating < 1 or rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be 1-5")
    
    logger.info(
        "Chat feedback received",
        chat_id=chat_id,
        rating=rating,
        has_comment=bool(comment)
    )
    
    # TODO: Store feedback in database for analysis
    
    return {"status": "recorded", "chat_id": chat_id}
