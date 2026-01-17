# Cencori

**The unified infrastructure layer for AI applications.**

One SDK. Every AI primitive. Always secure. Always logged.

```bash
npm install cencori
```

## Quick Start

```typescript
import { Cencori } from 'cencori';

const cencori = new Cencori({ 
  apiKey: process.env.CENCORI_API_KEY 
});

// AI Gateway - Chat with any model
const response = await cencori.ai.chat({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }]
});

console.log(response.content);
```

## Products

| Product | Status | Description |
|---------|--------|-------------|
| **AI Gateway** | ✅ Available | Multi-provider routing, security, observability |
| **Compute** | 🚧 Coming Soon | Serverless functions, GPU access |
| **Workflow** | 🚧 Coming Soon | Visual AI pipelines, orchestration |
| **Storage** | 🚧 Coming Soon | Vector database, knowledge base, RAG |
| **Integration** | ✅ Available | SDKs, Vercel AI, TanStack |

## AI Gateway

### Chat Completions

```typescript
const response = await cencori.ai.chat({
  model: 'gpt-4o', // or 'claude-3-opus', 'gemini-1.5-pro', etc.
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is the capital of France?' }
  ],
  temperature: 0.7,
  maxTokens: 1000
});

console.log(response.content);
console.log(response.usage); // { promptTokens, completionTokens, totalTokens }
```

### Embeddings

```typescript
const response = await cencori.ai.embeddings({
  model: 'text-embedding-3-small',
  input: 'Hello world'
});

console.log(response.embeddings[0]); // [0.1, 0.2, ...]
```

## Framework Integrations

### Vercel AI SDK

```typescript
import { cencori } from 'cencori/vercel';
import { streamText } from 'ai';

const result = await streamText({
  model: cencori('gpt-4o'),
  messages: [{ role: 'user', content: 'Hello!' }]
});

for await (const chunk of result.textStream) {
  console.log(chunk);
}
```

### With React/Next.js

```typescript
import { cencori } from 'cencori/vercel';
import { useChat } from 'ai/react';

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: '/api/chat'
  });
  
  return (
    <div>
      {messages.map(m => <div key={m.id}>{m.content}</div>)}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
      </form>
    </div>
  );
}
```

## Coming Soon

### Compute

```typescript
// 🚧 Coming Soon
await cencori.compute.run('my-function', { 
  input: { data: 'hello' } 
});
```

### Workflow

```typescript
// 🚧 Coming Soon
await cencori.workflow.trigger('data-enrichment', { 
  data: { userId: '123' } 
});
```

### Storage

```typescript
// 🚧 Coming Soon
const results = await cencori.storage.vectors.search('query', { 
  limit: 5 
});

await cencori.storage.knowledge.query('What is our refund policy?');
```

## Why Cencori?

- **🛡️ Security Built-in**: PII detection, content filtering, jailbreak protection
- **📊 Observability**: Every request logged, every token tracked
- **💰 Cost Control**: Budget alerts, spend caps, per-request costing
- **🔄 Multi-Provider**: Switch between OpenAI, Anthropic, Google, etc.
- **⚡ One SDK**: AI, compute, storage, workflows - unified

## Links

- [Documentation](https://cencori.com/docs)
- [Dashboard](https://cencori.com/dashboard)
- [GitHub](https://github.com/cencori/cencori)

## License

MIT
