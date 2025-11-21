# Cencori

Official SDK for the Cencori.

## Installation

```bash
npm install cencori
# or
yarn add cencori
```

## Quick Start

```typescript
import { CencoriClient } from 'cencori';

const cencori = new CencoriClient({
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

### CencoriClient

Initialize the SDK client.

```typescript
const cencori = new CencoriClient({
  apiKey: 'your_api_key_here',
  baseUrl: 'https://cencori.com' // Optional, defaults to production
});
```

### AI Module

#### `ai.chat(params)`

Send a chat message to the AI.

**Parameters:**
- `messages`: Array of message objects with `role` ('user' | 'assistant') and `content`
- `model`: Optional AI model (defaults to 'gemini-1.5-pro')
- `temperature`: Optional temperature (0-1)
- `maxOutputTokens`: Optional max tokens for response

**Example:**

```typescript
const response = await cencori.ai.chat({
  messages: [
    { role: 'user', content: 'Explain quantum computing' }
  ],
  temperature: 0.7
});

console.log(response.content);
console.log(response.usage); // Token usage stats
```

## Error Handling

The SDK includes custom error classes for common scenarios:

```typescript
import {
  CencoriClient,
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
import type { ChatParams, ChatResponse, Message } from 'cencori';
```

## Features

- Full TypeScript support with type definitions
- Built-in authentication
- Automatic retry logic with exponential backoff
- Custom error classes
- Content safety filtering
- Rate limiting protection

## Local Development

For local development or testing:

```typescript
const cencori = new CencoriClient({
  apiKey: 'cen_test_...',
  baseUrl: 'http://localhost:3000'
});
```

## Support

- **Documentation**: [docs.cencori.com](https://docs.cencori.com)
- **Dashboard**: [cencori.com/dashboard](https://cencori.com/dashboard)
- **GitHub**: [github.com/bolaabanjo/cencori](https://github.com/bolaabanjo/cencori)

## License

MIT © FohnAI
