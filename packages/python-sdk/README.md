# Cencori Python SDK

Official Python SDK for Cencori - AI Infrastructure for Production.

## Installation

```bash
pip install cencori
```

## Quick Start

```python
from cencori import Cencori

cencori = Cencori(api_key="your-api-key")

response = cencori.ai.chat(
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.content)
```

## Streaming

```python
for chunk in cencori.ai.chat_stream(
    messages=[{"role": "user", "content": "Tell me a story"}],
    model="gpt-4o"
):
    print(chunk.delta, end="", flush=True)
```

## Error Handling

```python
from cencori import (
    Cencori,
    AuthenticationError,
    RateLimitError,
    SafetyError
)

try:
    response = cencori.ai.chat(messages=[...])
except AuthenticationError:
    print("Invalid API key")
except RateLimitError:
    print("Too many requests")
except SafetyError as e:
    print(f"Content blocked: {e.reasons}")
```

## Supported Models

| Provider | Models |
|----------|--------|
| OpenAI | `gpt-4o`, `gpt-4-turbo`, `gpt-3.5-turbo` |
| Anthropic | `claude-3-opus`, `claude-3-sonnet`, `claude-3-haiku` |
| Google | `gemini-2.5-flash`, `gemini-2.0-flash` |

## License

MIT © FohnAI
