"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock, CodeBlockCopyButton } from "@/components/ai-elements/code-block";

export default function FailoverDocs() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Failover
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Automatic reliability with intelligent retries, provider fallback, and circuit breaker patterns.
                </p>
            </div>

            {/* How It Works */}
            <div className="space-y-4">
                <h2 id="how-it-works" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    How It Works
                </h2>
                <p className="text-sm text-muted-foreground">
                    When a request fails, Cencori automatically retries with exponential backoff. If the primary provider is down, requests are routed to a fallback provider with an equivalent model.
                </p>

                <div className="my-8 p-6 border border-border/40 bg-muted/5">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-24 text-xs font-semibold">1. Request</div>
                            <div className="flex-1 h-[2px] bg-border"></div>
                            <div className="border border-border px-3 py-1 text-xs">OpenAI (gpt-4o)</div>
                            <div className="text-xs text-red-500">❌ 503</div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-24 text-xs font-semibold">2. Retry</div>
                            <div className="flex-1 h-[2px] bg-border"></div>
                            <div className="border border-border px-3 py-1 text-xs">OpenAI (gpt-4o)</div>
                            <div className="text-xs text-red-500">❌ 503</div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-24 text-xs font-semibold">3. Fallback</div>
                            <div className="flex-1 h-[2px] bg-primary/50"></div>
                            <div className="border border-primary px-3 py-1 text-xs text-primary">Anthropic (claude-opus-4)</div>
                            <div className="text-xs text-green-500">✓ 200</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Retry Logic */}
            <div className="space-y-4">
                <h2 id="retry" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Retry Logic
                </h2>

                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc"><strong>Max Retries:</strong> 3 attempts per provider</li>
                    <li className="list-disc"><strong>Backoff:</strong> Exponential (100ms, 200ms, 400ms)</li>
                    <li className="list-disc"><strong>Retryable Errors:</strong> 429 (rate limit), 500, 502, 503, 504</li>
                    <li className="list-disc"><strong>Non-Retryable:</strong> 400, 401, 403, 404 (fail immediately)</li>
                </ul>
            </div>

            {/* Fallback Routing */}
            <div className="space-y-4">
                <h2 id="fallback" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Fallback Routing
                </h2>
                <p className="text-sm text-muted-foreground">
                    When retries are exhausted, Cencori routes to an equivalent model from another provider.
                </p>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-2 font-semibold">Primary</th>
                                <th className="text-left py-2 font-semibold">Fallback 1</th>
                                <th className="text-left py-2 font-semibold">Fallback 2</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="py-2">gpt-5</td>
                                <td className="py-2">claude-opus-4</td>
                                <td className="py-2">gemini-3-pro</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2">gpt-4o</td>
                                <td className="py-2">claude-sonnet-4</td>
                                <td className="py-2">gemini-2.5-flash</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2">claude-opus-4</td>
                                <td className="py-2">gpt-5</td>
                                <td className="py-2">gemini-3-pro</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2">gemini-2.5-flash</td>
                                <td className="py-2">gpt-4o</td>
                                <td className="py-2">claude-sonnet-4</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Circuit Breaker */}
            <div className="space-y-4">
                <h2 id="circuit-breaker" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Circuit Breaker
                </h2>
                <p className="text-sm text-muted-foreground">
                    After multiple failures, a provider is temporarily bypassed to prevent cascading failures.
                </p>

                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc"><strong>Threshold:</strong> 5 consecutive failures</li>
                    <li className="list-disc"><strong>Open Duration:</strong> 60 seconds</li>
                    <li className="list-disc"><strong>Half-Open:</strong> Single test request after cooldown</li>
                    <li className="list-disc"><strong>Reset:</strong> On successful request</li>
                </ul>
            </div>

            {/* Response Format */}
            <div className="space-y-4">
                <h2 id="response" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Response Format
                </h2>
                <p className="text-sm text-muted-foreground">
                    When failover is used, the response includes metadata about the routing.
                </p>

                <CodeBlock code={`{
  "content": "Hello! How can I help you?",
  "model": "claude-opus-4",        // Actual model used
  "provider": "anthropic",
  "fallback_used": true,
  "original_model": "gpt-5",       // Original request
  "original_provider": "openai",
  "retry_count": 2,
  "usage": { ... }
}`} language="json">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Configuration */}
            <div className="space-y-4">
                <h2 id="config" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Configuration
                </h2>
                <p className="text-sm text-muted-foreground">
                    Customize failover behavior per project in the dashboard.
                </p>

                <CodeBlock code={`// Project Settings → Failover

{
  "enabled": true,
  "max_retries": 3,
  "fallback_enabled": true,
  "fallback_providers": ["anthropic", "google"],
  "circuit_breaker_threshold": 5,
  "circuit_breaker_duration": 60
}`} language="json">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Disable */}
            <div className="space-y-4">
                <h2 id="disable" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Disabling Failover
                </h2>

                <CodeBlock code={`// Per-request disable
const response = await cencori.ai.chat({
  model: 'gpt-4o',
  messages: [...],
  failover: false  // Disable for this request
});`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/ai/providers">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Providers</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/ai/streaming">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Streaming</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
