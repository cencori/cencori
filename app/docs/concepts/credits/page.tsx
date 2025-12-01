import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function CreditsSystemPage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Credits System
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Learn how Cencori&apos;s prepaid credits system works, including pricing, billing, and cost tracking.
                </p>
            </div>

            {/* Overview */}
            <div className="space-y-4">
                <h2 id="overview" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    How Credits Work
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Cencori uses a prepaid credits system instead of monthly subscriptions. You purchase credits upfront and they&apos;re deducted as you use AI models.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    1 credit = $1 USD. When you make a request, the cost is calculated and deducted from your organization&apos;s balance.
                </p>
            </div>

            {/* Why Credits */}
            <div className="space-y-4">
                <h2 id="why-credits" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Why Credits?
                </h2>

                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc"><strong>No Waste:</strong> Only pay for what you use</li>
                    <li className="list-disc"><strong>No Subscriptions:</strong> No monthly fees or commitments</li>
                    <li className="list-disc"><strong>Predictable Costs:</strong> Know exactly what each request costs</li>
                    <li className="list-disc"><strong>Flexible Budgets:</strong> Top up as needed</li>
                    <li className="list-disc"><strong>Transparent Pricing:</strong> See provider cost + markup</li>
                </ul>
            </div>

            {/* How Pricing Works */}
            <div className="space-y-4">
                <h2 id="pricing-model" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Pricing Model
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Each request cost = Provider Cost + Cencori Markup
                </p>

                <div className="space-y-6 mt-6">
                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-3">Example Calculation</h3>
                        <div className="space-y-2 text-sm text-muted-foreground">
                            <p><strong>Request:</strong> GPT-4o, 1,000 input tokens, 500 output tokens</p>
                            <p><strong>Provider Cost (OpenAI):</strong></p>
                            <ul className="ml-6 space-y-1">
                                <li>Input: 1,000 tokens × $5.00 / 1M = $0.005</li>
                                <li>Output: 500 tokens × $15.00 / 1M = $0.0075</li>
                                <li>Total Provider: $0.0125</li>
                            </ul>
                            <p className="mt-2"><strong>Cencori Markup:</strong> 20% = $0.0025</p>
                            <p className="mt-2"><strong>Total Cost:</strong> $0.015 (0.015 credits)</p>
                        </div>
                    </div>

                    <div className="p-4 bg-muted/20 border border-border/40">
                        <p className="text-xs text-muted-foreground">
                            <strong>Transparency:</strong> Your dashboard shows exact provider cost and Cencori markup for every request.
                        </p>
                    </div>
                </div>
            </div>

            {/* Checking Balance */}
            <div className="space-y-4">
                <h2 id="checking-balance" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Checking Your Balance
                </h2>

                <div className="space-y-6">
                    <div>
                        <h3 className="text-base font-semibold mb-3">In Dashboard</h3>
                        <ol className="space-y-1 text-sm ml-6 list-decimal">
                            <li>Go to your organization dashboard</li>
                            <li>Check the credits widget in the header</li>
                            <li>View transaction history for details</li>
                        </ol>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-3">Via API</h3>
                        <CodeBlock
                            filename="get-balance.ts"
                            language="typescript"
                            code={`const response = await fetch(
  'https://cencori.com/api/organizations/your-org/credits',
  {
    headers: {
      'CENCORI_API_KEY': process.env.CENCORI_API_KEY,
    },
  }
);

const { balance, currency } = await response.json();
console.log(\`Balance: \${balance} \${currency}\`); // Balance: 50.25 USD`}
                        />
                    </div>
                </div>
            </div>

            {/* Low Balance Alerts */}
            <div className="space-y-4">
                <h2 id="alerts" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Low Balance Alerts
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Cencori automatically alerts you when credits run low:
                </p>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left p-3 font-semibold">Threshold</th>
                                <th className="text-left p-3 font-semibold">Alert</th>
                                <th className="text-left p-3 font-semibold">Action</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="p-3">$10 remaining</td>
                                <td className="p-3">⚠️ Warning notification</td>
                                <td className="p-3">Plan to top up soon</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">$5 remaining</td>
                                <td className="p-3">🚨 Urgent notification</td>
                                <td className="p-3">Top up immediately</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">$0 remaining</td>
                                <td className="p-3">❌ Service suspended</td>
                                <td className="p-3">Requests blocked until top-up</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Topping Up */}
            <div className="space-y-4">
                <h2 id="top-up" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Adding Credits
                </h2>

                <ol className="space-y-2 text-sm ml-6 list-decimal">
                    <li>Go to your organization dashboard</li>
                    <li>Click &quot;Add Credits&quot; or &quot;Top Up&quot;</li>
                    <li>Choose amount (minimum $10)</li>
                    <li>Complete payment via Stripe</li>
                    <li>Credits added immediately</li>
                </ol>

                <div className="mt-4 p-4 bg-muted/20 border border-border/40">
                    <p className="text-xs text-muted-foreground">
                        <strong>Coming Soon:</strong> Auto-recharge when balance drops below a threshold.
                    </p>
                </div>
            </div>

            {/* Cost Tracking */}
            <div className="space-y-4">
                <h2 id="cost-tracking" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Cost Tracking
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Every request shows detailed cost breakdown:
                </p>

                <CodeBlock
                    filename="request-cost.json"
                    language="json"
                    code={`{
  "id": "req_123",
  "model": "gpt-4o",
  "provider": "openai",
  "usage": {
    "prompt_tokens": 1000,
    "completion_tokens": 500,
    "total_tokens": 1500
  },
  "cost": {
    "provider_cost_usd": 0.0125,
    "cencori_markup_usd": 0.0025,
    "total_cost_usd": 0.015
  }
}`}
                />

                <p className="text-sm text-muted-foreground leading-relaxed mt-4">
                    View aggregated costs in your analytics dashboard:
                </p>
                <ul className="space-y-1 text-sm ml-6">
                    <li className="list-disc">Total cost per day/week/month</li>
                    <li className="list-disc">Cost by provider</li>
                    <li className="list-disc">Cost by model</li>
                    <li className="list-disc">Cost by project</li>
                    <li className="list-disc">Cost trends over time</li>
                </ul>
            </div>

            {/* Cost Optimization */}
            <div className="space-y-4">
                <h2 id="optimization" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Optimizing Costs
                </h2>

                <div className="space-y-4">
                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-2">Use Cheaper Models</h3>
                        <p className="text-sm text-muted-foreground">
                            Gemini 2.5 Flash costs ~$0.50/1M tokens vs GPT-4o at ~$15/1M. Use cheaper models for simple tasks.
                        </p>
                    </div>

                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-2">Set Token Limits</h3>
                        <p className="text-sm text-muted-foreground">
                            Use <code className="text-xs bg-muted px-1.5 py-0.5 rounded">maxTokens</code> to prevent unexpectedly long responses.
                        </p>
                    </div>

                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-2">Cache Responses</h3>
                        <p className="text-sm text-muted-foreground">
                            For repeated queries, cache responses to avoid redundant API calls.
                        </p>
                    </div>

                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-2">Monitor Usage</h3>
                        <p className="text-sm text-muted-foreground">
                            Check analytics regularly to identify expensive patterns and optimize.
                        </p>
                    </div>
                </div>
            </div>

            {/* Transaction History */}
            <div className="space-y-4">
                <h2 id="transaction-history" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Transaction History
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    View all credit transactions in your dashboard:
                </p>

                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">Credit purchases (top-ups)</li>
                    <li className="list-disc">Credit usage (requests)</li>
                    <li className="list-disc">Refunds (if any)</li>
                    <li className="list-disc">Timestamps and descriptions</li>
                </ul>

                <p className="text-sm text-muted-foreground leading-relaxed mt-4">
                    Export transaction history for accounting:
                </p>
                <ul className="space-y-1 text-sm ml-6">
                    <li className="list-disc">CSV export</li>
                    <li className="list-disc">PDF invoices</li>
                    <li className="list-disc">Date range filtering</li>
                </ul>
            </div>

            {/* Free Tier */}
            <div className="space-y-4">
                <h2 id="free-tier" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Free Tier
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Cencori offers a free tier with limited features:
                </p>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left p-3 font-semibold">Feature</th>
                                <th className="text-left p-3 font-semibold">Free Tier</th>
                                <th className="text-left p-3 font-semibold">Paid Tier</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="p-3">Available Models</td>
                                <td className="p-3">Gemini only</td>
                                <td className="p-3">All models</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">Credits</td>
                                <td className="p-3">Free (limited)</td>
                                <td className="p-3">Pay-as-you-go</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">Analytics</td>
                                <td className="p-3">Basic</td>
                                <td className="p-3">Full</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">Custom Providers</td>
                                <td className="p-3">❌</td>
                                <td className="p-3">✅</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/concepts/streaming">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Streaming</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/concepts/rate-limiting">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Rate Limiting</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
