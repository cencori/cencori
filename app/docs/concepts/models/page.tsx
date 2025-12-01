import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ModelsReferencePage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Models Reference
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Complete reference for all AI models available through Cencori, including capabilities, pricing, and context windows.
                </p>
            </div>

            {/* OpenAI Models */}
            <div className="space-y-4">
                <h2 id="openai" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    OpenAI Models
                </h2>

                <div className="space-y-6">
                    {/* GPT-4o */}
                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-3">gpt-4o</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-muted-foreground mb-1">Context Window</p>
                                <p className="font-medium">128,000 tokens</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">Max Output</p>
                                <p className="font-medium">4,096 tokens</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">Input Cost</p>
                                <p className="font-medium">$5.00 / 1M tokens</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">Output Cost</p>
                                <p className="font-medium">$15.00 / 1M tokens</p>
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-3">
                            OpenAI&apos;s flagship model with best-in-class performance across reasoning, coding, and creative tasks. Optimized for speed while maintaining quality.
                        </p>
                    </div>

                    {/* GPT-4 Turbo */}
                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-3">gpt-4-turbo</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-muted-foreground mb-1">Context Window</p>
                                <p className="font-medium">128,000 tokens</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">Max Output</p>
                                <p className="font-medium">4,096 tokens</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">Input Cost</p>
                                <p className="font-medium">$10.00 / 1M tokens</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">Output Cost</p>
                                <p className="font-medium">$30.00 / 1M tokens</p>
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-3">
                            Previous generation GPT-4 with large context window. Good for document analysis and long conversations.
                        </p>
                    </div>

                    {/* GPT-3.5 Turbo */}
                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-3">gpt-3.5-turbo</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-muted-foreground mb-1">Context Window</p>
                                <p className="font-medium">16,385 tokens</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">Max Output</p>
                                <p className="font-medium">4,096 tokens</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">Input Cost</p>
                                <p className="font-medium">$0.50 / 1M tokens</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">Output Cost</p>
                                <p className="font-medium">$1.50 / 1M tokens</p>
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-3">
                            Fast and cost-effective for simple tasks, chat applications, and high-volume use cases.
                        </p>
                    </div>
                </div>
            </div>

            {/* Anthropic Models */}
            <div className="space-y-4">
                <h2 id="anthropic" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Anthropic Models
                </h2>

                <div className="space-y-6">
                    {/* Claude 3 Opus */}
                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-3">claude-3-opus</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-muted-foreground mb-1">Context Window</p>
                                <p className="font-medium">200,000 tokens</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">Max Output</p>
                                <p className="font-medium">4,096 tokens</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">Input Cost</p>
                                <p className="font-medium">$15.00 / 1M tokens</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">Output Cost</p>
                                <p className="font-medium">$75.00 / 1M tokens</p>
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-3">
                            Anthropic&apos;s most capable model with exceptional reasoning and analysis. Best for complex tasks requiring nuanced understanding.
                        </p>
                    </div>

                    {/* Claude 3 Sonnet */}
                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-3">claude-3-sonnet</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-muted-foreground mb-1">Context Window</p>
                                <p className="font-medium">200,000 tokens</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">Max Output</p>
                                <p className="font-medium">4,096 tokens</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">Input Cost</p>
                                <p className="font-medium">$3.00 / 1M tokens</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">Output Cost</p>
                                <p className="font-medium">$15.00 / 1M tokens</p>
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-3">
                            Balanced model offering good performance at moderate cost. Ideal for most production use cases.
                        </p>
                    </div>

                    {/* Claude 3 Haiku */}
                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-3">claude-3-haiku</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-muted-foreground mb-1">Context Window</p>
                                <p className="font-medium">200,000 tokens</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">Max Output</p>
                                <p className="font-medium">4,096 tokens</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">Input Cost</p>
                                <p className="font-medium">$0.25 / 1M tokens</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">Output Cost</p>
                                <p className="font-medium">$1.25 / 1M tokens</p>
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-3">
                            Fastest Claude model with competitive pricing. Great for high-volume tasks and real-time applications.
                        </p>
                    </div>
                </div>
            </div>

            {/* Google Gemini Models */}
            <div className="space-y-4">
                <h2 id="google" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Google Gemini Models
                </h2>

                <div className="space-y-6">
                    {/* Gemini 2.5 Flash */}
                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-3">gemini-2.5-flash</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-muted-foreground mb-1">Context Window</p>
                                <p className="font-medium">1,000,000 tokens</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">Max Output</p>
                                <p className="font-medium">8,192 tokens</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">Input Cost</p>
                                <p className="font-medium">$0.15 / 1M tokens</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">Output Cost</p>
                                <p className="font-medium">$0.60 / 1M tokens</p>
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-3">
                            Latest Gemini model with massive 1M token context window. Extremely fast and cost-effective for most use cases.
                        </p>
                    </div>

                    {/* Gemini 2.0 Flash */}
                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-3">gemini-2.0-flash</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-muted-foreground mb-1">Context Window</p>
                                <p className="font-medium">1,000,000 tokens</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">Max Output</p>
                                <p className="font-medium">8,192 tokens</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">Input Cost</p>
                                <p className="font-medium">$0.10 / 1M tokens</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground mb-1">Output Cost</p>
                                <p className="font-medium">$0.40 / 1M tokens</p>
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-3">
                            Previous generation with 1M token context. Most cost-effective option for large document processing.
                        </p>
                    </div>
                </div>
            </div>

            {/* Model Selection Guide */}
            <div className="space-y-4">
                <h2 id="selection-guide" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Model Selection Guide
                </h2>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left p-3 font-semibold">Use Case</th>
                                <th className="text-left p-3 font-semibold">Recommended Model</th>
                                <th className="text-left p-3 font-semibold">Why</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="p-3">Chat applications</td>
                                <td className="p-3">gemini-2.5-flash</td>
                                <td className="p-3">Fast, cheap, good quality</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">Code generation</td>
                                <td className="p-3">gpt-4o</td>
                                <td className="p-3">Best coding capabilities</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">Document analysis</td>
                                <td className="p-3">claude-3-opus</td>
                                <td className="p-3">200K context, strong reasoning</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">Content generation</td>
                                <td className="p-3">claude-3-sonnet</td>
                                <td className="p-3">Balanced quality and cost</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">High-volume APIs</td>
                                <td className="p-3">gpt-3.5-turbo</td>
                                <td className="p-3">Fast, proven, low cost</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">Complex reasoning</td>
                                <td className="p-3">claude-3-opus</td>
                                <td className="p-3">Highest quality output</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Streaming Support */}
            <div className="space-y-4">
                <h2 id="streaming" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Streaming Support
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    All models support real-time streaming via Server-Sent Events (SSE). This allows you to display responses as they&apos;re generated, providing better user experience for chat interfaces.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Learn more in the <Link href="/docs/concepts/streaming" className="text-primary hover:underline">Streaming documentation</Link>.
                </p>
            </div>

            {/* Custom Providers */}
            <div className="space-y-4">
                <h2 id="custom" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Custom Providers
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    You can add custom AI providers that are compatible with OpenAI or Anthropic APIs. This includes:
                </p>
                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">Self-hosted models (Llama, Mistral, etc.)</li>
                    <li className="list-disc">Other cloud providers (Together.ai, Groq, etc.)</li>
                    <li className="list-disc">Internal company endpoints</li>
                </ul>
                <p className="text-sm text-muted-foreground leading-relaxed mt-3">
                    Learn more in the <Link href="/docs/concepts/custom-providers" className="text-primary hover:underline">Custom Providers guide</Link>.
                </p>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/concepts/multi-provider">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Multi-Provider</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/api/errors">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Error Reference</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
