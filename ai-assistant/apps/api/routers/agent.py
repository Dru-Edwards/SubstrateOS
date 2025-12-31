"""
Agent endpoint with tool use capabilities.
"""

import json
import os
from typing import AsyncGenerator

import structlog
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

logger = structlog.get_logger()

router = APIRouter()

# Check if agent is enabled
AGENT_ENABLED = os.getenv("AGENT_ENABLED", "true").lower() == "true"


# =============================================================================
# Request/Response Models
# =============================================================================
class ToolCall(BaseModel):
    name: str
    arguments: dict


class AgentStep(BaseModel):
    step: int
    thought: str
    tool_call: ToolCall | None = None
    tool_result: str | None = None
    final_answer: str | None = None


class AgentRequest(BaseModel):
    task: str = Field(..., min_length=1, max_length=2000)
    context: dict = Field(default_factory=dict)  # Shell state, current dir, etc.
    max_iterations: int = Field(default=10, ge=1, le=20)
    stream: bool = True


class AgentResponse(BaseModel):
    task: str
    steps: list[AgentStep]
    final_answer: str
    tool_calls_count: int
    iterations: int


# =============================================================================
# Available Tools
# =============================================================================
AVAILABLE_TOOLS = {
    "shell_execute": {
        "description": "Execute a shell command in SubstrateOS sandbox",
        "parameters": {
            "command": {"type": "string", "description": "The shell command to execute"}
        }
    },
    "file_read": {
        "description": "Read contents of a file in the virtual filesystem",
        "parameters": {
            "path": {"type": "string", "description": "File path to read"}
        }
    },
    "file_write": {
        "description": "Write content to a file in the virtual filesystem",
        "parameters": {
            "path": {"type": "string", "description": "File path to write"},
            "content": {"type": "string", "description": "Content to write"}
        }
    },
    "search_docs": {
        "description": "Search SubstrateOS documentation for relevant information",
        "parameters": {
            "query": {"type": "string", "description": "Search query"}
        }
    },
    "list_directory": {
        "description": "List files in a directory",
        "parameters": {
            "path": {"type": "string", "description": "Directory path", "default": "."}
        }
    }
}


# =============================================================================
# Endpoints
# =============================================================================
@router.post("/agent/run")
async def run_agent(request: Request, body: AgentRequest):
    """
    Run the AI agent to complete a task.
    
    The agent can use tools to interact with SubstrateOS:
    - Execute shell commands
    - Read/write files
    - Search documentation
    
    Includes guardrails:
    - Max iterations limit
    - Tool execution timeout
    - Sandboxed execution
    """
    if not AGENT_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="Agent is disabled. Set AGENT_ENABLED=true to enable."
        )
    
    trace_id = getattr(request.state, "trace_id", "unknown")
    
    logger.info(
        "Agent task started",
        trace_id=trace_id,
        task_length=len(body.task),
        max_iterations=body.max_iterations
    )
    
    if body.stream:
        return StreamingResponse(
            stream_agent_execution(
                request=request,
                task=body.task,
                context=body.context,
                max_iterations=body.max_iterations,
                trace_id=trace_id
            ),
            media_type="text/event-stream"
        )
    else:
        # Non-streaming execution
        from agent.agent import Agent
        
        agent = Agent(
            llm_client=request.app.state.llm_client,
            prompt_registry=request.app.state.prompt_registry,
            rag_retriever=request.app.state.rag_retriever
        )
        
        result = await agent.run(
            task=body.task,
            context=body.context,
            max_iterations=body.max_iterations
        )
        
        return AgentResponse(
            task=body.task,
            steps=result.steps,
            final_answer=result.final_answer,
            tool_calls_count=result.tool_calls_count,
            iterations=result.iterations
        )


async def stream_agent_execution(
    request: Request,
    task: str,
    context: dict,
    max_iterations: int,
    trace_id: str
) -> AsyncGenerator[str, None]:
    """Stream agent execution steps."""
    from agent.agent import Agent
    
    try:
        agent = Agent(
            llm_client=request.app.state.llm_client,
            prompt_registry=request.app.state.prompt_registry,
            rag_retriever=request.app.state.rag_retriever
        )
        
        async for step in agent.run_stream(
            task=task,
            context=context,
            max_iterations=max_iterations
        ):
            yield f"data: {json.dumps(step.model_dump())}\n\n"
        
        yield f"data: {json.dumps({'done': True})}\n\n"
        
    except Exception as e:
        logger.error("Agent execution failed", trace_id=trace_id, error=str(e))
        yield f"data: {json.dumps({'error': str(e)})}\n\n"


@router.get("/agent/tools")
async def list_tools():
    """
    List available agent tools.
    """
    if not AGENT_ENABLED:
        raise HTTPException(status_code=503, detail="Agent is disabled")
    
    # Filter by allowed tools from config
    allowed = os.getenv("AGENT_ALLOWED_TOOLS", "").split(",")
    if allowed and allowed[0]:
        tools = {k: v for k, v in AVAILABLE_TOOLS.items() if k in allowed}
    else:
        tools = AVAILABLE_TOOLS
    
    return {"tools": tools}


@router.post("/agent/cancel/{task_id}")
async def cancel_agent(task_id: str):
    """
    Cancel a running agent task.
    """
    # TODO: Implement task cancellation with task registry
    logger.info("Agent cancellation requested", task_id=task_id)
    return {"status": "cancellation_requested", "task_id": task_id}
