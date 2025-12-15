# Cencori

Official SDK for Cencori - The Security Layer for AI Development.

## Installation

```bash
npm install cencori
# or
yarn add cencori
# or
pnpm add cencori
```

## Quick Start

```typescript
import { Cencori } from 'cencori';

const cencori = new Cencori({
  apiKey: process.env.CENCORI_API_KEY!
});

const response = await cencori.ai.chat({
  messages: [
    { role: 'user', content: 'Hello, AI!' }
  ]
});

console.log(response.content);
```

## Authentication

Get your API key from the [Cencori Dashboard](https://cencori.com/dashboard):

1. Create a project
2. Navigate to API Keys
3. Generate a new key
4. Copy and store it securely

## API Reference

### Cencori

Initialize the SDK client.

```typescript
import { Cencori } from 'cencori';

const cencori = new Cencori({
  apiKey: 'your_api_key_here',
  baseUrl: 'https://cencori.com' // Optional, defaults to production
});
```

### AI Module

#### `ai.chat(params)`

Send a chat message to the AI (non-streaming).

**Parameters:**
- `messages`: Array of message objects with `role` ('system' | 'user' | 'assistant') and `content`
- `model`: Optional AI model (defaults to 'gemini-2.5-flash')
- `temperature`: Optional temperature (0-1)
- `maxTokens`: Optional max tokens for response
- `userId`: Optional user ID for rate limiting

**Example:**

```typescript
const response = await cencori.ai.chat({
  messages: [
    { role: 'user', content: 'Explain quantum computing' }
  ],
  model: 'gpt-4o',
  temperature: 0.7
});

console.log(response.content);
console.log(response.usage); // Token usage stats
console.log(response.cost_usd); // Cost in USD
```

#### `ai.chatStream(params)`

Stream a chat response token-by-token.

**Example:**

```typescript
const stream = cencori.ai.chatStream({
  messages: [
    { role: 'user', content: 'Tell me a story' }
  ],
  model: 'gpt-4o'
});

for await (const chunk of stream) {
  process.stdout.write(chunk.delta);
}
```

## Error Handling

The SDK includes custom error classes for common scenarios:

```typescript
import {
  Cencori,
  AuthenticationError,
  RateLimitError,
  SafetyError
} from 'cencori';

try {
  const response = await cencori.ai.chat({ messages: [...] });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid API key');
  } else if (error instanceof RateLimitError) {
    console.error('Too many requests, please slow down');
  } else if (error instanceof SafetyError) {
    console.error('Content blocked:', error.reasons);
  }
}
```

## TypeScript Support

The SDK is written in TypeScript and includes full type definitions.

```typescript
import type { ChatParams, ChatResponse, Message, StreamChunk } from 'cencori';
```

## Features

- ✅ Full TypeScript support with type definitions
- ✅ Built-in authentication
- ✅ Automatic retry logic with exponential backoff
- ✅ Custom error classes
- ✅ Content safety filtering (PII, prompt injection, harmful content)
- ✅ Rate limiting protection
- ✅ Streaming support with `chatStream()`

## Supported Models

| Provider | Models |
|----------|--------|
| OpenAI | `gpt-4o`, `gpt-4-turbo`, `gpt-3.5-turbo` |
| Anthropic | `claude-3-opus`, `claude-3-sonnet`, `claude-3-haiku` |
| Google | `gemini-2.5-flash`, `gemini-2.0-flash` |

## Local Development

For local development or testing:

```typescript
const cencori = new Cencori({
  apiKey: 'cen_test_...',
  baseUrl: 'http://localhost:3000'
});
```

## Support

- **Documentation**: [cencori.com/docs](https://cencori.com/docs)
- **Dashboard**: [cencori.com/dashboard](https://cencori.com/dashboard)
- **GitHub**: [github.com/cencori](https://github.com/cencori)

## License

MIT © FohnAI
