import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function MultiProviderPage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Multi-Provider Support
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Use OpenAI, Anthropic, and Google Gemini through one unified API. Switch providers with a single parameter - no code changes required.
                </p>
            </div>

            {/* Overview */}
            <div className="space-y-4">
                <h2 id="overview" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Overview
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    One of Cencori&apos;s most powerful features is multi-provider support. Instead of being locked into one AI provider, you can use multiple providers through a single, unified API.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    This gives you:
                </p>
                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc"><strong>No vendor lock-in:</strong> Switch providers anytime</li>
                    <li className="list-disc"><strong>Cost optimization:</strong> Use the cheapest model for each task</li>
                    <li className="list-disc"><strong>Reliability:</strong> Fallback to another provider if one is down</li>
                    <li className="list-disc"><strong>Quality comparison:</strong> A/B test different models</li>
                </ul>
            </div>

            {/* Supported Providers */}
            <div className="space-y-4">
                <h2 id="supported-providers" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Supported Providers
                </h2>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left p-3 font-semibold">Provider</th>
                                <th className="text-left p-3 font-semibold">Models</th>
                                <th className="text-left p-3 font-semibold">Streaming</th>
                                <th className="text-left p-3 font-semibold">Status</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="p-3 font-medium">OpenAI</td>
                                <td className="p-3">GPT-4, GPT-4 Turbo, GPT-4o, GPT-3.5</td>
                                <td className="p-3">YES</td>
                                <td className="p-3">Production</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-medium">Anthropic</td>
                                <td className="p-3">Claude 3 Opus, Sonnet, Haiku</td>
                                <td className="p-3">YES</td>
                                <td className="p-3">Production</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-medium">Google</td>
                                <td className="p-3">Gemini 2.5 Flash, 2.0 Flash</td>
                                <td className="p-3">YES</td>
                                <td className="p-3">Production</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-medium">Custom</td>
                                <td className="p-3">Any OpenAI/Anthropic compatible</td>
                                <td className="p-3">YES</td>
                                <td className="p-3">Production</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* How to Switch Providers */}
            <div className="space-y-4">
                <h2 id="switching-providers" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    How to Switch Providers
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Switching providers is as simple as changing the <code className="text-xs bg-muted px-1.5 py-0.5 rounded">model</code> parameter:
                </p>

                <CodeBlock
                    filename="switching-providers.ts"
                    language="typescript"
                    code={`import { Cencori } from 'cencori';

const cencori = new Cencori({ apiKey: process.env.CENCORI_API_KEY });

// Use OpenAI
const gptResponse = await cencori.ai.chat({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }]
});

// Use Anthropic
const claudeResponse = await cencori.ai.chat({
  model: 'claude-3-opus',
  messages: [{ role: 'user', content: 'Hello!' }]
});

// Use Google Gemini
const geminiResponse = await cencori.ai.chat({
  model: 'gemini-2.5-flash',
  messages: [{ role: 'user', content: 'Hello!' }]
});

// All responses have the same format!`}
                />

                <div className="mt-4 p-4 bg-muted/20 border border-border/40">
                    <p className="text-xs text-muted-foreground">
                        <strong>Note:</strong> The response format is identical regardless of provider, making it easy to switch without changing your application code.
                    </p>
                </div>
            </div>

            {/* Model Selection Strategy */}
            <div className="space-y-4">
                <h2 id="model-selection" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Model Selection Strategy
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Different models excel at different tasks. Here&apos;s how to choose:
                </p>

                <div className="space-y-6 mt-6">
                    <div className="space-y-2">
                        <h3 className="text-base font-semibold">For Maximum Quality</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Use <code className="text-xs bg-muted px-1.5 py-0.5 rounded">gpt-4o</code> or <code className="text-xs bg-muted px-1.5 py-0.5 rounded">claude-3-opus</code> for complex reasoning, code generation, and critical tasks.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-base font-semibold">For Speed and Cost</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Use <code className="text-xs bg-muted px-1.5 py-0.5 rounded">gemini-2.5-flash</code> or <code className="text-xs bg-muted px-1.5 py-0.5 rounded">gpt-3.5-turbo</code> for simple tasks, high-volume applications, and real-time chat.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-base font-semibold">For Long Context</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Use <code className="text-xs bg-muted px-1.5 py-0.5 rounded">claude-3-opus</code> (200K tokens) or <code className="text-xs bg-muted px-1.5 py-0.5 rounded">gpt-4-turbo</code> (128K tokens) for document analysis and long conversations.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-base font-semibold">For Balanced Performance</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Use <code className="text-xs bg-muted px-1.5 py-0.5 rounded">claude-3-sonnet</code> for a good balance of quality, speed, and cost.
                        </p>
                    </div>
                </div>
            </div>

            {/* Cost Comparison */}
            <div className="space-y-4">
                <h2 id="cost-comparison" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Cost Comparison
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Different providers have different pricing. See the full breakdown in the <Link href="/docs/concepts/models" className="text-primary hover:underline">Models Reference</Link>.
                </p>

                <div className="overflow-x-auto mt-4">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left p-3 font-semibold">Model</th>
                                <th className="text-left p-3 font-semibold">Provider</th>
                                <th className="text-left p-3 font-semibold">Cost/1M tokens</th>
                                <th className="text-left p-3 font-semibold">Best For</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="p-3">gemini-2.5-flash</td>
                                <td className="p-3">Google</td>
                                <td className="p-3">~$0.50</td>
                                <td className="p-3">Speed & Cost</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">gpt-3.5-turbo</td>
                                <td className="p-3">OpenAI</td>
                                <td className="p-3">~$1.50</td>
                                <td className="p-3">Speed</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">claude-3-haiku</td>
                                <td className="p-3">Anthropic</td>
                                <td className="p-3">~$2.50</td>
                                <td className="p-3">Balance</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">gpt-4o</td>
                                <td className="p-3">OpenAI</td>
                                <td className="p-3">~$15.00</td>
                                <td className="p-3">Quality</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">claude-3-opus</td>
                                <td className="p-3">Anthropic</td>
                                <td className="p-3">~$75.00</td>
                                <td className="p-3">Max Quality</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 p-4 bg-muted/20 border border-border/40">
                    <p className="text-xs text-muted-foreground">
                        <strong>Tip:</strong> Cencori shows you the exact cost for each request in your dashboard, making it easy to optimize spending.
                    </p>
                </div>
            </div>

            {/* Dynamic Provider Selection */}
            <div className="space-y-4">
                <h2 id="dynamic-selection" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Dynamic Provider Selection
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    You can programmatically choose providers based on user tier, task complexity, or cost budget:
                </p>

                <CodeBlock
                    filename="dynamic-selection.ts"
                    language="typescript"
                    code={`async function chooseModel(taskComplexity: 'simple' | 'complex', userTier: 'free' | 'pro'): Promise<string> {
  // Free tier users get fast, cheap models
  if (userTier === 'free') {
    return 'gemini-2.5-flash';
  }
  
  // Pro users get quality based on task
  if (taskComplexity === 'complex') {
    return 'gpt-4o'; // Best quality for complex tasks
  }
  
  return 'claude-3-sonnet'; // Balanced for simple pro tasks
}

// Use it in your app
const model = await chooseModel('complex', 'pro');
const response = await cencori.ai.chat({
  model,
  messages: messages,
});`}
                />
            </div>

            {/* Provider-Specific Features */}
            <div className="space-y-4">
                <h2 id="provider-features" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Provider-Specific Features
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    While Cencori normalizes the API, some providers have unique capabilities:
                </p>

                <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <h3 className="text-base font-semibold">OpenAI</h3>
                        <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                            <li className="list-disc">Function calling</li>
                            <li className="list-disc">JSON mode</li>
                            <li className="list-disc">Vision support (GPT-4 Vision)</li>
                        </ul>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-base font-semibold">Anthropic</h3>
                        <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                            <li className="list-disc">200K+ token context window</li>
                            <li className="list-disc">System message separation</li>
                            <li className="list-disc">Strong instruction following</li>
                        </ul>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-base font-semibold">Google Gemini</h3>
                        <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                            <li className="list-disc">Extremely fast responses</li>
                            <li className="list-disc">Low cost</li>
                            <li className="list-disc">Multimodal support</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Fallback Strategy */}
            <div className="space-y-4">
                <h2 id="fallback-strategy" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Fallback Strategy (Coming Soon)
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Cencori will soon support automatic fallback: if one provider is down or rate-limited, your request automatically routes to a backup provider.
                </p>

                <div className="mt-4 p-4 bg-muted/20 border border-border/40">
                    <p className="text-xs text-muted-foreground">
                        <strong>Roadmap:</strong> Automatic fallback, model routing based on latency, and cost-optimized selection coming in Q2 2026.
                    </p>
                </div>
            </div>

            {/* Next Steps */}
            <div className="space-y-4">
                <h2 id="next-steps" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Next Steps
                </h2>
                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">
                        <Link href="/docs/concepts/models" className="text-primary hover:underline">
                            View complete model reference
                        </Link>
                    </li>
                    <li className="list-disc">
                        <Link href="/docs/concepts/streaming" className="text-primary hover:underline">
                            Learn about streaming responses
                        </Link>
                    </li>
                    <li className="list-disc">
                        <Link href="/docs/guides/cost-optimization" className="text-primary hover:underline">
                            Optimize costs with smart model selection
                        </Link>
                    </li>
                </ul>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/concepts/api-keys">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">API Keys</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/concepts/streaming">
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
