"""AI module for chat completions."""

import json
from typing import Any, Dict, Iterator, List, Optional, Union

import httpx

from .errors import AuthenticationError, CencoriError, RateLimitError, SafetyError
from .types import ChatResponse, StreamChunk, Usage


class AIModule:
    """AI module for chat completions."""
    
    def __init__(self, client: "Cencori") -> None:  # type: ignore[name-defined]
        self._client = client
    
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
                        yield StreamChunk(
                            delta=data.get("delta", ""),
                            finish_reason=data.get("finish_reason"),
                        )
                    except json.JSONDecodeError:
                        continue
