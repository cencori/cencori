# @cencori/ai-provider

Cencori provider for [Vercel AI SDK](https://github.com/vercel/ai) - use Cencori with `streamText()`, `generateText()`, and `useChat()`.

## Installation

```bash
npm install @cencori/ai-provider ai
```

## Quick Start

```typescript
import { cencori } from '@cencori/ai-provider';
import { streamText } from 'ai';

const result = await streamText({
  model: cencori('gemini-2.5-flash'),
  messages: [{ role: 'user', content: 'Hello!' }]
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

## Usage with Next.js App Router

```typescript
// app/api/chat/route.ts
import { cencori } from '@cencori/ai-provider';
import { streamText } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await streamText({
    model: cencori('gemini-2.5-flash'),
    messages
  });

  return result.toUIMessageStreamResponse();
}
```

## Configuration

### Environment Variable

Set the `CENCORI_API_KEY` environment variable:

```bash
CENCORI_API_KEY=csk_your_key_here
```

### Custom Configuration

```typescript
import { createCencori } from '@cencori/ai-provider';

const cencori = createCencori({
  apiKey: 'csk_your_key_here',
  baseUrl: 'https://cencori.com', // optional
});

const result = await streamText({
  model: cencori('gpt-4o'),
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

## Supported Models

Use any model supported by Cencori:

| Provider | Models |
|----------|--------|
| OpenAI | `gpt-4o`, `gpt-4o-mini`, `o1` |
| Anthropic | `claude-3-opus`, `claude-3-5-sonnet`, `claude-3-haiku` |
| Google | `gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-3-pro` |
| xAI | `grok-4`, `grok-3` |
| Mistral | `mistral-large`, `codestral` |
| DeepSeek | `deepseek-v3.2`, `deepseek-reasoner` |
| + More | Groq, Cohere, Perplexity, Together, Meta, Qwen, HuggingFace |

## Features

- ✅ Drop-in Vercel AI SDK compatibility
- ✅ Works with `streamText()`, `generateText()`, `useChat()`
- ✅ Built-in content safety filtering
- ✅ Rate limiting protection
- ✅ Full analytics in Cencori dashboard
- ✅ Multi-provider support with one API key

## License

MIT © FohnAI
