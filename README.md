![Cencori by FohnAI](public/Bonus.png)

# Cencori

**The unified infrastructure for AI production.**

Ship AI with built-in security, observability, and scale. One platform for everything — from gateway to compute to workflows.


---

## Why Cencori?

Building a demo is easy. Building a **production-grade AI business** is hard. 

Most teams spend 80% of their time building "the boring stuff"—security, cost controls, orchestration, and reliable storage—instead of their core product. Cencori is the unified infrastructure that handles all of that for you.

- **Stop Building Scaffolding** — Skip the 12-month build cycle for internal AI security and reliability layers.
- **Unified Logic** — Route, execute, and store AI data through a single, secure infrastructure.
- **Production-Ready by Default** — Built-in compliance, observability, and scale from your first request.
- **Future-Proof Infrastructure** — Switch models, add compute, or chain workflows without rewriting your entire stack.

**Cencori is the "Production Button" for AI.**

---

## The 5 Primitives of AI Production

Cencori provides the five foundational building blocks required to ship and scale AI.

### 1. AI Gateway (The Entryway)
The secure, unified API for all your AI models.
- **Multi-Provider Support** — One API for OpenAI, Anthropic, Gemini, Llama, and more.
- **Native Security** — Automatic PII detection, prompt injection protection, and content filtering.
- **Streaming & SSE** — Real-time responses with built-in token counting and cost tracking.
- **Global Observability** — Complete audit logs and analytics for every request.

### 2. Compute (The Brain)
Serverless execution for AI agents and logic.
- **Secure Sandboxing** — Execute vibe-coded logic and agent steps in an isolated environment.
- **Edge Inference** — Run lightweight models and functions closer to your users.
- **Auto-Scaling** — Scale from prototype to millions of requests without managing servers.

### 3. Workflow (The Nervous System)
Visual orchestration for complex AI pipelines.
- **Multi-Step Agents** — Chain multiple AI calls, logic steps, and human-in-the-loop approvals.
- **Safety Circuit Breakers** — Prevent cascading failures and runaway loops in autonomous agents.
- **State Management** — Native persistence for long-running AI processes.

### 4. Data Storage (The Memory)
AI-native storage for context and integrity.
- **Vector Sync** — Seamlessly manage and query vector embeddings for RAG.
- **Immutable Audit Logs** — Guaranteed traceability for compliance and behavioral analysis.
- **Semantic Caching** — Reduce costs and latency by caching similar AI responses.

### 5. Integration (The Hands)
Connect your AI to the tools your business already uses.
- **Business Connectors** — Native integration with Salesforce, Slack, GitHub, and internal databases.
- **Credential Management** — Securely store and inject third-party API keys into your AI workflows.
- **Event Triggers** — Start AI workflows based on external system events.

---

## Quick Start

### 1. Install the SDK

**JavaScript/TypeScript:**
```bash
npm install cencori
```

**Python:**
```bash
pip install cencori
```

**Go:**
```bash
go get github.com/cencori/cencori-go
```

### 2. Get Your API Key

1. Sign up at [cencori.com](https://cencori.com)
2. Create a project
3. Generate an API key

### 3. Make Your First Request

**JavaScript/TypeScript:**
```typescript
import { Cencori } from 'cencori';

const cencori = new Cencori({
  apiKey: 'csk_your_secret_key'  // Server-side secret key
});

const response = await cencori.ai.chat({
  messages: [{ role: 'user', content: 'Hello!' }],
  model: 'gpt-4o' // or 'claude-3-opus', 'gemini-2.5-flash'
});

console.log(response.content);
```

**Python:**
```python
from cencori import Cencori

cencori = Cencori(api_key="csk_your_secret_key")

response = cencori.ai.chat(
    messages=[{"role": "user", "content": "Hello!"}],
    model="gpt-4o"  # or "claude-3-opus", "gemini-2.5-flash"
)

print(response.content)
```

**Go:**
```go
package main

import (
    "context"
    "fmt"
    "os"
    "github.com/cencori/cencori-go"
)

func main() {
    client, _ := cencori.NewClient(
        cencori.WithAPIKey(os.Getenv("CENCORI_API_KEY")),
    )
    
    resp, _ := client.Chat.Create(context.Background(), &cencori.ChatParams{
        Model: "gpt-4o",
        Messages: []cencori.Message{
            {Role: "user", Content: "Hello!"},
        },
    })
    
    fmt.Println(resp.Choices[0].Message.Content)
}
```

### 4. Stream Responses in Real-Time

**JavaScript/TypeScript:**
```typescript
const stream = cencori.ai.chatStream({
  messages: [{ role: 'user', content: 'Tell me a story' }],
  model: 'gpt-4o',
  stream: true
});

for await (const chunk of stream) {
  process.stdout.write(chunk.delta);
}
```

**Python:**
```python
for chunk in cencori.ai.chat_stream(
    messages=[{"role": "user", "content": "Tell me a story"}],
    model="gpt-4o"
):
    print(chunk.delta, end="", flush=True)
```

**Go:**
```go
stream, _ := client.Chat.Stream(context.Background(), &cencori.ChatParams{
    Model: "gpt-4o",
    Messages: []cencori.Message{
        {Role: "user", Content: "Tell me a story"},
    },
})

for chunk := range stream {
    if len(chunk.Choices) > 0 {
        fmt.Print(chunk.Choices[0].Delta.Content)
    }
}
```

**That's it!** Cencori handles security, logging, and cost tracking automatically.

### 5. AI Memory (Context Store)

Store and search memories for RAG applications:

```typescript
// Store a memory
await cencori.memory.store({
  namespace: 'docs',
  content: 'Refund policy allows returns within 30 days',
  metadata: { category: 'policy' }
});

// Semantic search
const results = await cencori.memory.search({
  namespace: 'docs',
  query: 'what is our refund policy?',
  limit: 5
});

// RAG with context
const response = await cencori.ai.rag({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'What is our refund policy?' }],
  namespace: 'docs'
});
```

---

## Vercel AI SDK Integration

Using Vercel AI SDK (`ai` package)? Cencori is a drop-in provider:

```bash
npm install @cencori/ai-sdk ai
```

```typescript
import { cencori } from '@cencori/ai-sdk';
import { streamText } from 'ai';

const result = await streamText({
  model: cencori('gemini-2.5-flash'),
  messages: [{ role: 'user', content: 'Hello!' }]
});

return result.toUIMessageStreamResponse();
```

**Works with everything in Vercel AI SDK:**
- `streamText()` / `generateText()` - Server-side text generation
- `useChat()` / `useCompletion()` - React hooks for chat UIs
- `streamUI()` - Generative UI with React Server Components

**Same Cencori benefits:** Safety filtering, analytics, cost tracking, multi-provider support.

---

## Key Features

### **Multi-Provider AI Support**

Access multiple AI providers with one API:
- **OpenAI** - GPT-4, GPT-4 Turbo, GPT-3.5 Turbo
- **Anthropic** - Claude 3 Opus, Claude 3 Sonnet, Claude 3 Haiku
- **Google Gemini** - Gemini 2.5 Flash, Gemini 2.0 Flash
- **Custom Providers** - Bring your own OpenAI/Anthropic-compatible endpoints

Switch models with a single parameter - no code changes needed.

### **Multi-Provider Image Generation**

Generate images from text prompts across providers:

```typescript
const response = await cencori.ai.generateImage({
  prompt: "A futuristic city at sunset",
  model: "gpt-image-1.5",  // or "dall-e-3", "gemini-3-pro-image"
  size: "1024x1024",
});

console.log(response.images[0].url);
```

**Supported Models:**
| Provider | Models |
|----------|--------|
| **OpenAI** | GPT Image 1.5, GPT Image 1, DALL-E 3, DALL-E 2 |
| **Google** | Gemini 3 Pro Image, Imagen 3 |

### **Real-Time Streaming**

Get AI responses as they're generated:
- Server-Sent Events (SSE) support
- Works with all providers (OpenAI, Anthropic, Gemini)
- Async generator pattern for easy integration
- Automatic token counting and cost tracking

### **Credits-Based Billing**

Transparent, prepaid pricing model:
- Track costs in real-time
- Set spending limits
- Get alerts for low balances
- Transparent markup on provider costs
- Detailed cost breakdown by provider

### **Built-in Security**

Every request goes through automatic safety filters:
- **PII Detection** - Blocks emails, phone numbers, SSNs, credit cards
- **Content Safety** - Filters harmful keywords and prompt injection attempts
- **Safety Scores** - Every request gets a safety score for compliance

### **Global Observability**

Track everything across all primitives in your dashboard:
- **Unified Analytics** — One view for Gateway, Compute, and Workflow performance.
- **Cost Integrity** — Real-time tracking per project, provider, and primitive.
- **Safety Monitoring** — Instant visibility into filtered requests and security events.
- **Latency Heatmaps** — Monitor performance across the globe and between providers.

### **API Keys**

Two types of API keys for different use cases:

| Type | Prefix | Use Case |
|------|--------|----------|
| **Secret** | `csk_` | Server-side only, never expose in client |
| **Publishable** | `cpk_` | Browser-safe, requires domain whitelisting |
| **Test** | `csk_test_` / `cpk_test_` | Development environment |
| **Legacy** | `cen_` | Existing keys, treated as secret |

### **Rate Limiting**

Database-backed rate limiting prevents abuse and controls costs.

### **Agent Framework Support**

Cencori works with any OpenAI-compatible agent framework:

- **CrewAI** - Set `OPENAI_API_BASE=https://api.cencori.com/v1`
- **AutoGen** - Use `base_url` in config
- **LangChain** - Pass `base_url` to ChatOpenAI
- **OmniCoreAgent** - Configure in model_config

One line change → full observability, failover, and security for all agent calls.

**Note:** Add your provider keys (OpenAI, Anthropic, etc.) in Cencori first—we route to providers using your keys.

### **Complete Audit Logs**

Every request is logged with:
- Timestamp and user
- Request/response payloads
- Token usage and cost breakdown
- Provider and model used
- Safety scores and filter results

### **Cencori Scan**

Security scanner for AI apps. Runs in your terminal:

```bash
npx @cencori/scan
```

**Features:**
- Detects 50+ types of secrets (OpenAI, Anthropic, Stripe, AWS, etc.)
- Finds PII, exposed routes, SQL injection, XSS vulnerabilities
- A-F security scoring with detailed reports
- **AI-powered auto-fix** - automatically fixes issues with your API key

```bash
npx @cencori/scan --json      # CI/CD mode
npx @cencori/scan --quiet     # Score only
```

See the [full documentation](packages/scan/README.md) for details.

## Who Is Cencori For?

### For Developers Using AI Tools
Building with Cursor, Lovable, Bolt, v0, or Windsurf?

**Cencori helps you:**
- Ship AI features faster with security built-in
- Catch issues AI-generated code might miss
- Move from prototype to production safely
- Avoid vendor lock-in with multi-provider support

### For AI Product Companies
AI design tools, coding assistants, chatbots, content generators?

**Cencori provides:**
- Enterprise-grade security your customers demand
- Ready-made compliance story for B2B sales
- Infrastructure so you can focus on product
- Cost optimization across multiple providers

---

## Supported Models

| Provider | Models | Streaming |
|----------|--------|-----------|
| **OpenAI** | GPT-5, GPT-4o, GPT-4o Mini, o3, o1 | ✅ |
| **Anthropic** | Claude Opus 4, Sonnet 4, 3.5 Sonnet | ✅ |
| **Google** | Gemini 3 Pro, 2.5 Flash, 2.0 Flash | ✅ |
| **xAI** | Grok 4, Grok 4.1, Grok 3 | ✅ |
| **Mistral** | Mistral Large 3, Codestral, Devstral | ✅ |
| **DeepSeek** | V3.2, Reasoner, Coder V2 | ✅ |
| **Meta** | Llama 4 Maverick, Llama 3.3 70B | ✅ |
| **+ 7 more** | Groq, Cohere, Perplexity, Together, Qwen, OpenRouter, HuggingFace | ✅ |
| **Custom** | Any OpenAI/Anthropic compatible | ✅ |

### AI Gateway Endpoints

| Endpoint | Description | Providers |
|----------|-------------|-----------|
| `/api/ai/chat` | Chat completions (streaming) | OpenAI, Anthropic, Google, xAI, Mistral, DeepSeek |
| `/api/ai/embeddings` | Vector embeddings | OpenAI, Google, Cohere |
| `/api/ai/images/generate` | Image generation | OpenAI (GPT Image 1.5, DALL-E), Google (Imagen) |
| `/api/ai/audio/transcriptions` | Speech-to-text | OpenAI (Whisper) |
| `/api/ai/audio/speech` | Text-to-speech | OpenAI (TTS-1, TTS-1-HD) |
| `/api/ai/moderation` | Content moderation | OpenAI |
| `/api/ai/completions` | Legacy completions | OpenAI |

---

## Architecture

Cencori is built on a modern, scalable stack:

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Framework** | Next.js 15 (App Router) | Full-stack platform |
| **Auth & Database** | Supabase | Authentication & data |
| **Language** | TypeScript | Type-safe development |
| **Deployment** | Vercel | Hosting & CI/CD |
| **AI Providers** | OpenAI, Anthropic, Google | Multi-provider support |

---

## API Reference

### Non-Streaming Request

```typescript
POST /api/ai/chat
Headers: { "CENCORI_API_KEY": "your-api-key" }
Body: {
  "model": "gpt-4o",
  "messages": [
    { "role": "user", "content": "Hello!" }
  ],
  "temperature": 0.7,
  "maxTokens": 1000
}
```

### Streaming Request

```typescript
POST /api/ai/chat
Headers: { "CENCORI_API_KEY": "your-api-key" }
Body: {
  "model": "claude-3-opus",
  "messages": [
    { "role": "user", "content": "Tell me a story" }
  ],
  "stream": true
}
```

### Response (Non-Streaming)

```json
{
  "content": "Hello! How can I help you?",
  "model": "gpt-4o",
  "provider": "openai",
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 15,
    "total_tokens": 25
  },
  "cost_usd": 0.000025,
  "finish_reason": "stop"
}
```

**[Full API Documentation](https://cencori.com/docs)**

---

## SDK Examples

### Basic Chat

```typescript
import { Cencori } from 'cencori';

const cencori = new Cencori({ apiKey: process.env.CENCORI_API_KEY });

const response = await cencori.ai.chat({
  messages: [{ role: 'user', content: 'Explain quantum computing' }],
  model: 'gpt-4o',
  temperature: 0.7
});

console.log(response.content);
```

### Streaming with Async Generator

```typescript
const stream = cencori.ai.chatStream({
  messages: [
    { role: 'system', content: 'You are a helpful assistant' },
    { role: 'user', content: 'Write a poem about AI' }
  ],
  model: 'claude-3-opus'
});

for await (const chunk of stream) {
  process.stdout.write(chunk.delta);
  
  if (chunk.finish_reason) {
    console.log('\\nDone!', chunk.finish_reason);
  }
}
```

### Error Handling

**JavaScript/TypeScript:**
```typescript
import { 
  Cencori, 
  AuthenticationError, 
  RateLimitError,
  SafetyError 
} from 'cencori';

try {
  const response = await cencori.ai.chat({...});
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid API key');
  } else if (error instanceof RateLimitError) {
    console.error('Rate limit exceeded');
  } else if (error instanceof SafetyError) {
    console.error('Content blocked:', error.reasons);
  }
}
```

**Python:**
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
    print("Rate limit exceeded")
except SafetyError as e:
    print(f"Content blocked: {e.reasons}")
```

**Go:**
```go
import "errors"

_, err := client.Chat.Create(ctx, params)

if errors.Is(err, cencori.ErrInvalidAPIKey) {
    // Handle invalid key
} else if errors.Is(err, cencori.ErrRateLimited) {
    // Handle rate limit
} else if errors.Is(err, cencori.ErrContentFiltered) {
    // Handle safety filter
}
```

---

## Development Setup

### Prerequisites

- Node.js 18+
- A Supabase project (free tier works)
- API keys for providers (OpenAI, Anthropic, Google)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/bolaabanjo/cencori.git
   cd cencori
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env.local` file:
   ```env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   
   # AI Providers
   OPENAI_API_KEY=sk-...
   ANTHROPIC_API_KEY=sk-ant-...
   GOOGLE_AI_API_KEY=your_gemini_key
   
   # Security
   ENCRYPTION_SECRET=your_32_byte_base64_key
   ```

4. Run database migrations:
   ```bash
   # Apply migrations in database/migrations/ to your Supabase project
   ```

5. Run the development server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) to see the dashboard.

---

## Pricing

Cencori uses a prepaid credits system with transparent markup on provider costs:

- **Free Tier**: Gemini access only
- **Paid Tiers**: Access to OpenAI, Anthropic, and custom providers
- **Credits**: Pay-as-you-go with no monthly fees
- **Transparent Pricing**: See exact provider cost + markup

View detailed pricing at [cencori.com/pricing](https://cencori.com/pricing)

---

## Roadmap

**Phase 1 ✅ (Complete)**
- Basic AI gateway with Gemini
- Security monitoring
- Dashboard and analytics

**Phase 2 ✅ (Complete)**
- Multi-provider support (OpenAI, Anthropic)
- Streaming responses
- Credits system
- Custom providers

**Phase 3 ✅ (Complete)**
- Bring Your Own Keys (BYOK)
- Vercel AI SDK provider (`@cencori/ai-sdk`)
- Provider failover and circuit breaker
- Enhanced analytics with provider breakdowns

**Phase 4 ✅ (Complete)**
- Cencori Scan CLI (`@cencori/scan`)
- AI-powered auto-fix with Llama 4 Scout
- Security telemetry and analytics
- 50+ detection patterns (secrets, PII, vulnerabilities)

**Phase 5 🚧 (In Progress)**
- Cencori Scan web UI (scan.cencori.com)
- **Unified 5-Primitive Suite** (Gateway, Compute, Workflow, Storage, Integration)
- Advanced cost optimization
- Payment integration for credit top-ups
- Additional providers (Cohere, Together.ai, Groq)

**Future**
- A/B testing infrastructure
- Model performance comparison
- Fine-tuning support

---

## Contributing

We love contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

---

## Support

- **Documentation**: [docs.cencori.com](https://docs.cencori.com)
- **Dashboard**: [cencori.com/dashboard](https://cencori.com/dashboard)
- **GitHub**: [github.com/bolaabanjo/cencori](https://github.com/bolaabanjo/cencori)
- **Issues**: [Report a bug](https://github.com/bolaabanjo/cencori/issues)

---

## License

MIT © FohnAI

---

**Built by developers, for developers. Ship AI features with confidence.**