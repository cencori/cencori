"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock, CodeBlockCopyButton } from "@/components/ai-elements/code-block";

export default function CencoriSDKDocs() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Cencori SDK
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    The official Cencori SDK for Node.js and TypeScript. Simple, type-safe API for chat, images, embeddings, memory, and more.
                </p>
            </div>

            {/* Installation */}
            <div className="space-y-4">
                <h2 id="installation" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Installation
                </h2>

                <CodeBlock code="npm install cencori" language="bash">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Initialization */}
            <div className="space-y-4">
                <h2 id="init" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Initialization
                </h2>

                <CodeBlock code={`import { Cencori } from 'cencori';

const cencori = new Cencori({
  apiKey: 'csk_...',  // or process.env.CENCORI_API_KEY
});`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Chat */}
            <div className="space-y-4">
                <h2 id="chat" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Chat Completions
                </h2>

                <CodeBlock code={`// Basic chat
const response = await cencori.ai.chat({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' }
  ]
});

console.log(response.content);
console.log(response.usage); // { prompt_tokens, completion_tokens, total_tokens }`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Streaming */}
            <div className="space-y-4">
                <h2 id="streaming" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Streaming
                </h2>

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

            {/* Images */}
            <div className="space-y-4">
                <h2 id="images" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Image Generation
                </h2>

                <CodeBlock code={`const response = await cencori.ai.generateImage({
  prompt: 'A futuristic city at sunset',
  model: 'gpt-image-1.5',  // or 'dall-e-3', 'imagen-3'
  size: '1024x1024',
  quality: 'hd'
});

console.log(response.images[0].url);`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Embeddings */}
            <div className="space-y-4">
                <h2 id="embeddings" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Embeddings
                </h2>

                <CodeBlock code={`const response = await cencori.ai.embeddings({
  model: 'text-embedding-3-small',
  input: 'Hello world'
});

console.log(response.embeddings[0]); // [0.1, 0.2, ...]`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Memory */}
            <div className="space-y-4">
                <h2 id="memory" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Memory (Context Store)
                </h2>

                <CodeBlock code={`// Store a memory
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

// RAG helper
const response = await cencori.ai.rag({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Refund policy?' }],
  namespace: 'docs'
});`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* All Methods */}
            <div className="space-y-4">
                <h2 id="methods" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Available Methods
                </h2>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-2 font-semibold">Method</th>
                                <th className="text-left py-2 font-semibold">Description</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">cencori.ai.chat()</code></td>
                                <td className="py-2">Chat completions</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">cencori.ai.chatStream()</code></td>
                                <td className="py-2">Streaming chat</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">cencori.ai.generateImage()</code></td>
                                <td className="py-2">Image generation</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">cencori.ai.embeddings()</code></td>
                                <td className="py-2">Vector embeddings</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">cencori.ai.rag()</code></td>
                                <td className="py-2">RAG with memory search</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">cencori.memory.store()</code></td>
                                <td className="py-2">Store memory</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">cencori.memory.search()</code></td>
                                <td className="py-2">Semantic search</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/ai/gateway">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">AI Gateway</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/ai/vercel-sdk">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Vercel AI SDK</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
