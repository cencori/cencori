import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function MetricsAPIPage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-20">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Metrics API
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Programmatic access to your project analytics. Retrieve request counts, costs, latency percentiles, and usage breakdowns by provider and model.
                </p>
            </div>

            {/* Overview */}
            <div className="space-y-4">
                <h2 id="overview" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Overview
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The Metrics API allows you to fetch analytics data for your project via a simple HTTP endpoint. Use it to build custom dashboards, set up external alerting, or integrate with your existing monitoring stack.
                </p>
                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">
                        <strong>Request metrics:</strong> Total, success, error, and filtered counts
                    </li>
                    <li className="list-disc">
                        <strong>Cost tracking:</strong> Total spend and average cost per request
                    </li>
                    <li className="list-disc">
                        <strong>Latency percentiles:</strong> Average, P50, P90, and P99 latencies
                    </li>
                    <li className="list-disc">
                        <strong>Usage breakdown:</strong> By provider and model
                    </li>
                </ul>
            </div>

            {/* Endpoint */}
            <div className="space-y-4">
                <h2 id="endpoint" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Endpoint
                </h2>
                <div className="p-4 bg-muted/30 border border-border/40 rounded-lg">
                    <code className="text-sm font-mono">
                        GET https://api.cencori.com/api/v1/metrics
                    </code>
                </div>
            </div>

            {/* Authentication */}
            <div className="space-y-4">
                <h2 id="authentication" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Authentication
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Authenticate using your project&apos;s API key in the Authorization header:
                </p>
                <CodeBlock
                    filename="curl"
                    language="bash"
                    code={`curl -X GET "https://api.cencori.com/api/v1/metrics?period=24h" \\
  -H "Authorization: Bearer YOUR_API_KEY"`}
                />
            </div>

            {/* Query Parameters */}
            <div className="space-y-4">
                <h2 id="query-parameters" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Query Parameters
                </h2>
                <div className="space-y-6">
                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">period <span className="text-xs text-muted-foreground font-normal">(optional)</span></h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            The time period to aggregate metrics for. Default: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">24h</code>
                        </p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border border-border/40 rounded-lg">
                                <thead>
                                    <tr className="border-b border-border/40 bg-muted/30">
                                        <th className="px-4 py-2 text-left font-medium">Value</th>
                                        <th className="px-4 py-2 text-left font-medium">Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-border/40">
                                        <td className="px-4 py-2"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">1h</code></td>
                                        <td className="px-4 py-2 text-muted-foreground">Last hour</td>
                                    </tr>
                                    <tr className="border-b border-border/40">
                                        <td className="px-4 py-2"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">24h</code></td>
                                        <td className="px-4 py-2 text-muted-foreground">Last 24 hours</td>
                                    </tr>
                                    <tr className="border-b border-border/40">
                                        <td className="px-4 py-2"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">7d</code></td>
                                        <td className="px-4 py-2 text-muted-foreground">Last 7 days</td>
                                    </tr>
                                    <tr className="border-b border-border/40">
                                        <td className="px-4 py-2"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">30d</code></td>
                                        <td className="px-4 py-2 text-muted-foreground">Last 30 days</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-2"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">mtd</code></td>
                                        <td className="px-4 py-2 text-muted-foreground">Month to date</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Response Format */}
            <div className="space-y-4">
                <h2 id="response-format" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Response Format
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The API returns a JSON object with the following structure:
                </p>

                <CodeBlock
                    filename="response.json"
                    language="json"
                    code={`{
  "period": "24h",
  "start_date": "2026-01-15T00:00:00.000Z",
  "end_date": "2026-01-16T00:00:00.000Z",
  "requests": {
    "total": 1234,
    "success": 1200,
    "error": 24,
    "filtered": 10,
    "success_rate": 97.24
  },
  "cost": {
    "total_usd": 12.3456,
    "average_per_request_usd": 0.01
  },
  "tokens": {
    "prompt": 156000,
    "completion": 48000,
    "total": 204000
  },
  "latency": {
    "avg_ms": 234,
    "p50_ms": 180,
    "p90_ms": 420,
    "p99_ms": 890
  },
  "providers": {
    "openai": { "requests": 800, "cost_usd": 8.00 },
    "anthropic": { "requests": 400, "cost_usd": 4.00 }
  },
  "models": {
    "gpt-4o": { "requests": 500, "cost_usd": 5.00 },
    "gpt-4o-mini": { "requests": 300, "cost_usd": 1.50 },
    "claude-3-sonnet": { "requests": 400, "cost_usd": 4.00 }
  }
}`}
                />

                <div className="space-y-3 mt-6">
                    <h3 className="text-base font-semibold">Response Fields</h3>
                    <ul className="space-y-2 text-sm ml-6">
                        <li className="list-disc">
                            <strong>period:</strong> The requested time period
                        </li>
                        <li className="list-disc">
                            <strong>start_date / end_date:</strong> ISO timestamps for the period boundaries
                        </li>
                        <li className="list-disc">
                            <strong>requests:</strong> Request counts and success rate
                        </li>
                        <li className="list-disc">
                            <strong>cost:</strong> Total and average cost in USD
                        </li>
                        <li className="list-disc">
                            <strong>tokens:</strong> Token usage breakdown
                        </li>
                        <li className="list-disc">
                            <strong>latency:</strong> Latency statistics in milliseconds
                        </li>
                        <li className="list-disc">
                            <strong>providers:</strong> Breakdown by AI provider
                        </li>
                        <li className="list-disc">
                            <strong>models:</strong> Breakdown by model
                        </li>
                    </ul>
                </div>
            </div>

            {/* Examples */}
            <div className="space-y-4">
                <h2 id="examples" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Examples
                </h2>

                <div className="space-y-6">
                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">cURL</h3>
                        <CodeBlock
                            filename="terminal"
                            language="bash"
                            code={`# Get last 24 hours metrics
curl -X GET "https://api.cencori.com/api/v1/metrics?period=24h" \\
  -H "Authorization: Bearer sk_live_abc123"

# Get month-to-date metrics
curl -X GET "https://api.cencori.com/api/v1/metrics?period=mtd" \\
  -H "Authorization: Bearer sk_live_abc123"`}
                        />
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">JavaScript / TypeScript</h3>
                        <CodeBlock
                            filename="metrics.ts"
                            language="typescript"
                            code={`async function getMetrics(period = '24h') {
  const response = await fetch(
    \`https://api.cencori.com/api/v1/metrics?period=\${period}\`,
    {
      headers: {
        'Authorization': \`Bearer \${process.env.CENCORI_API_KEY}\`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(\`Failed to fetch metrics: \${response.statusText}\`);
  }

  return response.json();
}

// Usage
const metrics = await getMetrics('7d');
console.log(\`Total requests: \${metrics.requests.total}\`);
console.log(\`Total cost: $\${metrics.cost.total_usd.toFixed(2)}\`);
console.log(\`P99 latency: \${metrics.latency.p99_ms}ms\`);`}
                        />
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">Python</h3>
                        <CodeBlock
                            filename="metrics.py"
                            language="python"
                            code={`import requests
import os

def get_metrics(period='24h'):
    response = requests.get(
        f'https://api.cencori.com/api/v1/metrics?period={period}',
        headers={
            'Authorization': f'Bearer {os.environ["CENCORI_API_KEY"]}'
        }
    )
    response.raise_for_status()
    return response.json()

# Usage
metrics = get_metrics('mtd')
print(f"Total requests: {metrics['requests']['total']}")
print(f"Total cost: \${metrics['cost']['total_usd']:.2f}")
print(f"Success rate: {metrics['requests']['success_rate']}%")`}
                        />
                    </div>
                </div>
            </div>

            {/* Use Cases */}
            <div className="space-y-4">
                <h2 id="use-cases" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Use Cases
                </h2>
                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">
                        <strong>Custom dashboards:</strong> Build internal dashboards with your preferred visualization tools
                    </li>
                    <li className="list-disc">
                        <strong>Cost alerting:</strong> Set up alerts when costs exceed thresholds
                    </li>
                    <li className="list-disc">
                        <strong>Performance monitoring:</strong> Track latency trends and identify degradation
                    </li>
                    <li className="list-disc">
                        <strong>Billing integration:</strong> Pull usage data for internal chargebacks
                    </li>
                    <li className="list-disc">
                        <strong>SLA reporting:</strong> Generate reports for success rates and uptime
                    </li>
                </ul>
            </div>

            {/* Error Responses */}
            <div className="space-y-4">
                <h2 id="errors" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Error Responses
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-border/40 rounded-lg">
                        <thead>
                            <tr className="border-b border-border/40 bg-muted/30">
                                <th className="px-4 py-2 text-left font-medium">Status</th>
                                <th className="px-4 py-2 text-left font-medium">Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b border-border/40">
                                <td className="px-4 py-2"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">401</code></td>
                                <td className="px-4 py-2 text-muted-foreground">Missing or invalid API key</td>
                            </tr>
                            <tr className="border-b border-border/40">
                                <td className="px-4 py-2"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">500</code></td>
                                <td className="px-4 py-2 text-muted-foreground">Internal server error</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Rate Limits */}
            <div className="space-y-4">
                <h2 id="rate-limits" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Rate Limits
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The Metrics API has a rate limit of 60 requests per minute per API key. This is sufficient for most monitoring use cases. If you need higher limits, contact support.
                </p>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/api/chat">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Chat API</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/api/errors">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Errors</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
