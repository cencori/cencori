# @cencori/ai-sdk

The Cencori AI SDK — the infrastructure layer for AI applications.

## Installation

```bash
npm install @cencori/ai-sdk
```

## Vercel AI SDK Integration

```typescript
import { cencori } from '@cencori/ai-sdk/vercel';
import { streamText } from 'ai';

const result = await streamText({
  model: cencori('gpt-4o'),
  messages: [{ role: 'user', content: 'Hello!' }]
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

### Tool Calling (Vercel AI SDK)

```typescript
import { cencori } from '@cencori/ai-sdk/vercel';
import { generateText, tool } from 'ai';
import { z } from 'zod';

const result = await generateText({
  model: cencori('gpt-4o'),
  prompt: 'What is the weather in San Francisco?',
  tools: {
    getWeather: tool({
      description: 'Get the current weather for a location',
      parameters: z.object({
        location: z.string().describe('The city name'),
      }),
      execute: async ({ location }) => {
        return { temperature: 72, condition: 'sunny' };
      },
    }),
  },
});
```

## TanStack AI Integration

```typescript
import { cencori } from '@cencori/ai-sdk/tanstack';

const adapter = cencori('gpt-4o');

for await (const chunk of adapter.chatStream({
  messages: [{ role: 'user', content: 'Hello!' }]
})) {
  if (chunk.type === 'content') {
    process.stdout.write(chunk.delta);
  }
}
```

### Tool Calling (TanStack AI)

```typescript
import { cencori } from '@cencori/ai-sdk/tanstack';

const adapter = cencori('gpt-4o');

for await (const chunk of adapter.chatStream({
  messages: [{ role: 'user', content: 'Get weather for NYC' }],
  tools: {
    getWeather: {
      name: 'getWeather',
      description: 'Get weather for a location',
      inputSchema: { 
        type: 'object', 
        properties: { location: { type: 'string' } } 
      },
    },
  },
})) {
  if (chunk.type === 'tool_call') {
    console.log('Tool call:', chunk.toolCall);
  }
}
```

## Configuration

### Environment Variable

```bash
CENCORI_API_KEY=csk_your_key_here
```

### Custom Configuration

```typescript
import { createCencori } from '@cencori/ai-sdk/vercel';

const cencori = createCencori({
  apiKey: 'csk_your_key_here',
  baseUrl: 'https://cencori.com',
});
```

## Supported Models

| Provider | Models |
|----------|--------|
| OpenAI | `gpt-4o`, `gpt-4o-mini`, `o1` |
| Anthropic | `claude-3-5-sonnet`, `claude-3-opus`, `claude-3-haiku` |
| Google | `gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-3-pro` |
| xAI | `grok-4`, `grok-3` |
| Mistral | `mistral-large`, `codestral` |
| DeepSeek | `deepseek-v3.2`, `deepseek-reasoner` |
| + More | Groq, Cohere, Perplexity, Together |

## Why Cencori?

- 🔒 **Security** — PII filtering, jailbreak detection, content moderation
- 📊 **Observability** — Request logs, latency metrics, cost tracking
- 💰 **Cost Control** — Budgets, alerts, per-route analytics
- 🔌 **Multi-Provider** — One API key for all AI providers
- 🛠️ **Tool Calling** — Full support for function calling across providers

## License

MIT © FohnAI
