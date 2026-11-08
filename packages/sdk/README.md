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
| **Web** | ✅ Available | First-party fetch, extraction, crawl, and evidence-bearing search |
| **Billing** | ✅ Available | End-user usage monetization and Stripe integration |
| **Integration** | ✅ Available | SDKs, Vercel AI, TanStack |
| **Agents** | ✅ Available | Code-first agents (`cencori/agents`): tools, handoffs, approvals, guardrails, any model |
| **Embedded Agents** | ✅ Available | Multi-tenant agent backend: tenants, versions, runs, approvals, metering |

## Agents

`cencori/agents` builds agents in code and runs them on Cencori. Your tools run in your process; the agent loop, sessions, approvals, memory, guardrails, billing and traces run on Cencori, with any model in the catalog.

```bash
npm install cencori zod
```

```typescript
import { Agent, run, tool } from 'cencori/agents';
import { z } from 'zod';

const getOrder = tool({
  name: 'get_order',
  description: 'Look up an order by id',
  parameters: z.object({ id: z.string() }),
  execute: async ({ id }) => db.orders.find(id),
});

const support = new Agent({
  name: 'Support',
  instructions: 'Answer order questions. Be brief.',
  tools: [getOrder],
  // model: 'claude-sonnet-4-5',  // any catalog model; default gpt-oss-120b (fast)
});

const result = await run(support, 'Where is order 1042?'); // reads CENCORI_API_KEY
console.log(result.finalOutput);
```

The agent calls as many tools, over as many rounds, as it needs. Pass `result.sessionId` back as `{ sessionId }` to continue the conversation.

**Stream**

```typescript
const stream = run(support, 'Where is order 1042?', { stream: true });
for await (const text of stream.toTextStream()) process.stdout.write(text);
const result = await stream.completed;
```

**Handoffs and agents as tools**

```typescript
const billing = new Agent({ name: 'Billing', instructions: 'You handle refunds.', handoffDescription: 'refunds and invoices' });
const triage = new Agent({ name: 'Triage', instructions: 'Route billing questions to Billing.', handoffs: [billing] });
// Or keep the conversation and just ask another agent: tools: [billing.asTool()]
```

**Human approval**

```typescript
import { RunState } from 'cencori/agents';

const refund = tool({
  name: 'issue_refund',
  description: 'Refund an order',
  parameters: z.object({ id: z.string() }),
  needsApproval: true, // recorded in your project's governance ledger
  execute: async ({ id }) => payments.refund(id),
});

const first = await run(billingAgent, 'Refund order 1042');
if (first.interruptions.length) {
  const saved = JSON.stringify(first.state);        // store it; decide later, anywhere
  const state = RunState.fromJSON(saved);
  state.approve(first.interruptions[0]);            // or state.reject(item, { message })
  const done = await run(billingAgent, state);
}
```

`needsApproval` can also be a function, `(ctx, args) => args.amount > 100`, decided per call.

**Structured output, guardrails, memory**

```typescript
const extractor = new Agent({
  name: 'Extractor',
  outputType: z.object({ city: z.string(), days: z.number() }), // finalOutput is typed
  inputGuardrails: [{ name: 'on_topic', execute: ({ input }) => ({ tripwireTriggered: input.includes('homework') }) }],
  modelSettings: { reasoningEffort: 'low' },
});

await run(extractor, 'Trip to Lagos for 3 days', { memory: { userId: 'user_123' }, user: 'user_123' });
```

Tool parameters accept zod 3 or 4, any [Standard Schema](https://standardschema.dev) library, or a plain JSON Schema object.

## Agent UI

A chat for your agent where it can answer with UI: charts, tables, stats, lists, buttons and forms, generated on the fly. Works with any model in the catalog.

```ts
// app/api/chat/route.ts: your tools run on your server
import { Agent, createAgentChatHandler, tool } from 'cencori/agents';
import { z } from 'zod';

const getSales = tool({
    name: 'get_sales',
    description: 'Monthly revenue by product',
    parameters: z.object({}),
    execute: async () => db.sales.monthly(),
});

const analyst = new Agent({ name: 'Analyst', instructions: 'Answer with charts and tables when it helps.', tools: [getSales], widgets: true });
export const POST = createAgentChatHandler(analyst);
```

```tsx
// In your page
import { AgentChat } from 'cencori/react';

<AgentChat api="/api/chat" greeting="Ask about your sales" prompts={['Revenue by product', 'Top customers']} />
```

- `widgets: true` gives the model the built-in `render_ui` tool. Cencori checks every widget before it's shown.
- A tool can also return `{ widget }` to show a design you control, filled with real data.
- Buttons and forms send their action back to the agent (or to `onAction` with `handler: 'client'`).
- Approvals (`needsApproval`) show an approval card; the paused run is signed so the browser can't change it.
- Theme with `theme={{ colorScheme, accent, radius }}` or CSS variables. Build your own layout with `useAgentChat()`, `<Transcript>`, `<Composer>` and `<Widget>`.

## Embedded Agents

```typescript
import { Cencori } from 'cencori';

const cencori = new Cencori({ apiKey: process.env.CENCORI_API_KEY });

// Tenants → install → scoped session
const tenant = await cencori.tenants.create({ external_id: 'company_123', name: 'Acme Ltd' });
await cencori.installations.create({ tenant_id: tenant.id, agent_id: 'agt_...', version: '1.0.0' });
const { token } = await cencori.clientTokens.mint({ tenant_id: tenant.id, external_user_id: 'u_1' });

// Background run with idempotency, then approve once
const run = await cencori.runs.create('agt_...', { installation_id: 'ins_...', mode: 'background', input: {} }, 'plan-123');
await cencori.actions.approve('act_...');

// Skills, MCP, usage
await cencori.skills.create({ name: 'Refund policy' });
await cencori.mcpServers.register({ name: 'CRM', url: 'https://mcp.example.com/mcp' });
const csv = await cencori.usage.exportCsv({ days: 30, tenant_id: tenant.id });
```

Namespaces: `tenants`, `clientTokens`, `models`, `providerConnections`, `agentVersions`, `installations`, `runs`, `actions`, `knowledge`, `connections`, `mcpServers`, `skills`, `skillImports`, `webhooks`, `usage`, `endUsers`, `ratePlans`. Full reference: https://cencori.com/openapi/embedded-agents.json.

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

### Multimodal (Image Input)

```typescript
const response = await cencori.ai.chat({
  model: 'gpt-4o',
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'What is in this image?' },
      { type: 'image_url', image_url: { url: 'https://example.com/image.jpg' } }
    ]
  }]
});
```

### Tool Usage (Function Calling)

```typescript
const response = await cencori.ai.chat({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'What is the weather in Tokyo?' }],
  tools: [{
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get the current weather for a location',
      parameters: {
        type: 'object',
        properties: { location: { type: 'string' } },
        required: ['location']
      }
    }
  }]
});

if (response.toolCalls) {
  console.log(response.toolCalls); // [{ function: { name: 'get_weather', arguments: '{"location":"Tokyo"}' } }]
}
```

### Structured Output (Object Generation)

```typescript
interface UserProfile {
  name: string;
  age: number;
  interests: string[];
}

const response = await cencori.ai.generateObject<UserProfile>({
  model: 'gpt-4o',
  prompt: 'Generate a fictional user profile',
  schema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'number' },
      interests: { type: 'array', items: { type: 'string' } }
    },
    required: ['name', 'age', 'interests']
  }
});

console.log(response.object); // { name: 'Alice', age: 28, interests: ['hiking'] }
```

### Embeddings

```typescript
const response = await cencori.ai.embeddings({
  model: 'text-embedding-3-small',
  input: 'Hello world'
});

console.log(response.embeddings[0]); // [0.1, 0.2, ...]
```

### Vision (Image Understanding)

Analyze, describe, OCR, and classify images. Routes across OpenAI, Anthropic, and Google vision-capable models.

```typescript
// General analysis with a custom prompt
const result = await cencori.vision.analyze({
  image: { url: 'https://example.com/photo.jpg' },
  prompt: 'What breed of dog is this?'
});

// OCR from a local file
import fs from 'node:fs';
const buf = fs.readFileSync('receipt.png');
const { text } = await cencori.vision.ocr({
  image: { base64: buf.toString('base64'), mimeType: 'image/png' }
});

// Structured classification
const { classification } = await cencori.vision.classify({
  image: { url: 'https://example.com/product.jpg' }
});
// classification: { primary_category, tags, objects, safe_for_work, ... }
```

Drop-in React uploader for your own product (`cencori/react`):

```tsx
import { VisionUploader } from 'cencori/react';

<VisionUploader
  endpoint="https://cencori.com/api/ai/vision"
  apiKey={process.env.NEXT_PUBLIC_CENCORI_KEY}
  task="describe"
  onResult={(r) => console.log(r)}
/>
```

Full API in [docs](https://cencori.com/docs/ai/endpoints/vision).

### Judgment (Structured Decisions)

Yes/no, choice, and score answers with probabilities over any state — no generated text. Any `judgment` catalog model works here (TypeSafe's Jev and Cloudflare's Clef today; see `cencori.judgment.listModels()`).

```typescript
const result = await cencori.judgment.judge({
  state: 'I was charged twice. Please refund the duplicate.',
  questions: {
    department: {
      type: 'choice',
      instructions: 'Which team should handle this?',
      criteria: { billing: 'Payments, invoicing, refunds', technical: 'Bugs, outages' },
    },
    requests_refund: { type: 'noul', instructions: 'Does the customer request a refund?' },
  },
});
// result.answers.department.choice === 'billing'
```

Full API in [docs](https://cencori.com/docs/api/judgments).

### Documents (PDF & Image Extraction)

Extract text from PDFs and images, summarize documents, and answer questions about them. Text-based PDFs use native parsing — no LLM tokens, free.

```typescript
// Extract text — native PDF parsing, free
const { text, method } = await cencori.documents.extract({
  document: { url: 'https://example.com/contract.pdf' },
});
console.log(method); // 'pdf_text' means free

// Summarize
const { summary } = await cencori.documents.summarize({
  document: { url: 'https://example.com/report.pdf' },
});

// Q&A — strict "Not found" if the answer isn't in the doc
const { answer } = await cencori.documents.query({
  document: { url: 'https://example.com/contract.pdf' },
  question: 'What is the termination clause?',
});
```

Full API in [docs](https://cencori.com/docs/ai/endpoints/documents). See the [Contract Analyzer tutorial](https://cencori.com/docs/guides/build-a-contract-analyzer) for an end-to-end example.

### Web Search and Retrieval

Fetch and extract public pages, build a private project corpus, or search Cencori's continuously refreshed public index:

```typescript
const results = await cencori.web.search({
  query: 'PostgreSQL row-level locking',
  freshness: '30d',
  limit: 10,
});

for (const result of results.results) {
  console.log(result.title, result.canonicalUrl, result.evidence.quote);
}

const page = await cencori.web.extract({
  url: 'https://www.postgresql.org/docs/current/explicit-locking.html',
});

await cencori.web.crawl({
  seeds: ['https://docs.example.com/'],
  maxPages: 100,
  maxDepth: 2,
});
```

For tool-calling agents, import `WEB_SEARCH_TOOL` or `WEB_FETCH_TOOL` from `cencori/web`, then resolve emitted calls with `cencori.web.executeTool(...)`. Retrieved page content is always marked as untrusted input.

### Image Generation

Generate images from text prompts using multiple providers:

```typescript
const response = await cencori.ai.generateImage({
  prompt: 'A futuristic city at sunset with flying cars',
  model: 'gpt-image-1.5',  // Best text rendering, top ELO rating
  size: '1024x1024',
  quality: 'hd'
});

console.log(response.images[0].url); // https://...
```

**Supported Models:**
| Provider | Models | Description |
|----------|--------|-------------|
| **OpenAI** | `gpt-image-1.5`, `gpt-image-1`, `dall-e-3`, `dall-e-2` | Text rendering, creative |
| **Google** | `gemini-3-pro-image`, `imagen-3` | High photorealism |

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
import { useChat } from '@ai-sdk/react';

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
## Why Cencori?

- **🛡️ Security Built-in**: PII detection, content filtering, jailbreak protection
- **📊 Observability**: Every request logged, every token tracked
- **💰 Cost Control**: Budget alerts, spend caps, per-request costing
- **🔄 Multi-Provider**: Switch between OpenAI, Anthropic, Google, etc.
- **⚡ One SDK**: AI model routing, security shield, and billing - unified

## Links

- [Documentation](https://cencori.com/docs)
- [Dashboard](https://console.cencori.com/home)
- [GitHub](https://github.com/cencori/cencori)

## License

MIT
