"""Type definitions for Cencori SDK."""

from dataclasses import dataclass
from typing import List, Literal, Optional


@dataclass
class Message:
    """A chat message."""
    role: Literal["system", "user", "assistant"]
    content: str


@dataclass
class ChatParams:
    """Parameters for chat completion."""
    messages: List[Message]
    model: str = "gemini-2.5-flash"
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    stream: bool = False
    user_id: Optional[str] = None


@dataclass
class Usage:
    """Token usage statistics."""
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


@dataclass
class ChatResponse:
    """Response from chat completion."""
    content: str
    model: str
    provider: str
    usage: Usage
    cost_usd: float
    finish_reason: Literal["stop", "length", "content_filter", "error"]


@dataclass
class StreamChunk:
    """A chunk from streaming response."""
    delta: str
    finish_reason: Optional[Literal["stop", "length", "content_filter", "error"]] = None
