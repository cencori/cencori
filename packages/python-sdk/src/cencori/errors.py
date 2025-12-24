"""Custom error classes for Cencori SDK."""

from typing import Optional, List


class CencoriError(Exception):
    """Base exception for Cencori SDK errors."""
    
    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        code: Optional[str] = None,
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code
    
    def __str__(self) -> str:
        return self.message


class AuthenticationError(CencoriError):
    """Raised when API key is invalid or missing."""
    
    def __init__(self, message: str = "Invalid API key"):
        super().__init__(message, status_code=401, code="INVALID_API_KEY")


class RateLimitError(CencoriError):
    """Raised when rate limit is exceeded."""
    
    def __init__(self, message: str = "Rate limit exceeded"):
        super().__init__(message, status_code=429, code="RATE_LIMIT_EXCEEDED")


class SafetyError(CencoriError):
    """Raised when content violates safety policies."""
    
    def __init__(
        self,
        message: str = "Content safety violation",
        reasons: Optional[List[str]] = None,
    ):
        super().__init__(message, status_code=400, code="SAFETY_VIOLATION")
        self.reasons = reasons or []
