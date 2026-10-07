# Provider Configuration

## Required Environment Variables

To use the multi-model provider support, you need to configure API keys for each provider in your `.env.local` file:

### OpenAI (Phase 2.2)
```bash
OPENAI_API_KEY="sk-..."
```
Get your key from: https://platform.openai.com/api-keys

### Anthropic (Phase 2.3)
```bash
ANTHROPIC_API_KEY="sk-ant-..."
```
Get your key from: https://console.anthropic.com/

### Google Gemini (Already configured)
```bash
GEMINI_API_KEY="..."
```

## Testing Provider Connections

After adding API keys, you can test each provider:

```typescript
import { OpenAIProvider, AnthropicProvider, GeminiProvider } from '@/lib/providers';

// Test OpenAI
const openai = new OpenAIProvider();
const openaiOk = await openai.testConnection();
console.log('OpenAI:', openaiOk ? '✅' : '❌');

// Test Anthropic  
const anthropic = new AnthropicProvider();
const anthropicOk = await anthropic.testConnection();
console.log('Anthropic:', anthropicOk ? '✅' : '❌');

// Test Gemini
const gemini = new GeminiProvider();
const geminiOk = await gemini.testConnection();
console.log('Gemini:', geminiOk ? '✅' : '❌');
```

## Transport controls (per-client fetch, timeout, retry, telemetry, budget)

Every adapter accepts an optional transport — per instance or per request —
so agent runtimes don't need to patch `globalThis.fetch`:

```typescript
import { OpenAICompatibleProvider } from '@/lib/providers';

const maximo = new OpenAICompatibleProvider('maximo', process.env.MAXIMO_API_KEY, undefined, undefined, {
    // Custom fetch (tracing proxy, test stub). Wrap safeProviderFetch unless
    // you mean to drop the SSRF guard. Gemini's SDK can't inject fetch and
    // ignores this field; everything else below still applies to it.
    fetch: myTracingFetch,
    timeoutMs: 90_000,      // per-attempt deadline (default 55s)
    maxRetries: 2,          // unary calls only; streams never retry (default 0)
    retryBaseDelayMs: 500,  // exponential backoff base; honors Retry-After
    hooks: {
        onAttempt: ({ provider, model, attempt }) => metrics.attempt(provider, model, attempt),
        onRetry: ({ provider, model, attempt, error, nextDelayMs }) => warn(...),
        onSettled: ({ provider, model, attempts, latencyMs, error }) => metrics.settled(...),
    },
});

// …or per call, without a new instance:
await maximo.chat({ model: 'maximo-atlas-1.3', messages, timeoutMs: 30_000, maxCostUsd: 0.05 });
```

Notes:

- Hooks never throw — telemetry can't break the call it observes.
- Only retryable failures retry (HTTP 408/429/5xx, attempt timeouts).
  Auth, bad requests, budget overruns, and caller cancellation fail fast.
- `maxCostUsd` throws `BudgetExceededError` (HTTP 402 `budget_exceeded`)
  carrying `costUsd` and `usage` for your circuit-breaker.
- Gateway API: `timeout_ms` and `max_cost_usd` request body fields on
  `/v1/chat/completions` and `/v1/responses`; `resolveGatewayProvider`
  also takes `transport` for registry-level hooks.
