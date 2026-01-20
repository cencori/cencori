"""AI module for chat completions, embeddings, and streaming."""

import json
from typing import Any, Dict, Iterator, List, Optional, Union, TYPE_CHECKING

import httpx

from .errors import AuthenticationError, CencoriError, RateLimitError, SafetyError
from .types import ChatResponse, StreamChunk, Usage, EmbeddingResponse, EmbeddingUsage

if TYPE_CHECKING:
    from .client import Cencori


class AIModule:
    """
    AI module for chat completions, embeddings, and streaming.
    
    Provides access to OpenAI, Anthropic, and Google models through
    Cencori's unified API with built-in security, logging, and cost tracking.
    """
    
    def __init__(self, client: "Cencori") -> None:
        self._client = client
    
    # =========================================================================
    # Chat Methods
    # =========================================================================
    
    def chat(
        self,
        messages: List[Dict[str, str]],
        model: str = "gemini-2.5-flash",
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        user_id: Optional[str] = None,
    ) -> ChatResponse:
        """
        Send a chat completion request (non-streaming).
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            model: AI model to use (default: gemini-2.5-flash)
            temperature: Sampling temperature (0-1)
            max_tokens: Maximum tokens in response
            user_id: Optional user ID for rate limiting
            
        Returns:
            ChatResponse with content, usage, and cost
            
        Raises:
            AuthenticationError: Invalid API key
            RateLimitError: Rate limit exceeded
            SafetyError: Content blocked by safety filters
            
        Example:
            >>> response = cencori.ai.chat(
            ...     messages=[{"role": "user", "content": "Hello!"}],
            ...     model="gpt-4o"
            ... )
            >>> print(response.content)
        """
        payload: Dict[str, Any] = {
            "messages": messages,
            "model": model,
            "stream": False,
        }
        
        if temperature is not None:
            payload["temperature"] = temperature
        if max_tokens is not None:
            payload["maxTokens"] = max_tokens
        if user_id is not None:
            payload["userId"] = user_id
        
        data = self._client._request("POST", "/api/ai/chat", json=payload)
        
        return ChatResponse(
            content=data["content"],
            model=data["model"],
            provider=data["provider"],
            usage=Usage(
                prompt_tokens=data["usage"]["prompt_tokens"],
                completion_tokens=data["usage"]["completion_tokens"],
                total_tokens=data["usage"]["total_tokens"],
            ),
            cost_usd=data["cost_usd"],
            finish_reason=data["finish_reason"],
        )
    
    def chat_stream(
        self,
        messages: List[Dict[str, str]],
        model: str = "gemini-2.5-flash",
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        user_id: Optional[str] = None,
    ) -> Iterator[StreamChunk]:
        """
        Send a chat completion request with streaming.
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            model: AI model to use (default: gemini-2.5-flash)
            temperature: Sampling temperature (0-1)
            max_tokens: Maximum tokens in response
            user_id: Optional user ID for rate limiting
            
        Yields:
            StreamChunk objects with delta text
            
        Raises:
            AuthenticationError: Invalid API key
            RateLimitError: Rate limit exceeded
            SafetyError: Content blocked by safety filters
            
        Example:
            >>> for chunk in cencori.ai.chat_stream(
            ...     messages=[{"role": "user", "content": "Tell me a story"}]
            ... ):
            ...     print(chunk.delta, end="", flush=True)
        """
        payload: Dict[str, Any] = {
            "messages": messages,
            "model": model,
            "stream": True,
        }
        
        if temperature is not None:
            payload["temperature"] = temperature
        if max_tokens is not None:
            payload["maxTokens"] = max_tokens
        if user_id is not None:
            payload["userId"] = user_id
        
        url = f"{self._client._base_url}/api/ai/chat"
        headers = {
            "Content-Type": "application/json",
            "CENCORI_API_KEY": self._client._api_key,
        }
        
        with httpx.Client(timeout=60.0) as http_client:
            with http_client.stream("POST", url, json=payload, headers=headers) as response:
                if response.status_code == 401:
                    raise AuthenticationError()
                if response.status_code == 429:
                    raise RateLimitError()
                if not response.is_success:
                    raise CencoriError(f"Request failed with status {response.status_code}")
                
                for line in response.iter_lines():
                    if not line or not line.startswith("data: "):
                        continue
                    
                    data_str = line[6:]  # Remove "data: " prefix
                    
                    if data_str == "[DONE]":
                        return
                    
                    try:
                        data = json.loads(data_str)
                        
                        # Check for error in stream
                        if "error" in data:
                            yield StreamChunk(
                                delta="",
                                error=data.get("error"),
                            )
                            return
                        
                        yield StreamChunk(
                            delta=data.get("delta", ""),
                            finish_reason=data.get("finish_reason"),
                        )
                    except json.JSONDecodeError:
                        continue
    
    # =========================================================================
    # Completions Method
    # =========================================================================
    
    def completions(
        self,
        prompt: str,
        model: str = "gemini-2.5-flash",
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> ChatResponse:
        """
        Create a text completion (wraps chat internally).
        
        Args:
            prompt: The text prompt to complete
            model: AI model to use (default: gemini-2.5-flash)
            temperature: Sampling temperature (0-1)
            max_tokens: Maximum tokens in response
            
        Returns:
            ChatResponse with the completion
            
        Example:
            >>> response = cencori.ai.completions(
            ...     prompt="Write a haiku about coding",
            ...     model="gpt-4o"
            ... )
            >>> print(response.content)
        """
        return self.chat(
            messages=[{"role": "user", "content": prompt}],
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
        )
    
    # =========================================================================
    # Embeddings Method
    # =========================================================================
    
    def embeddings(
        self,
        input: Union[str, List[str]],
        model: str = "text-embedding-3-small",
    ) -> EmbeddingResponse:
        """
        Generate embeddings for text.
        
        Args:
            input: Text or list of texts to embed
            model: Embedding model to use (default: text-embedding-3-small)
            
        Returns:
            EmbeddingResponse with embeddings and usage
            
        Example:
            >>> response = cencori.ai.embeddings(
            ...     input="Hello world",
            ...     model="text-embedding-3-small"
            ... )
            >>> print(len(response.embeddings[0]))  # Embedding dimension
        """
        payload: Dict[str, Any] = {
            "input": input,
            "model": model,
        }
        
        data = self._client._request("POST", "/api/v1/embeddings", json=payload)
        
        # Extract embeddings from response
        embeddings = [item["embedding"] for item in data.get("data", [])]
        
        return EmbeddingResponse(
            model=data.get("model", model),
            embeddings=embeddings,
            usage=EmbeddingUsage(
                total_tokens=data.get("usage", {}).get("total_tokens", 0),
            ),
        )
    
    # =========================================================================
    # Async Methods
    # =========================================================================
    
    async def async_chat(
        self,
        messages: List[Dict[str, str]],
        model: str = "gemini-2.5-flash",
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        user_id: Optional[str] = None,
    ) -> ChatResponse:
        """
        Send a chat completion request asynchronously.
        
        Same as chat() but async.
        """
        payload: Dict[str, Any] = {
            "messages": messages,
            "model": model,
            "stream": False,
        }
        
        if temperature is not None:
            payload["temperature"] = temperature
        if max_tokens is not None:
            payload["maxTokens"] = max_tokens
        if user_id is not None:
            payload["userId"] = user_id
        
        data = await self._client._async_request("POST", "/api/ai/chat", json=payload)
        
        return ChatResponse(
            content=data["content"],
            model=data["model"],
            provider=data["provider"],
            usage=Usage(
                prompt_tokens=data["usage"]["prompt_tokens"],
                completion_tokens=data["usage"]["completion_tokens"],
                total_tokens=data["usage"]["total_tokens"],
            ),
            cost_usd=data["cost_usd"],
            finish_reason=data["finish_reason"],
        )
    
    async def async_completions(
        self,
        prompt: str,
        model: str = "gemini-2.5-flash",
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> ChatResponse:
        """
        Create a text completion asynchronously.
        
        Same as completions() but async.
        """
        return await self.async_chat(
            messages=[{"role": "user", "content": prompt}],
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
        )
    
    async def async_embeddings(
        self,
        input: Union[str, List[str]],
        model: str = "text-embedding-3-small",
    ) -> EmbeddingResponse:
        """
        Generate embeddings asynchronously.
        
        Same as embeddings() but async.
        """
        payload: Dict[str, Any] = {
            "input": input,
            "model": model,
        }
        
        data = await self._client._async_request("POST", "/api/v1/embeddings", json=payload)
        
        embeddings = [item["embedding"] for item in data.get("data", [])]
        
        return EmbeddingResponse(
            model=data.get("model", model),
            embeddings=embeddings,
            usage=EmbeddingUsage(
                total_tokens=data.get("usage", {}).get("total_tokens", 0),
            ),
        )
