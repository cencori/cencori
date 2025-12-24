"""Cencori SDK client."""

from typing import Any, Dict, Optional

import httpx

from .ai import AIModule
from .errors import AuthenticationError, CencoriError, RateLimitError, SafetyError


class Cencori:
    """
    Cencori SDK client.
    
    Args:
        api_key: Your Cencori API key
        base_url: API base URL (default: https://cencori.com)
        timeout: Request timeout in seconds (default: 30)
    
    Example:
        >>> from cencori import Cencori
        >>> cencori = Cencori(api_key="your-api-key")
        >>> response = cencori.ai.chat(
        ...     messages=[{"role": "user", "content": "Hello!"}]
        ... )
        >>> print(response.content)
    """
    
    def __init__(
        self,
        api_key: str,
        base_url: str = "https://cencori.com",
        timeout: float = 30.0,
    ) -> None:
        if not api_key:
            raise ValueError("API key is required")
        
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        
        # Initialize modules
        self.ai = AIModule(self)
    
    def _request(
        self,
        method: str,
        endpoint: str,
        json: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Make an HTTP request to the Cencori API."""
        url = f"{self._base_url}{endpoint}"
        
        request_headers = {
            "Content-Type": "application/json",
            "CENCORI_API_KEY": self._api_key,
        }
        if headers:
            request_headers.update(headers)
        
        with httpx.Client(timeout=self._timeout) as client:
            response = client.request(
                method=method,
                url=url,
                json=json,
                headers=request_headers,
            )
        
        # Handle errors
        if response.status_code == 401:
            raise AuthenticationError()
        
        if response.status_code == 429:
            raise RateLimitError()
        
        data = response.json()
        
        if response.status_code == 400 and "reasons" in data:
            raise SafetyError(
                message=data.get("error", "Content safety violation"),
                reasons=data.get("reasons", []),
            )
        
        if not response.is_success:
            raise CencoriError(
                message=data.get("error", "Request failed"),
                status_code=response.status_code,
            )
        
        return data
