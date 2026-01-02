![Cencori by FohnAI](public/Bonus.png)

# Cencori

**AI Infrastructure for Production**

The unified API for AI providers. Connect your app once, use OpenAI, Anthropic, or Google — with built-in security, observability, and cost control.

---

## Why Cencori?

Building AI features is easy. Building them for production is hard:

- **Provider lock-in** — Switching from OpenAI to Anthropic means rewriting code
- **Security gaps** — PII leaks, prompt injection, no audit trail
- **Cost surprises** — No visibility until the bill arrives
- **Compliance burden** — SOC2, GDPR, HIPAA require months of work

**Cencori solves all of this with one integration.**

- **One API** - Switch between OpenAI, Anthropic, and Google Gemini with a parameter change
- **Security** - Automatic PII detection, prompt injection protection, content filtering
- **Compliance** - Complete audit logs and safety scores for every request
- **Cost Control** - Real-time cost tracking with per-project budgets
- **Streaming** - Real-time AI responses with Server-Sent Events
- **Observability** - Analytics dashboard with usage patterns and security incidents

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

**That's it!** Cencori handles security, logging, and cost tracking automatically.

---

## Vercel AI SDK Integration

Using Vercel AI SDK (`ai` package)? Cencori is a drop-in provider:

```bash
npm install @cencori/ai-provider ai
```

```typescript
import { cencori } from '@cencori/ai-provider';
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

### **Real-time Analytics**

Track everything in your dashboard:
- Request counts by time period
- Cost tracking per project and provider
- Latency monitoring across providers
- Error rates and filtering stats
- Model usage breakdown

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

---

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
- Vercel AI SDK provider (`@cencori/ai-provider`)
- Provider failover and circuit breaker
- Enhanced analytics with provider breakdowns

**Phase 4 🚧 (In Progress)**
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