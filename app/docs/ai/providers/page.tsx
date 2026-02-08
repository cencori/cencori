"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock, CodeBlockCopyButton } from "@/components/ai-elements/code-block";

export default function ProvidersDocs() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Providers
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Cencori supports 14+ AI providers with a unified API. Switch between providers by changing the model parameter.
                </p>
            </div>

            {/* Chat Models */}
            <div className="space-y-4">
                <h2 id="chat-models" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Chat Models
                </h2>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-2 font-semibold">Provider</th>
                                <th className="text-left py-2 font-semibold">Models</th>
                                <th className="text-left py-2 font-semibold">Context</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="py-2 font-medium text-foreground">OpenAI</td>
                                <td className="py-2">gpt-5, gpt-4o, gpt-4o-mini, o3, o3-mini, o1</td>
                                <td className="py-2">128K-256K</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2 font-medium text-foreground">Anthropic</td>
                                <td className="py-2">claude-opus-4, claude-sonnet-4, claude-3.7-sonnet, claude-3-5-haiku</td>
                                <td className="py-2">200K</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2 font-medium text-foreground">Google</td>
                                <td className="py-2">gemini-3-pro, gemini-2.5-flash, gemini-2.0-flash, gemini-2.0-flash-lite</td>
                                <td className="py-2">1M-2M</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2 font-medium text-foreground">xAI</td>
                                <td className="py-2">grok-4, grok-4.1, grok-3, grok-3-mini</td>
                                <td className="py-2">128K-256K</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2 font-medium text-foreground">Mistral</td>
                                <td className="py-2">mistral-large-3, mistral-medium, codestral, devstral</td>
                                <td className="py-2">32K-128K</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2 font-medium text-foreground">DeepSeek</td>
                                <td className="py-2">deepseek-v3.2, deepseek-chat, deepseek-reasoner</td>
                                <td className="py-2">64K</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2 font-medium text-foreground">Meta</td>
                                <td className="py-2">llama-4-maverick, llama-4-scout, llama-3.3-70b</td>
                                <td className="py-2">128K</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2 font-medium text-foreground">Qwen</td>
                                <td className="py-2">qwen3-coder, qwen2.5-72b</td>
                                <td className="py-2">128K</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Embedding Models */}
            <div className="space-y-4">
                <h2 id="embedding-models" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Embedding Models
                </h2>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-2 font-semibold">Provider</th>
                                <th className="text-left py-2 font-semibold">Model</th>
                                <th className="text-left py-2 font-semibold">Dimensions</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="py-2 font-medium text-foreground">OpenAI</td>
                                <td className="py-2">text-embedding-3-large</td>
                                <td className="py-2">3072</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2 font-medium text-foreground">OpenAI</td>
                                <td className="py-2">text-embedding-3-small</td>
                                <td className="py-2">1536</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2 font-medium text-foreground">Google</td>
                                <td className="py-2">text-embedding-004</td>
                                <td className="py-2">768</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2 font-medium text-foreground">Cohere</td>
                                <td className="py-2">embed-english-v3.0</td>
                                <td className="py-2">1024</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2 font-medium text-foreground">Cohere</td>
                                <td className="py-2">embed-multilingual-v3.0</td>
                                <td className="py-2">1024</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Image Models */}
            <div className="space-y-4">
                <h2 id="image-models" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Image Models
                </h2>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-2 font-semibold">Provider</th>
                                <th className="text-left py-2 font-semibold">Model</th>
                                <th className="text-left py-2 font-semibold">Best For</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="py-2 font-medium text-foreground">OpenAI</td>
                                <td className="py-2">gpt-image-1.5</td>
                                <td className="py-2">Text rendering, highest ELO</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2 font-medium text-foreground">OpenAI</td>
                                <td className="py-2">dall-e-3</td>
                                <td className="py-2">Creative, artistic</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2 font-medium text-foreground">Google</td>
                                <td className="py-2">gemini-3-pro-image</td>
                                <td className="py-2">High photorealism</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2 font-medium text-foreground">Google</td>
                                <td className="py-2">imagen-3</td>
                                <td className="py-2">Fast generation</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Audio Models */}
            <div className="space-y-4">
                <h2 id="audio-models" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Audio Models
                </h2>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-2 font-semibold">Type</th>
                                <th className="text-left py-2 font-semibold">Model</th>
                                <th className="text-left py-2 font-semibold">Provider</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="py-2 font-medium text-foreground">Speech-to-Text</td>
                                <td className="py-2">whisper-1</td>
                                <td className="py-2">OpenAI</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2 font-medium text-foreground">Text-to-Speech</td>
                                <td className="py-2">tts-1</td>
                                <td className="py-2">OpenAI</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2 font-medium text-foreground">Text-to-Speech HD</td>
                                <td className="py-2">tts-1-hd</td>
                                <td className="py-2">OpenAI</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Using Providers */}
            <div className="space-y-4">
                <h2 id="usage" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Using Providers
                </h2>
                <p className="text-sm text-muted-foreground">
                    Switch providers by changing the model parameter. No other code changes needed.
                </p>

                <CodeBlock code={`// OpenAI
await cencori.ai.chat({ model: 'gpt-4o', ... });

// Anthropic
await cencori.ai.chat({ model: 'claude-opus-4', ... });

// Google
await cencori.ai.chat({ model: 'gemini-2.5-flash', ... });

// xAI
await cencori.ai.chat({ model: 'grok-4', ... });

// DeepSeek
await cencori.ai.chat({ model: 'deepseek-v3.2', ... });`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Bring Your Own Key */}
            <div className="space-y-4">
                <h2 id="byok" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Bring Your Own Key
                </h2>
                <p className="text-sm text-muted-foreground">
                    Use your own API keys for direct billing with providers. Configure keys in project settings.
                </p>

                <CodeBlock code={`// Dashboard: Settings → Provider Keys

// Add your keys:
// - OpenAI: sk-...
// - Anthropic: sk-ant-...
// - Google: AIza...

// Requests automatically use your keys when configured`} language="bash">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/ai/tanstack">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">TanStack AI</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/ai/failover">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Failover</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
