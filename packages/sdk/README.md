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
2. Navigate to Settings → API tab
3. Generate a new key:
   - **Secret key (`csk_`)** - For server-side use only
   - **Publishable key (`cpk_`)** - Safe for browser use (requires domain whitelisting)
4. Copy and store it securely

## API Reference

### Cencori

Initialize the SDK client.

```typescript
import { Cencori } from 'cencori';

const cencori = new Cencori({
  apiKey: 'csk_xxx', // Secret key for server-side
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
  model: 'gemini-2.5-flash'
});

for await (const chunk of stream) {
  // Check for stream errors (e.g., rate limit, provider failure)
  if (chunk.error) {
    console.error('Stream error:', chunk.error);
    break;
  }
  
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

## Vercel AI SDK Integration

Using Vercel AI SDK? Use `@cencori/ai-sdk` for seamless integration:

```bash
npm install @cencori/ai-sdk ai
```

```typescript
import { cencori } from '@cencori/ai-sdk';
import { streamText } from 'ai';

const result = await streamText({
  model: cencori('gpt-4o'),
  messages: [{ role: 'user', content: 'Hello!' }]
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

See [@cencori/ai-sdk on npm](https://www.npmjs.com/package/@cencori/ai-sdk) for full documentation.

## Supported Models

| Provider | Models |
|----------|--------|
| OpenAI | `gpt-5`, `gpt-4o`, `gpt-4o-mini`, `o3`, `o1` |
| Anthropic | `claude-opus-4`, `claude-sonnet-4`, `claude-3-5-sonnet` |
| Google | `gemini-3-pro`, `gemini-2.5-flash`, `gemini-2.0-flash` |
| xAI | `grok-4`, `grok-4.1`, `grok-3` |
| Mistral | `mistral-large`, `codestral`, `devstral` |
| DeepSeek | `deepseek-v3.2`, `deepseek-reasoner` |
| Meta | `llama-4-maverick`, `llama-3.3-70b` |
| + 7 more | Groq, Cohere, Perplexity, Together, Qwen, OpenRouter, HuggingFace |

## Local Development

For local development or testing:

```typescript
const cencori = new Cencori({
  apiKey: 'csk_test_xxx', // Test secret key
  baseUrl: 'http://localhost:3000'
});
```

## Browser Usage (Publishable Keys)

For browser/client-side usage, use publishable keys:

```typescript
// Safe to use in browser - only works from allowed domains
const cencori = new Cencori({
  apiKey: 'cpk_xxx' // Publishable key
});

const response = await cencori.ai.chat({
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

## Support

- **Documentation**: [cencori.com/docs](https://cencori.com/docs)
- **Dashboard**: [cencori.com/dashboard](https://cencori.com/dashboard)
- **GitHub**: [github.com/cencori](https://github.com/cencori)

## License

MIT © FohnAI
