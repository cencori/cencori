"""
Cencori Python SDK

Official Python SDK for Cencori - AI Infrastructure for Production.

One SDK for AI Gateway, Compute, Workflow, and Storage.
Every operation is secured, logged, and tracked.

Example:
    >>> from cencori import Cencori
    >>> cencori = Cencori(api_key="csk_...")
    >>> 
    >>> # Chat completion
    >>> response = cencori.ai.chat(
    ...     messages=[{"role": "user", "content": "Hello!"}]
    ... )
    >>> print(response.content)
    >>> 
    >>> # Streaming
    >>> for chunk in cencori.ai.chat_stream(messages=[...]):
    ...     print(chunk.delta, end="")
    >>> 
    >>> # Embeddings
    >>> embeddings = cencori.ai.embeddings(input="Hello world")
    >>> print(len(embeddings.embeddings[0]))
"""

from .client import Cencori
from .errors import (
    CencoriError,
    AuthenticationError,
    RateLimitError,
    SafetyError,
)
from .types import (
    Message,
    ChatParams,
    ChatResponse,
    StreamChunk,
    Usage,
    CompletionRequest,
    EmbeddingRequest,
    EmbeddingResponse,
    EmbeddingUsage,
)

__version__ = "0.2.0"
__all__ = [
    # Client
    "Cencori",
    # Errors
    "CencoriError",
    "AuthenticationError",
    "RateLimitError",
    "SafetyError",
    # Chat types
    "Message",
    "ChatParams",
    "ChatResponse",
    "StreamChunk",
    "Usage",
    # Completion types
    "CompletionRequest",
    # Embedding types
    "EmbeddingRequest",
    "EmbeddingResponse",
    "EmbeddingUsage",
    # New types from instruction
    "Project",
    "CreateProjectParams",
    "APIKey",
    "CreateAPIKeyParams",
    "MetricsResponse",
]
