"""
LLM Client - Unified interface for multiple LLM providers.
"""

import os
from dataclasses import dataclass
from typing import AsyncGenerator, List, Dict, Any

import structlog

logger = structlog.get_logger()


@dataclass
class LLMResponse:
    """LLM completion response."""
    model: str
    content: str
    usage: dict[str, int]
    finish_reason: str


class LLMClient:
    """
    Unified LLM client supporting multiple providers.
    
    Providers:
    - OpenAI (GPT-4, GPT-3.5)
    - Anthropic (Claude)
    - Local (Ollama, vLLM)
    """
    
    def __init__(self):
        self.provider = os.getenv("LLM_PROVIDER", "openai")
        self.model = os.getenv("LLM_MODEL", "gpt-4o-mini")
        self.fallback_model = os.getenv("LLM_FALLBACK_MODEL", "gpt-3.5-turbo")
        self.api_key = os.getenv("LLM_API_KEY", "")
        
        # Initialize provider client
        self._client = self._init_client()
        
        logger.info(
            "LLM client initialized",
            provider=self.provider,
            model=self.model
        )
    
    def _init_client(self):
        """Initialize the appropriate provider client."""
        if self.provider == "openai":
            from openai import AsyncOpenAI
            return AsyncOpenAI(api_key=self.api_key)
        elif self.provider == "anthropic":
            from anthropic import AsyncAnthropic
            return AsyncAnthropic(api_key=self.api_key)
        else:
            raise ValueError(f"Unknown provider: {self.provider}")
    
    async def complete(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 1024,
        model: str | None = None
    ) -> LLMResponse:
        """
        Generate a completion.
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            temperature: Sampling temperature (0-2)
            max_tokens: Maximum tokens to generate
            model: Override default model
        
        Returns:
            LLMResponse with content and usage
        """
        model = model or self.model
        
        try:
            if self.provider == "openai":
                response = await self._client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens
                )
                
                return LLMResponse(
                    model=model,
                    content=response.choices[0].message.content or "",
                    usage={
                        "prompt_tokens": response.usage.prompt_tokens,
                        "completion_tokens": response.usage.completion_tokens,
                        "total_tokens": response.usage.total_tokens
                    },
                    finish_reason=response.choices[0].finish_reason
                )
            
            elif self.provider == "anthropic":
                # Convert messages format for Anthropic
                system = next(
                    (m["content"] for m in messages if m["role"] == "system"),
                    None
                )
                anthropic_messages = [
                    {"role": m["role"], "content": m["content"]}
                    for m in messages if m["role"] != "system"
                ]
                
                response = await self._client.messages.create(
                    model=model,
                    max_tokens=max_tokens,
                    system=system or "",
                    messages=anthropic_messages
                )
                
                return LLMResponse(
                    model=model,
                    content=response.content[0].text,
                    usage={
                        "prompt_tokens": response.usage.input_tokens,
                        "completion_tokens": response.usage.output_tokens,
                        "total_tokens": response.usage.input_tokens + response.usage.output_tokens
                    },
                    finish_reason=response.stop_reason
                )
            
        except Exception as e:
            logger.error("LLM completion failed", error=str(e), model=model)
            raise
    
    async def stream(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 1024,
        model: str | None = None
    ) -> AsyncGenerator[str, None]:
        """
        Stream a completion.
        
        Yields content chunks as they're generated.
        """
        model = model or self.model
        
        try:
            if self.provider == "openai":
                stream = await self._client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    stream=True
                )
                
                async for chunk in stream:
                    if chunk.choices[0].delta.content:
                        yield chunk.choices[0].delta.content
            
            elif self.provider == "anthropic":
                system = next(
                    (m["content"] for m in messages if m["role"] == "system"),
                    None
                )
                anthropic_messages = [
                    {"role": m["role"], "content": m["content"]}
                    for m in messages if m["role"] != "system"
                ]
                
                async with self._client.messages.stream(
                    model=model,
                    max_tokens=max_tokens,
                    system=system or "",
                    messages=anthropic_messages
                ) as stream:
                    async for text in stream.text_stream:
                        yield text
        
        except Exception as e:
            logger.error("LLM stream failed", error=str(e), model=model)
            raise
    
    async def count_tokens(self, text: str) -> int:
        """Count tokens in text."""
        import tiktoken
        
        try:
            encoding = tiktoken.encoding_for_model(self.model)
            return len(encoding.encode(text))
        except Exception:
            # Fallback: rough estimate
            return len(text) // 4
