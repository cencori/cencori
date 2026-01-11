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

## TanStack AI Integration (Coming Soon)

```typescript
import { cencori } from '@cencori/ai-sdk/tanstack';
import { chat } from '@tanstack/ai';

const result = await chat({
  adapter: cencori,
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }]
});
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

## License

MIT © FohnAI
