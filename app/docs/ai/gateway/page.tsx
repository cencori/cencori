"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock, CodeBlockCopyButton } from "@/components/ai-elements/code-block";

export default function AIGatewayDocs() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    AI Gateway
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    The secure, unified API layer for all your AI requests. Route to 14+ providers with built-in security, observability, and cost tracking.
                </p>
            </div>

            {/* Overview */}
            <div className="space-y-4">
                <h2 id="overview" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Overview
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The AI Gateway acts as a transparent proxy between your application and AI providers. Instead of integrating with OpenAI, Anthropic, and Google separately, you integrate once with Cencori and get:
                </p>
                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc"><strong>Multi-Provider Routing:</strong> Switch between providers with a single parameter</li>
                    <li className="list-disc"><strong>Automatic Security:</strong> PII detection, prompt injection protection, content filtering</li>
                    <li className="list-disc"><strong>Complete Observability:</strong> Every request logged with full prompts, responses, and costs</li>
                    <li className="list-disc"><strong>Failover &amp; Reliability:</strong> Automatic retries and provider fallback</li>
                    <li className="list-disc"><strong>Cost Tracking:</strong> Real-time usage and spend per project</li>
                </ul>
            </div>

            {/* Endpoints */}
            <div className="space-y-6">
                <h2 id="endpoints" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Available Endpoints
                </h2>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-2 font-semibold">Endpoint</th>
                                <th className="text-left py-2 font-semibold">Description</th>
                                <th className="text-left py-2 font-semibold">Providers</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">/api/ai/chat</code></td>
                                <td className="py-2">Chat completions (streaming)</td>
                                <td className="py-2">OpenAI, Anthropic, Google, xAI, Mistral, DeepSeek, Meta</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">/api/ai/embeddings</code></td>
                                <td className="py-2">Vector embeddings</td>
                                <td className="py-2">OpenAI, Google, Cohere</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">/api/ai/images/generate</code></td>
                                <td className="py-2">Image generation</td>
                                <td className="py-2">OpenAI, Google</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">/api/ai/audio/transcriptions</code></td>
                                <td className="py-2">Speech-to-text</td>
                                <td className="py-2">OpenAI (Whisper)</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">/api/ai/audio/speech</code></td>
                                <td className="py-2">Text-to-speech</td>
                                <td className="py-2">OpenAI (TTS)</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">/api/ai/moderation</code></td>
                                <td className="py-2">Content moderation</td>
                                <td className="py-2">OpenAI</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Chat Completions */}
            <div className="space-y-4">
                <h2 id="chat" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Chat Completions
                </h2>
                <p className="text-sm text-muted-foreground">
                    The primary endpoint for conversational AI. Supports streaming, tool calling, and structured output.
                </p>

                <div className="space-y-2">
                    <h3 className="text-base font-semibold">SDK Usage</h3>
                    <CodeBlock code={`const response = await cencori.ai.chat({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' }
  ],
  temperature: 0.7,
  maxTokens: 1000
});

console.log(response.content);
console.log(response.usage); // { prompt_tokens, completion_tokens, total_tokens }`} language="typescript">
                        <CodeBlockCopyButton />
                    </CodeBlock>
                </div>

                <div className="space-y-2">
                    <h3 className="text-base font-semibold">Streaming</h3>
                    <CodeBlock code={`const stream = cencori.ai.chatStream({
  model: 'claude-opus-4',
  messages: [{ role: 'user', content: 'Tell me a story' }]
});

for await (const chunk of stream) {
  process.stdout.write(chunk.delta);
}`} language="typescript">
                        <CodeBlockCopyButton />
                    </CodeBlock>
                </div>

                <div className="space-y-2">
                    <h3 className="text-base font-semibold">Tool Calling</h3>
                    <CodeBlock code={`const response = await cencori.ai.chat({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'What is the weather in Tokyo?' }],
  tools: [{
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get weather for a location',
      parameters: {
        type: 'object',
        properties: { location: { type: 'string' } },
        required: ['location']
      }
    }
  }]
});

if (response.toolCalls) {
  console.log(response.toolCalls);
}`} language="typescript">
                        <CodeBlockCopyButton />
                    </CodeBlock>
                </div>
            </div>

            {/* Embeddings */}
            <div className="space-y-4">
                <h2 id="embeddings" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Embeddings
                </h2>
                <p className="text-sm text-muted-foreground">
                    Generate vector embeddings for semantic search, RAG, and similarity comparisons.
                </p>

                <CodeBlock code={`const response = await cencori.ai.embeddings({
  model: 'text-embedding-3-small',
  input: 'Hello world'
});

console.log(response.embeddings[0]); // [0.1, 0.2, ...]`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Image Generation */}
            <div className="space-y-4">
                <h2 id="images" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Image Generation
                </h2>
                <p className="text-sm text-muted-foreground">
                    Generate images from text prompts using multiple providers.
                </p>

                <CodeBlock code={`const response = await cencori.ai.generateImage({
  prompt: 'A futuristic city at sunset',
  model: 'gpt-image-1.5',
  size: '1024x1024',
  quality: 'hd'
});

console.log(response.images[0].url);`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Security */}
            <div className="space-y-4">
                <h2 id="security" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Built-in Security
                </h2>
                <p className="text-sm text-muted-foreground">
                    Every request through the AI Gateway is automatically scanned for security threats.
                </p>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="border border-border/40 p-4 space-y-2">
                        <h3 className="text-sm font-semibold">Prompt Injection Protection</h3>
                        <p className="text-xs text-muted-foreground">
                            Detects and blocks attempts to manipulate AI behavior.
                        </p>
                    </div>
                    <div className="border border-border/40 p-4 space-y-2">
                        <h3 className="text-sm font-semibold">PII Detection</h3>
                        <p className="text-xs text-muted-foreground">
                            Scans and filters personally identifiable information.
                        </p>
                    </div>
                    <div className="border border-border/40 p-4 space-y-2">
                        <h3 className="text-sm font-semibold">Content Filtering</h3>
                        <p className="text-xs text-muted-foreground">
                            Blocks harmful content before it reaches AI providers.
                        </p>
                    </div>
                    <div className="border border-border/40 p-4 space-y-2">
                        <h3 className="text-sm font-semibold">Rate Limiting</h3>
                        <p className="text-xs text-muted-foreground">
                            Per-user, per-organization throttling. Prevents abuse.
                        </p>
                    </div>
                </div>
            </div>

            {/* Failover */}
            <div className="space-y-4">
                <h2 id="failover" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Provider Failover
                </h2>
                <p className="text-sm text-muted-foreground">
                    Automatic reliability with retries and fallback providers.
                </p>

                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc"><strong>Retry Logic:</strong> Exponential backoff, up to 3 attempts</li>
                    <li className="list-disc"><strong>Fallback Routing:</strong> If OpenAI fails, routes to Anthropic</li>
                    <li className="list-disc"><strong>Circuit Breaker:</strong> After 5 failures, provider skipped for 60s</li>
                </ul>

                <CodeBlock code={`// When fallback is used, response includes:
{
  "content": "Hello!",
  "model": "claude-opus-4",      // Actual model used
  "provider": "anthropic",
  "fallback_used": true,
  "original_model": "gpt-5",
  "original_provider": "openai"
}`} language="json">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Authentication */}
            <div className="space-y-4">
                <h2 id="auth" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Authentication
                </h2>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-2 font-semibold">Key Type</th>
                                <th className="text-left py-2 font-semibold">Prefix</th>
                                <th className="text-left py-2 font-semibold">Use Case</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="py-2">Secret Key</td>
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">csk_</code></td>
                                <td className="py-2">Server-side only</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2">Publishable Key</td>
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">cpk_</code></td>
                                <td className="py-2">Browser-safe, domain whitelisting</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <CodeBlock code={`// Header authentication
CENCORI_API_KEY: csk_your_secret_key

// Or Bearer token
Authorization: Bearer csk_your_secret_key`} language="bash">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/ai">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">AI Overview</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/ai/sdk">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Cencori SDK</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
