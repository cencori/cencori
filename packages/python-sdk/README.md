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

# Chat
response = cencori.ai.chat(
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.content)

# Embeddings
embedding = cencori.ai.embeddings(
    input="Hello world",
    model="text-embedding-3-small"
)
print(len(embedding.embeddings[0]))
```

## Async Support

All methods have async counterparts:

```python
import asyncio
from cencori import Cencori

async def main():
    cencori = Cencori()
    
    # Async chat
    response = await cencori.ai.async_chat(
        messages=[{"role": "user", "content": "Hello!"}]
    )
    print(response.content)

asyncio.run(main())
```

## Streaming

```python
for chunk in cencori.ai.chat_stream(
    messages=[{"role": "user", "content": "Tell me a story"}],
    model="gpt-4o"
):
    print(chunk.delta, end="", flush=True)
```


## Project and API Key Setup

Create projects, generate API keys, and configure provider access in the Cencori dashboard. Public Python SDK usage starts after you have a project secret key (`csk_...`) stored as `CENCORI_API_KEY`.

The `projects` and `api_keys` modules are not part of the public runtime setup path. They target dashboard-management surfaces and should not be used from product integrations.

## Metrics & Analytics

```python
# Get usage metrics for last 24 hours
metrics = cencori.metrics.get(period="24h")

print(f"Total Requests: {metrics.requests.total}")
print(f"Total Cost: ${metrics.cost.total_usd}")
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

## Related Tools

**[@cencori/scan](https://www.npmjs.com/package/@cencori/scan)** — Security scanner for AI apps. Detects hardcoded secrets, PII, and vulnerabilities with AI-powered auto-fix.

```bash
npx @cencori/scan
```

## License

MIT © FohnAI
