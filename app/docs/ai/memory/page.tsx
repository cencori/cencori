"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock, CodeBlockCopyButton } from "@/components/ai-elements/code-block";

export default function MemoryOverviewDocs() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    AI Memory
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Vector database for AI context. Store knowledge, semantic search, and build RAG applications without infrastructure.
                </p>
            </div>

            {/* What is AI Memory */}
            <div className="space-y-4">
                <h2 id="what" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    What is AI Memory?
                </h2>
                <p className="text-sm text-muted-foreground">
                    AI Memory is your vector database. Store text with automatic embeddings, search semantically, and inject context into AI conversations.
                </p>
                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc"><strong>Store:</strong> Add documents, notes, or any text. Vectors generated automatically.</li>
                    <li className="list-disc"><strong>Search:</strong> Find relevant context using natural language queries</li>
                    <li className="list-disc"><strong>RAG:</strong> Inject retrieved context into AI requests in one call</li>
                </ul>
            </div>

            {/* Quick Start */}
            <div className="space-y-4">
                <h2 id="quick-start" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Quick Start
                </h2>

                <CodeBlock code={`import { Cencori } from 'cencori';

const cencori = new Cencori({ apiKey: 'csk_...' });

// 1. Store a memory
await cencori.memory.store({
  namespace: 'docs',
  content: 'Refund policy allows returns within 30 days',
  metadata: { category: 'policy' }
});

// 2. Search memories
const results = await cencori.memory.search({
  namespace: 'docs',
  query: 'what is our refund policy?',
  limit: 5
});

// 3. RAG in one call
const response = await cencori.ai.rag({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'What is our refund policy?' }],
  namespace: 'docs'
});`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Features */}
            <div className="space-y-4">
                <h2 id="features" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Features
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-2 font-semibold">Feature</th>
                                <th className="text-left py-2 font-semibold">Description</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="py-2">Auto-Embeddings</td>
                                <td className="py-2">Vectors generated automatically from text</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2">Namespaces</td>
                                <td className="py-2">Organize memories by project, user, or topic</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2">Metadata</td>
                                <td className="py-2">Attach custom JSON for filtering</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2">Semantic Search</td>
                                <td className="py-2">Find similar content using meaning, not keywords</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2">One-Call RAG</td>
                                <td className="py-2">Search + inject + chat in single API call</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Use Cases */}
            <div className="space-y-4">
                <h2 id="use-cases" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Use Cases
                </h2>
                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc"><strong>Customer Support:</strong> Store FAQ, docs, policies for AI agents</li>
                    <li className="list-disc"><strong>Knowledge Base:</strong> Search internal documents semantically</li>
                    <li className="list-disc"><strong>Chat History:</strong> Store conversation context per user</li>
                    <li className="list-disc"><strong>Document Q&amp;A:</strong> Upload PDFs, query with natural language</li>
                </ul>
            </div>

            {/* Next Steps */}
            <div className="space-y-4">
                <h2 id="next" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Next Steps
                </h2>
                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc"><Link href="/docs/ai/memory/namespaces" className="text-primary hover:underline">Namespaces</Link> – Organize memories</li>
                    <li className="list-disc"><Link href="/docs/ai/memory/store-search" className="text-primary hover:underline">Store &amp; Search</Link> – API reference</li>
                    <li className="list-disc"><Link href="/docs/ai/memory/rag" className="text-primary hover:underline">RAG</Link> – Build context-aware AI</li>
                </ul>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/ai/endpoints/moderation">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Moderation</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/ai/memory/namespaces">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Namespaces</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
