"""Type definitions for Cencori SDK."""

from dataclasses import dataclass
from typing import List, Literal, Optional, Union


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
    error: Optional[str] = None


# Completion types
@dataclass
class CompletionRequest:
    """Parameters for text completion."""
    prompt: str
    model: str = "gemini-2.5-flash"
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None


# Embedding types
@dataclass
class EmbeddingRequest:
    """Parameters for embedding generation."""
    input: Union[str, List[str]]
    model: str = "text-embedding-3-small"


@dataclass
class EmbeddingUsage:
    """Token usage for embeddings."""
    total_tokens: int


@dataclass
class EmbeddingResponse:
    """Response from embedding generation."""
    model: str
    embeddings: List[List[float]]
    usage: EmbeddingUsage


# Project types
@dataclass
class Project:
    """A Cencori project."""
    id: str
    name: str
    slug: str
    description: str
    status: str
    visibility: str
    created_at: str
    updated_at: str
    stats: Optional["Stats"] = None


@dataclass
class CreateProjectParams:
    """Parameters for creating a project."""
    name: str
    description: Optional[str] = None
    visibility: Optional[str] = None


@dataclass
class Stats:
    """Project statistics."""
    total_requests: int
    total_cost_usd: float
    last_used_at: Optional[str] = None


# API Key types
@dataclass
class APIKey:
    """A Cencori API key."""
    id: str
    name: str
    environment: str
    created_at: str
    prefix: Optional[str] = None
    key: Optional[str] = None
    last_used_at: Optional[str] = None
    usage_count: Optional[int] = None


@dataclass
class CreateAPIKeyParams:
    """Parameters for creating an API key."""
    name: str
    environment: str


@dataclass
class DailyStat:
    """Daily usage statistic."""
    date: str
    count: int
    cost_usd: float


@dataclass
class KeyUsageStats:
    """Usage statistics for an API key."""
    key_id: str
    total_requests: int
    total_cost_usd: float
    last_used_at: str
    requests_by_day: List[DailyStat]
    requests_by_model: dict[str, int]


# Metrics types
@dataclass
class RequestMetrics:
    total: int
    success: int
    error: int
    filtered: int
    success_rate: float


@dataclass
class CostMetrics:
    total_usd: float
    average_per_request_usd: float


@dataclass
class TokenMetrics:
    prompt: int
    completion: int
    total: int


@dataclass
class LatencyMetrics:
    avg_ms: int
    p50_ms: int
    p90_ms: int
    p99_ms: int


@dataclass
class Breakdown:
    requests: int
    cost_usd: float


@dataclass
class MetricsResponse:
    """Response from metrics API."""
    period: str
    start_date: str
    end_date: str
    requests: RequestMetrics
    cost: CostMetrics
    tokens: TokenMetrics
    latency: LatencyMetrics
    providers: dict[str, Breakdown]
    models: dict[str, Breakdown]

