import Link from "next/link";
import { ChevronLeft, ChevronRight, RefreshCw, AlertTriangle, Check, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function FailoverPage() {
    return (
        <div className="py-12 px-4 max-w-3xl mx-auto">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-8">
                <Link href="/docs" className="hover:text-foreground">Docs</Link>
                <span>/</span>
                <Link href="/docs/concepts" className="hover:text-foreground">Concepts</Link>
                <span>/</span>
                <span className="text-foreground">Failover</span>
            </div>

            {/* Header */}
            <h1 className="text-3xl font-bold mb-4">Provider Failover</h1>
            <p className="text-base text-muted-foreground mb-8">
                Automatic fallback to backup providers when your primary provider is unavailable, ensuring maximum uptime for your AI applications.
            </p>

            {/* Overview */}
            <section className="mb-12">
                <h2 className="text-xl font-semibold mb-4">Overview</h2>
                <p className="text-sm text-muted-foreground mb-4">
                    Cencori automatically handles provider failures by retrying requests and falling back to alternative providers. This ensures your users never see an error when a single provider has issues.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    <div className="p-4 rounded-md border border-border/40 bg-card">
                        <RefreshCw className="h-5 w-5 text-primary mb-2" />
                        <h3 className="text-sm font-medium mb-1">Automatic Retries</h3>
                        <p className="text-xs text-muted-foreground">Retries with exponential backoff before failover</p>
                    </div>
                    <div className="p-4 rounded-md border border-border/40 bg-card">
                        <Zap className="h-5 w-5 text-amber-500 mb-2" />
                        <h3 className="text-sm font-medium mb-1">Circuit Breaker</h3>
                        <p className="text-xs text-muted-foreground">Skips failing providers to reduce latency</p>
                    </div>
                    <div className="p-4 rounded-md border border-border/40 bg-card">
                        <Check className="h-5 w-5 text-emerald-500 mb-2" />
                        <h3 className="text-sm font-medium mb-1">Model Mapping</h3>
                        <p className="text-xs text-muted-foreground">Maps to equivalent models on fallback providers</p>
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="mb-12">
                <h2 className="text-xl font-semibold mb-4">How It Works</h2>
                <ol className="space-y-4 text-sm text-muted-foreground">
                    <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">1</span>
                        <div>
                            <strong className="text-foreground">Request arrives</strong> — Cencori routes to your requested model (e.g., <code className="text-xs bg-muted px-1 py-0.5 rounded">gpt-5</code>)
                        </div>
                    </li>
                    <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">2</span>
                        <div>
                            <strong className="text-foreground">Primary fails</strong> — Retries up to 3x with exponential backoff (100ms, 200ms, 400ms)
                        </div>
                    </li>
                    <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">3</span>
                        <div>
                            <strong className="text-foreground">Fallback activated</strong> — Routes to your configured fallback provider with equivalent model
                        </div>
                    </li>
                    <li className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">4</span>
                        <div>
                            <strong className="text-foreground">Response returned</strong> — Includes <code className="text-xs bg-muted px-1 py-0.5 rounded">fallback_used: true</code> so you know
                        </div>
                    </li>
                </ol>
            </section>

            {/* Configuration */}
            <section className="mb-12">
                <h2 className="text-xl font-semibold mb-4">Configuration</h2>
                <p className="text-sm text-muted-foreground mb-4">
                    Configure failover in your Project Settings → Infrastructure tab:
                </p>

                <div className="rounded-md border border-border/40 bg-card overflow-hidden">
                    <div className="p-4 border-b border-border/40">
                        <h3 className="text-sm font-medium">Failover Settings</h3>
                    </div>
                    <div className="p-4 space-y-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-sm font-medium">Enable automatic fallback</p>
                                <p className="text-xs text-muted-foreground">Route to backup providers on failure</p>
                            </div>
                            <div className="text-xs bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded">Enabled</div>
                        </div>
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-sm font-medium">Fallback provider</p>
                                <p className="text-xs text-muted-foreground">Preferred backup when primary fails</p>
                            </div>
                            <div className="text-xs font-mono">Anthropic</div>
                        </div>
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-sm font-medium">Max retries before fallback</p>
                                <p className="text-xs text-muted-foreground">Number of retry attempts</p>
                            </div>
                            <div className="text-xs font-mono">3</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Model Mapping */}
            <section className="mb-12">
                <h2 className="text-xl font-semibold mb-4">Model Mapping</h2>
                <p className="text-sm text-muted-foreground mb-4">
                    When falling back to another provider, Cencori maps your model to an equivalent:
                </p>

                <div className="rounded-md border border-border/40 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/30">
                            <tr>
                                <th className="text-left p-3 font-medium">Original Model</th>
                                <th className="text-left p-3 font-medium">→ Anthropic</th>
                                <th className="text-left p-3 font-medium">→ Google</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                            <tr>
                                <td className="p-3 font-mono text-xs">gpt-5</td>
                                <td className="p-3 font-mono text-xs">claude-opus-4</td>
                                <td className="p-3 font-mono text-xs">gemini-3-pro</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-xs">gpt-4o</td>
                                <td className="p-3 font-mono text-xs">claude-sonnet-4</td>
                                <td className="p-3 font-mono text-xs">gemini-2.5-flash</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-xs">claude-opus-4</td>
                                <td className="p-3 font-mono text-xs text-muted-foreground">—</td>
                                <td className="p-3 font-mono text-xs">gemini-3-pro</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-xs">gemini-3-pro</td>
                                <td className="p-3 font-mono text-xs">claude-opus-4</td>
                                <td className="p-3 font-mono text-xs text-muted-foreground">—</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Response Format */}
            <section className="mb-12">
                <h2 className="text-xl font-semibold mb-4">Response Format</h2>
                <p className="text-sm text-muted-foreground mb-4">
                    When a fallback is used, the response includes additional fields:
                </p>

                <CodeBlock
                    code={`{
  "content": "Hello! How can I help you today?",
  "model": "claude-opus-4",
  "provider": "anthropic",
  "fallback_used": true,
  "original_model": "gpt-5",
  "original_provider": "openai",
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 8,
    "total_tokens": 23
  },
  "cost_usd": 0.00023
}`}
                    language="json"
                />

                <div className="mt-4 p-4 rounded-md border border-amber-500/20 bg-amber-500/5">
                    <div className="flex gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Note on Streaming</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                For streaming responses, <code className="bg-muted px-1 py-0.5 rounded">fallback_used</code> is included in the first SSE chunk only.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Circuit Breaker */}
            <section className="mb-12">
                <h2 className="text-xl font-semibold mb-4">Circuit Breaker</h2>
                <p className="text-sm text-muted-foreground mb-4">
                    Cencori uses a circuit breaker pattern to prevent cascading failures:
                </p>

                <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 rounded-md border border-border/40">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <div>
                            <p className="text-sm font-medium">Closed (Normal)</p>
                            <p className="text-xs text-muted-foreground">All requests go to the provider</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-md border border-border/40">
                        <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                        <div>
                            <p className="text-sm font-medium">Open (After 5 failures)</p>
                            <p className="text-xs text-muted-foreground">Provider skipped, requests go directly to fallback</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-md border border-border/40">
                        <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                        <div>
                            <p className="text-sm font-medium">Half-Open (After 60s)</p>
                            <p className="text-xs text-muted-foreground">One test request sent; if successful, circuit closes</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Webhooks */}
            <section className="mb-12">
                <h2 className="text-xl font-semibold mb-4">Webhooks</h2>
                <p className="text-sm text-muted-foreground mb-4">
                    Get notified when failover occurs by subscribing to the <code className="text-xs bg-muted px-1 py-0.5 rounded">model.fallback</code> webhook event in your project settings.
                </p>
            </section>

            {/* Navigation */}
            <div className="flex justify-between pt-8 border-t border-border/40">
                <Link href="/docs/concepts/multi-provider">
                    <Button variant="outline" size="sm" className="text-xs">
                        <ChevronLeft className="h-3 w-3 mr-1" />
                        Multi-Provider
                    </Button>
                </Link>
                <Link href="/docs/concepts/rate-limiting">
                    <Button variant="outline" size="sm" className="text-xs">
                        Rate Limiting
                        <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
