"""
Tests for chat endpoint.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.fixture
def mock_llm_response():
    """Mock LLM response."""
    response = MagicMock()
    response.model = "gpt-4o-mini"
    response.content = "Use `ls` to list files."
    response.usage = {
        "prompt_tokens": 100,
        "completion_tokens": 50,
        "total_tokens": 150
    }
    response.finish_reason = "stop"
    return response


class TestChatEndpoint:
    """Tests for /v1/chat endpoint."""
    
    @pytest.mark.asyncio
    async def test_chat_request_validation(self):
        """Test request validation."""
        from apps.api.routers.chat import ChatRequest, Message
        
        # Valid request
        request = ChatRequest(
            messages=[Message(role="user", content="How do I list files?")],
            stream=False
        )
        assert len(request.messages) == 1
        assert request.temperature == 0.7
    
    @pytest.mark.asyncio
    async def test_chat_request_invalid_role(self):
        """Test invalid message role rejected."""
        from apps.api.routers.chat import Message
        from pydantic import ValidationError
        
        with pytest.raises(ValidationError):
            Message(role="invalid", content="test")
    
    @pytest.mark.asyncio
    async def test_chat_request_empty_content(self):
        """Test empty content rejected."""
        from apps.api.routers.chat import Message
        from pydantic import ValidationError
        
        with pytest.raises(ValidationError):
            Message(role="user", content="")
    
    @pytest.mark.asyncio
    async def test_chat_request_max_length(self):
        """Test content length limit."""
        from apps.api.routers.chat import Message
        from pydantic import ValidationError
        
        long_content = "x" * 5000  # Exceeds 4000 limit
        with pytest.raises(ValidationError):
            Message(role="user", content=long_content)


class TestChatResponse:
    """Tests for chat response handling."""
    
    def test_response_model(self):
        """Test response model structure."""
        from apps.api.routers.chat import ChatResponse
        
        response = ChatResponse(
            id="test-123",
            model="gpt-4o-mini",
            content="Use ls command",
            usage={"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
            sources=None,
            prompt_version="v1"
        )
        
        assert response.id == "test-123"
        assert response.content == "Use ls command"
