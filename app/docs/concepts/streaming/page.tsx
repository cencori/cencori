import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function StreamingPage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Streaming
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Learn how to stream AI responses in real-time using Server-Sent Events for a better user experience.
                </p>
            </div>

            {/* Overview */}
            <div className="space-y-4">
                <h2 id="overview" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    What is Streaming?
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Streaming allows you to receive AI responses token-by-token as they&apos;re generated, rather than waiting for the complete response. This creates a better user experience, especially for long responses.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Instead of showing a loading spinner for 10 seconds, users see text appearing in real-time - just like ChatGPT.
                </p>
            </div>

            {/* Benefits */}
            <div className="space-y-4">
                <h2 id="benefits" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Why Use Streaming?
                </h2>

                <ul className="space-y-3 text-sm ml-6">
                    <li className="list-disc">
                        <strong>Better UX:</strong> Users see responses immediately instead of waiting
                    </li>
                    <li className="list-disc">
                        <strong>Perceived Performance:</strong> Feels faster even if total time is the same
                    </li>
                    <li className="list-disc">
                        <strong>Early Cancellation:</strong> Users can stop generation if they got what they need
                    </li>
                    <li className="list-disc">
                        <strong>Real-time Feedback:</strong> Users know the AI is working, not stuck
                    </li>
                </ul>
            </div>

            {/* How It Works */}
            <div className="space-y-4">
                <h2 id="how-it-works" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    How Streaming Works
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Cencori uses Server-Sent Events (SSE) for streaming:
                </p>

                <ol className="space-y-2 text-sm ml-6 list-decimal">
                    <li>Your app calls <code className="text-xs bg-muted px-1.5 py-0.5 rounded">cencori.ai.chatStream()</code></li>
                    <li>Cencori forwards the request to the AI provider</li>
                    <li>As the provider generates tokens, Cencori streams them back</li>
                    <li>Your app displays each chunk as it arrives</li>
                    <li>Stream ends when generation completes</li>
                </ol>

                <div className="mt-4 p-6 bg-muted/20 border border-border/40 rounded-lg">
                    <pre className="text-xs">
                        {`Client → Cencori → AI Provider
  ↓         ↓         ↓
Chunk 1 ← Chunk 1 ← Token 1, 2, 3
Chunk 2 ← Chunk 2 ← Token 4, 5, 6
  ...       ...       ...
Done    ← Done    ← Complete`}
                    </pre>
                </div>
            </div>

            {/* Basic Usage */}
            <div className="space-y-4">
                <h2 id="basic-usage" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Basic Usage
                </h2>

                <CodeBlock
                    filename="stream-example.ts"
                    language="typescript"
                    code={`import { Cencori } from 'cencori';

const cencori = new Cencori({ apiKey: process.env.CENCORI_API_KEY });

const stream = cencori.ai.chatStream({
  model: 'gpt-4o',
  messages: [
    { role: 'user', content: 'Tell me a story about AI' }
  ],
});

// Display chunks as they arrive
for await (const chunk of stream) {
  process.stdout.write(chunk.delta); // "Once", " upon", " a", " time", ...
  
  // Check if done
  if (chunk.finish_reason) {
    console.log('\\nGeneration complete:', chunk.finish_reason);
  }
}`}
                />
            </div>

            {/* React Example */}
            <div className="space-y-4">
                <h2 id="react-example" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    React/Next.js Example
                </h2>

                <div className="space-y-6">
                    <div>
                        <h3 className="text-base font-semibold mb-3">Server Route (API)</h3>
                        <CodeBlock
                            filename="app/api/chat/route.ts"
                            language="typescript"
                            code={`import { Cencori } from 'cencori';

export async function POST(req: Request) {
  const { messages } = await req.json();
  
  const cencori = new Cencori({ apiKey: process.env.CENCORI_API_KEY });
  
  const stream = cencori.ai.chatStream({
    model: 'gpt-4o',
    messages,
  });

  // Create ReadableStream for browser
  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        controller.enqueue(encoder.encode(chunk.delta));
      }
      controller.close();
    },
  });

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}`}
                        />
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-3">Client Component</h3>
                        <CodeBlock
                            filename="components/Chat.tsx"
                            language="typescript"
                            code={`'use client';

import { useState } from 'react';

export function Chat() {
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(message: string) {
    setLoading(true);
    setResponse('');

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: message }] }),
    });

    if (!res.body) return;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      setResponse(prev => prev + chunk);
    }

    setLoading(false);
  }

  return (
    <div>
      <div className="whitespace-pre-wrap">{response}</div>
      {loading && <div>Generating...</div>}
    </div>
  );
}`}
                        />
                    </div>
                </div>
            </div>

            {/* Node.js Server Example */}
            <div className="space-y-4">
                <h2 id="nodejs-example" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Node.js Server Example
                </h2>

                <CodeBlock
                    filename="server.ts"
                    language="typescript"
                    code={`import { Cencori } from 'cencori';
import express from 'express';

const app = express();
const cencori = new Cencori({ apiKey: process.env.CENCORI_API_KEY });

app.post('/chat', async (req, res) => {
  const { messages } = req.body;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = cencori.ai.chatStream({
      model: 'gpt-4o',
      messages,
    });

    for await (const chunk of stream) {
      // Send each chunk as SSE data
      res.write(\`data: \${JSON.stringify(chunk)}\\n\\n\`);
    }

    res.write('data: [DONE]\\n\\n');
    res.end();
  } catch (error) {
    res.write(\`data: \${JSON.stringify({ error: 'Stream failed' })}\\n\\n\`);
    res.end();
  }
});`}
                />
            </div>

            {/* Response Format */}
            <div className="space-y-4">
                <h2 id="response-format" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Stream Chunk Format
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Each chunk in the stream contains:
                </p>

                <CodeBlock
                    filename="chunk-format.ts"
                    language="typescript"
                    code={`interface StreamChunk {
  // The text delta for this chunk
  delta: string;
  
  // Reason why generation stopped (only on last chunk)
  finish_reason?: 'stop' | 'length' | 'content_filter' | 'error';
  
  // Error message if stream encountered an error (e.g., rate limit)
  error?: string;
}`}
                />

                <div className="space-y-2 mt-4 text-sm">
                    <p className="font-medium">Example chunks:</p>
                    <CodeBlock
                        filename="example-chunks.json"
                        language="json"
                        code={`{ "delta": "Once" }
{ "delta": " upon" }
{ "delta": " a" }
{ "delta": " time" }
{ "delta": "...", "finish_reason": "stop", "model": "gpt-4o", "provider": "openai" }`}
                    />
                </div>
            </div>

            {/* Error Handling */}
            <div className="space-y-4">
                <h2 id="error-handling" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Error Handling
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Handle errors gracefully during streaming:
                </p>

                <CodeBlock
                    filename="error-handling.ts"
                    language="typescript"
                    code={`const stream = cencori.ai.chatStream({
  model: 'gemini-2.5-flash',
  messages,
});

for await (const chunk of stream) {
  // Check for error in stream chunk (e.g., rate limit, provider failure)
  if (chunk.error) {
    console.error('Stream error:', chunk.error);
    // Handle gracefully - show user-friendly message
    showError('Could not complete the response. Please try again.');
    break;
  }
  
  // Normal processing
  if (chunk.delta) {
    appendToResponse(chunk.delta);
  }
  
  if (chunk.finish_reason === 'error') {
    console.error('Generation failed');
  }
}`}
                />
            </div>

            {/* Best Practices */}
            <div className="space-y-4">
                <h2 id="best-practices" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Best Practices
                </h2>

                <ul className="space-y-3 text-sm ml-6">
                    <li className="list-disc">
                        <strong>Show Loading State:</strong> Display a typing indicator before first chunk
                    </li>
                    <li className="list-disc">
                        <strong>Handle Connection Drops:</strong> Implement reconnection logic
                    </li>
                    <li className="list-disc">
                        <strong>Allow Cancellation:</strong> Let users stop generation early
                    </li>
                    <li className="list-disc">
                        <strong>Buffer Chunks:</strong> Avoid too many DOM updates by batching small chunks
                    </li>
                    <li className="list-disc">
                        <strong>Error Messages:</strong> Show user-friendly errors if stream fails
                    </li>
                    <li className="list-disc">
                        <strong>Timeout Protection:</strong> Set maximum generation time
                    </li>
                </ul>
            </div>

            {/* Provider Support */}
            <div className="space-y-4">
                <h2 id="provider-support" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Provider Support
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    All Cencori providers support streaming:
                </p>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left p-3 font-semibold">Provider</th>
                                <th className="text-left p-3 font-semibold">Streaming</th>
                                <th className="text-left p-3 font-semibold">Notes</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="p-3">OpenAI</td>
                                <td className="p-3">✅ Full support</td>
                                <td className="p-3">Native SSE streaming</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">Anthropic</td>
                                <td className="p-3">✅ Full support</td>
                                <td className="p-3">Native SSE streaming</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">Google Gemini</td>
                                <td className="p-3">✅ Full support</td>
                                <td className="p-3">Converted to SSE format</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">Custom</td>
                                <td className="p-3">✅ If compatible</td>
                                <td className="p-3">Must support streaming</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Troubleshooting */}
            <div className="space-y-4">
                <h2 id="troubleshooting" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Troubleshooting
                </h2>

                <div className="space-y-4">
                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-2">Stream Not Starting</h3>
                        <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                            <li className="list-disc">Verify API key is valid</li>
                            <li className="list-disc">Check model supports streaming</li>
                            <li className="list-disc">Ensure proper headers are set</li>
                        </ul>
                    </div>

                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-2">Stream Cuts Off Early</h3>
                        <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                            <li className="list-disc">Check server timeout settings</li>
                            <li className="list-disc">Verify <code className="text-xs bg-muted px-1.5 py-0.5 rounded">maxTokens</code> isn&apos;t too low</li>
                            <li className="list-disc">Look for connection drops</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/concepts/models">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Models</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/concepts/credits">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Credits System</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
