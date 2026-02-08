"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock, CodeBlockCopyButton } from "@/components/ai-elements/code-block";

export default function ChatEndpointDocs() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Chat Endpoint
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Complete reference for the chat completions API. Supports streaming, tool calling, and structured output.
                </p>
            </div>

            {/* Endpoint */}
            <div className="space-y-4">
                <h2 id="endpoint" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Endpoint
                </h2>
                <CodeBlock code="POST /api/ai/chat" language="bash">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Request */}
            <div className="space-y-4">
                <h2 id="request" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Request Body
                </h2>

                <CodeBlock code={`{
  "model": "gpt-4o",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello!" }
  ],
  "temperature": 0.7,
  "max_tokens": 1000,
  "stream": false
}`} language="json">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Parameters */}
            <div className="space-y-4">
                <h2 id="params" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Parameters
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-2 font-semibold">Parameter</th>
                                <th className="text-left py-2 font-semibold">Type</th>
                                <th className="text-left py-2 font-semibold">Description</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">model</code></td>
                                <td className="py-2">string</td>
                                <td className="py-2">Model ID (required)</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">messages</code></td>
                                <td className="py-2">array</td>
                                <td className="py-2">Conversation messages (required)</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">temperature</code></td>
                                <td className="py-2">number</td>
                                <td className="py-2">0-2, lower = focused (default: 1)</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">max_tokens</code></td>
                                <td className="py-2">number</td>
                                <td className="py-2">Maximum response tokens</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">stream</code></td>
                                <td className="py-2">boolean</td>
                                <td className="py-2">Enable streaming (default: false)</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">tools</code></td>
                                <td className="py-2">array</td>
                                <td className="py-2">Function definitions for tool calling</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Response */}
            <div className="space-y-4">
                <h2 id="response" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Response
                </h2>

                <CodeBlock code={`{
  "id": "chat-abc123",
  "object": "chat.completion",
  "model": "gpt-4o",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Hello! How can I help you today?"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 10,
    "total_tokens": 35
  }
}`} language="json">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Supported Models */}
            <div className="space-y-4">
                <h2 id="models" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Supported Models
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-2 font-semibold">Provider</th>
                                <th className="text-left py-2 font-semibold">Models</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="py-2">OpenAI</td>
                                <td className="py-2">gpt-5, gpt-4o, gpt-4o-mini, o3, o1</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2">Anthropic</td>
                                <td className="py-2">claude-opus-4, claude-sonnet-4, claude-3-5-sonnet</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2">Google</td>
                                <td className="py-2">gemini-3-pro, gemini-2.5-flash, gemini-2.0-flash</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2">xAI</td>
                                <td className="py-2">grok-4, grok-4.1, grok-3</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/ai/structured-output">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Structured Output</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/ai/endpoints/images">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Images</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
