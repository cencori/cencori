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
