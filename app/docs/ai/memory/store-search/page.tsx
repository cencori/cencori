"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock, CodeBlockCopyButton } from "@/components/ai-elements/code-block";

export default function StoreSearchDocs() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Store &amp; Search
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Add memories and search them semantically. Vectors are generated automatically.
                </p>
            </div>

            {/* Store */}
            <div className="space-y-4">
                <h2 id="store" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Storing Memories
                </h2>

                <CodeBlock code={`const memory = await cencori.memory.store({
  namespace: 'docs',
  content: 'Refund policy allows returns within 30 days',
  metadata: {
    category: 'policy',
    source: 'faq',
    created: new Date().toISOString()
  }
});

console.log(memory.id); // 'mem_abc123...'`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Store Parameters */}
            <div className="space-y-4">
                <h2 id="store-params" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Store Parameters
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
                                <td className="py-2">Namespace to store in (required)</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">content</code></td>
                                <td className="py-2">string</td>
                                <td className="py-2">Text content (required)</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">metadata</code></td>
                                <td className="py-2">object</td>
                                <td className="py-2">Custom JSON metadata (optional)</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Search */}
            <div className="space-y-4">
                <h2 id="search" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Semantic Search
                </h2>

                <CodeBlock code={`const results = await cencori.memory.search({
  namespace: 'docs',
  query: 'what is our return policy?',
  limit: 5,
  minScore: 0.7
});

// Results
[
  {
    id: 'mem_abc123',
    content: 'Refund policy allows returns within 30 days',
    score: 0.92,
    metadata: { category: 'policy' }
  },
  // ...
]`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Search Parameters */}
            <div className="space-y-4">
                <h2 id="search-params" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Search Parameters
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
                                <td className="py-2">Namespace to search (required)</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">query</code></td>
                                <td className="py-2">string</td>
                                <td className="py-2">Search query (required)</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">limit</code></td>
                                <td className="py-2">number</td>
                                <td className="py-2">Max results (default: 10, max: 100)</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">minScore</code></td>
                                <td className="py-2">number</td>
                                <td className="py-2">Minimum similarity score 0-1 (default: 0)</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Bulk Store */}
            <div className="space-y-4">
                <h2 id="bulk" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Bulk Store
                </h2>

                <CodeBlock code={`await cencori.memory.storeBatch({
  namespace: 'docs',
  memories: [
    { content: 'FAQ answer 1', metadata: { id: 1 } },
    { content: 'FAQ answer 2', metadata: { id: 2 } },
    { content: 'FAQ answer 3', metadata: { id: 3 } }
  ]
});`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Delete */}
            <div className="space-y-4">
                <h2 id="delete" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Delete
                </h2>

                <CodeBlock code={`// Delete single memory
await cencori.memory.delete('mem_abc123');

// Delete all in namespace
await cencori.memory.deleteNamespace('old-data');`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/ai/memory/namespaces">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Namespaces</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/ai/memory/rag">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">RAG</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
