"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock, CodeBlockCopyButton } from "@/components/ai-elements/code-block";

export default function RAGDocs() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    RAG (Retrieval-Augmented Generation)
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Combine memory search with AI chat in a single call. Build context-aware AI that knows your data.
                </p>
            </div>

            {/* What is RAG */}
            <div className="space-y-4">
                <h2 id="what" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    What is RAG?
                </h2>
                <p className="text-sm text-muted-foreground">
                    RAG automatically retrieves relevant memories and injects them into the AI prompt. The model answers using your stored knowledge, not just its training data.
                </p>
                <ol className="space-y-2 text-sm ml-6 list-decimal">
                    <li>User asks a question</li>
                    <li>System searches your memories for relevant context</li>
                    <li>Context is injected into the AI prompt</li>
                    <li>AI responds using your specific data</li>
                </ol>
            </div>

            {/* One-Call RAG */}
            <div className="space-y-4">
                <h2 id="one-call" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    One-Call RAG
                </h2>

                <CodeBlock code={`const response = await cencori.ai.rag({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'What is our refund policy?' }],
  namespace: 'docs',
  limit: 5,
  minScore: 0.7
});

console.log(response.content);
// "Based on your documentation, refunds are available within 30 days..."

// See what was retrieved
console.log(response.context);
// [{ content: 'Refund policy...', score: 0.92 }, ...]`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Parameters */}
            <div className="space-y-4">
                <h2 id="params" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    RAG Parameters
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
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">namespace</code></td>
                                <td className="py-2">string</td>
                                <td className="py-2">Memory namespace to search</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">limit</code></td>
                                <td className="py-2">number</td>
                                <td className="py-2">Max memories to retrieve (default: 5)</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">minScore</code></td>
                                <td className="py-2">number</td>
                                <td className="py-2">Minimum similarity 0-1 (default: 0.5)</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Manual RAG */}
            <div className="space-y-4">
                <h2 id="manual" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Manual RAG (Custom Control)
                </h2>

                <CodeBlock code={`// 1. Search manually
const memories = await cencori.memory.search({
  namespace: 'docs',
  query: 'refund policy',
  limit: 3
});

// 2. Format context
const context = memories
  .map(m => m.content)
  .join('\\n---\\n');

// 3. Build prompt with context
const response = await cencori.ai.chat({
  model: 'gpt-4o',
  messages: [
    {
      role: 'system',
      content: \`Answer using this context:\\n\\n\${context}\`
    },
    { role: 'user', content: 'What is our refund policy?' }
  ]
});`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Streaming RAG */}
            <div className="space-y-4">
                <h2 id="streaming" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Streaming RAG
                </h2>

                <CodeBlock code={`const stream = cencori.ai.ragStream({
  model: 'claude-opus-4',
  messages: [{ role: 'user', content: 'Explain our return process' }],
  namespace: 'support-docs'
});

for await (const chunk of stream) {
  process.stdout.write(chunk.delta);
}`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Best Practices */}
            <div className="space-y-4">
                <h2 id="best-practices" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Best Practices
                </h2>
                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc"><strong>Chunk documents:</strong> Split large docs into smaller memories (~500-1000 chars)</li>
                    <li className="list-disc"><strong>Use metadata:</strong> Add source, date, category for filtering</li>
                    <li className="list-disc"><strong>Set minScore:</strong> Filter low-relevance results (0.7+ recommended)</li>
                    <li className="list-disc"><strong>Limit context:</strong> 3-5 memories usually sufficient</li>
                </ul>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/ai/memory/store-search">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Store &amp; Search</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/ai">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Back to</span>
                            <span className="text-sm font-medium">AI Overview</span>
                        </span>
                    </Button>
                </Link>
            </div>
        </div>
    );
}
