"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

export default function AIOverviewDocs() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    AI
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Build production-ready AI applications with a unified API, multi-provider routing, built-in security, and complete observability.
                </p>
            </div>

            {/* How It Works */}
            <div className="space-y-4">
                <h2 id="how-it-works" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    How It Works
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Cencori acts as a transparent proxy layer between your application and AI providers. Instead of calling OpenAI, Anthropic, or Google directly, you route requests through Cencori.
                </p>

                <div className="my-8 p-6 border border-border/40 bg-muted/5">
                    <div className="flex items-center justify-center gap-4 md:gap-8">
                        <div className="flex-1 max-w-[140px]">
                            <div className="border-2 border-border bg-background p-4 text-center">
                                <div className="text-xs font-semibold mb-1">Your</div>
                                <div className="text-xs font-semibold">Application</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="h-[2px] w-8 md:w-12 bg-border"></div>
                            <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-border border-b-[6px] border-b-transparent"></div>
                        </div>
                        <div className="flex-1 max-w-[140px]">
                            <div className="border-2 bg-primary/5 p-4 text-center">
                                <div className="text-xs font-bold text-primary">Cencori</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="h-[2px] w-8 md:w-12 bg-border"></div>
                            <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-border border-b-[6px] border-b-transparent"></div>
                        </div>
                        <div className="flex-1 max-w-[140px]">
                            <div className="border-2 border-border bg-background p-4 text-center">
                                <div className="text-xs font-semibold mb-1">AI Models</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Links */}
            <div className="space-y-4">
                <h2 id="sections" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Documentation
                </h2>

                <div className="grid gap-4 md:grid-cols-2">
                    <Link href="/docs/ai/gateway" className="group border border-border/40 p-4 hover:bg-muted/30 transition-colors">
                        <h3 className="text-sm font-semibold mb-1 group-hover:text-primary">AI Gateway</h3>
                        <p className="text-xs text-muted-foreground">
                            The secure proxy layer for all AI requests. Multi-provider routing, failover, and observability.
                        </p>
                        <div className="flex items-center text-xs text-primary mt-2">
                            Learn more <ChevronRight className="h-3 w-3 ml-1" />
                        </div>
                    </Link>

                    <Link href="/docs/ai/sdk" className="group border border-border/40 p-4 hover:bg-muted/30 transition-colors">
                        <h3 className="text-sm font-semibold mb-1 group-hover:text-primary">Cencori SDK</h3>
                        <p className="text-xs text-muted-foreground">
                            Our official SDK for Node.js and TypeScript. Simple API for chat, images, embeddings, and more.
                        </p>
                        <div className="flex items-center text-xs text-primary mt-2">
                            Learn more <ChevronRight className="h-3 w-3 ml-1" />
                        </div>
                    </Link>

                    <Link href="/docs/ai/vercel-sdk" className="group border border-border/40 p-4 hover:bg-muted/30 transition-colors">
                        <h3 className="text-sm font-semibold mb-1 group-hover:text-primary">Vercel AI SDK</h3>
                        <p className="text-xs text-muted-foreground">
                            Drop-in integration with Vercel AI SDK. Works with streamText(), generateText(), and useChat().
                        </p>
                        <div className="flex items-center text-xs text-primary mt-2">
                            Learn more <ChevronRight className="h-3 w-3 ml-1" />
                        </div>
                    </Link>

                    <Link href="/docs/ai/tanstack" className="group border border-border/40 p-4 hover:bg-muted/30 transition-colors">
                        <h3 className="text-sm font-semibold mb-1 group-hover:text-primary">TanStack AI</h3>
                        <p className="text-xs text-muted-foreground">
                            Integration with TanStack AI for React, Vue, and Solid. Framework-agnostic adapter.
                        </p>
                        <div className="flex items-center text-xs text-primary mt-2">
                            Learn more <ChevronRight className="h-3 w-3 ml-1" />
                        </div>
                    </Link>

                    <Link href="/docs/ai/providers" className="group border border-border/40 p-4 hover:bg-muted/30 transition-colors">
                        <h3 className="text-sm font-semibold mb-1 group-hover:text-primary">Providers</h3>
                        <p className="text-xs text-muted-foreground">
                            Supported providers and models: OpenAI, Anthropic, Google, xAI, Mistral, DeepSeek, Meta, and more.
                        </p>
                        <div className="flex items-center text-xs text-primary mt-2">
                            Learn more <ChevronRight className="h-3 w-3 ml-1" />
                        </div>
                    </Link>

                    <Link href="/docs/ai/failover" className="group border border-border/40 p-4 hover:bg-muted/30 transition-colors">
                        <h3 className="text-sm font-semibold mb-1 group-hover:text-primary">Failover</h3>
                        <p className="text-xs text-muted-foreground">
                            Automatic retries, provider fallback, and circuit breaker for reliable AI requests.
                        </p>
                        <div className="flex items-center text-xs text-primary mt-2">
                            Learn more <ChevronRight className="h-3 w-3 ml-1" />
                        </div>
                    </Link>
                </div>
            </div>

            {/* Endpoints */}
            <div className="space-y-4">
                <h2 id="endpoints" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Endpoints
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
                                <td className="py-2"><Link href="/docs/ai/endpoints/chat" className="text-primary hover:underline">Chat</Link></td>
                                <td className="py-2">Conversational AI with streaming</td>
                                <td className="py-2">OpenAI, Anthropic, Google, xAI, Mistral, DeepSeek</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><Link href="/docs/ai/endpoints/images" className="text-primary hover:underline">Images</Link></td>
                                <td className="py-2">Image generation from text</td>
                                <td className="py-2">OpenAI (GPT Image, DALL-E), Google (Imagen)</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><Link href="/docs/ai/endpoints/embeddings" className="text-primary hover:underline">Embeddings</Link></td>
                                <td className="py-2">Vector embeddings for RAG</td>
                                <td className="py-2">OpenAI, Google, Cohere</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><Link href="/docs/ai/endpoints/audio" className="text-primary hover:underline">Audio</Link></td>
                                <td className="py-2">Speech-to-text and text-to-speech</td>
                                <td className="py-2">OpenAI (Whisper, TTS)</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2"><Link href="/docs/ai/endpoints/moderation" className="text-primary hover:underline">Moderation</Link></td>
                                <td className="py-2">Content safety filtering</td>
                                <td className="py-2">OpenAI</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Memory */}
            <div className="space-y-4">
                <h2 id="memory" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    AI Memory
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Vector storage for RAG, conversation history, and semantic search. Store content with automatic embedding generation and retrieve it with natural language queries.
                </p>

                <div className="grid gap-4 md:grid-cols-2">
                    <Link href="/docs/ai/memory" className="group border border-border/40 p-4 hover:bg-muted/30 transition-colors">
                        <h3 className="text-sm font-semibold mb-1 group-hover:text-primary">Memory Overview</h3>
                        <p className="text-xs text-muted-foreground">Getting started with AI Memory</p>
                    </Link>
                    <Link href="/docs/ai/memory/rag" className="group border border-border/40 p-4 hover:bg-muted/30 transition-colors">
                        <h3 className="text-sm font-semibold mb-1 group-hover:text-primary">RAG</h3>
                        <p className="text-xs text-muted-foreground">Retrieval-augmented generation</p>
                    </Link>
                </div>
            </div>

            {/* Quick Start */}
            <div className="space-y-4">
                <h2 id="quick-start" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Quick Start
                </h2>

                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                    <code>{`import { Cencori } from 'cencori';

const cencori = new Cencori({ apiKey: 'csk_...' });

// Chat with any model
const response = await cencori.ai.chat({
  model: 'gpt-4o',  // or 'claude-opus-4', 'gemini-2.5-flash'
  messages: [{ role: 'user', content: 'Hello!' }]
});

console.log(response.content);`}</code>
                </pre>
            </div>
        </div>
    );
}
