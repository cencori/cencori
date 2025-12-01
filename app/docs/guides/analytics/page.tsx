import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function AnalyticsPage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Analytics Overview
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Track usage, costs, performance, and security metrics across all your AI integrations.
                </p>
            </div>

            {/* Overview */}
            <div className="space-y-4">
                <h2 id="overview" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    What Analytics Does Cencori Provide?
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Cencori&apos;s analytics dashboard gives you complete visibility into your AI usage:
                </p>
                <ul className="space-y-2 text-sm ml-6 mt-3">
                    <li className="list-disc">Request volume and trends</li>
                    <li className="list-disc">Cost breakdown by model and provider</li>
                    <li className="list-disc">Performance metrics (latency, success rate)</li>
                    <li className="list-disc">Security incident tracking</li>
                    <li className="list-disc">User behavior patterns</li>
                </ul>
            </div>

            {/* Key Metrics */}
            <div className="space-y-4">
                <h2 id="key-metrics" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Key Metrics
                </h2>

                <div className="space-y-4">
                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-2">Total Requests</h3>
                        <p className="text-sm text-muted-foreground">
                            Number of AI requests processed. Track growth over time and identify usage patterns.
                        </p>
                    </div>

                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-2">Success Rate</h3>
                        <p className="text-sm text-muted-foreground">
                            Percentage of successful requests vs. errors. A healthy app should have {'>'}95% success rate.
                        </p>
                    </div>

                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-2">Total Cost</h3>
                        <p className="text-sm text-muted-foreground">
                            Cumulative spend across all AI providers. Includes provider costs + Cencori markup.
                        </p>
                    </div>

                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-2">Average Latency</h3>
                        <p className="text-sm text-muted-foreground">
                            Time from request to response. Lower is better for user experience.
                        </p>
                    </div>

                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-2">Security Incidents</h3>
                        <p className="text-sm text-muted-foreground">
                            Count of blocked or flagged requests (PII, prompt injection, content filter).
                        </p>
                    </div>
                </div>
            </div>

            {/* Charts and Visualizations */}
            <div className="space-y-4">
                <h2 id="visualizations" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Charts and Visualizations
                </h2>

                <div className="space-y-3">
                    <div>
                        <h3 className="text-base font-semibold mb-2">Requests Over Time</h3>
                        <p className="text-sm text-muted-foreground">
                            Line chart showing daily/weekly/monthly request volume. Identify growth trends and seasonal patterns.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Cost Breakdown</h3>
                        <p className="text-sm text-muted-foreground">
                            Pie/bar chart showing costs by model (GPT-4o, Claude, Gemini). Identify expensive models.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Model Usage</h3>
                        <p className="text-sm text-muted-foreground">
                            Bar chart showing request distribution across models. See which models are most popular.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Security Dashboard</h3>
                        <p className="text-sm text-muted-foreground">
                            Donut chart showing incident types (PII, injection, content filter). Monitor threat distribution.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Performance Heatmap</h3>
                        <p className="text-sm text-muted-foreground">
                            Latency distribution by time of day. Identify peak traffic hours.
                        </p>
                    </div>
                </div>
            </div>

            {/* Filtering and Segmentation */}
            <div className="space-y-4">
                <h2 id="filtering" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Filtering and Segmentation
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Slice analytics data by multiple dimensions:
                </p>

                <ul className="space-y-2 text-sm ml-6 mt-3">
                    <li className="list-disc"><strong>Time Range:</strong> Last 7/30/90 days or custom range</li>
                    <li className="list-disc"><strong>Model:</strong> Filter by specific AI models</li>
                    <li className="list-disc"><strong>Provider:</strong> Compare OpenAI vs. Anthropic vs. Google</li>
                    <li className="list-disc"><strong>API Key:</strong> Track usage per application/environment</li>
                    <li className="list-disc"><strong>Status:</strong> Success vs. error requests</li>
                    <li className="list-disc"><strong>User:</strong> Analyze per-user behavior (if user IDs tracked)</li>
                </ul>
            </div>

            {/* Use Cases */}
            <div className="space-y-4">
                <h2 id="use-cases" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Common Analytics Use Cases
                </h2>

                <div className="space-y-4">
                    <div>
                        <h3 className="text-base font-semibold mb-2">Cost Optimization</h3>
                        <p className="text-sm text-muted-foreground mb-2">
                            Identify which models are driving costs:
                        </p>
                        <ol className="space-y-1 text-sm ml-6">
                            <li className="list-decimal">View cost breakdown chart</li>
                            <li className="list-decimal">Identify expensive models (e.g., GPT-4 Turbo)</li>
                            <li className="list-decimal">Consider switching to GPT-3.5 or Gemini Flash for simple tasks</li>
                        </ol>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Performance Debugging</h3>
                        <p className="text-sm text-muted-foreground mb-2">
                            Find slow requests:
                        </p>
                        <ol className="space-y-1 text-sm ml-6">
                            <li className="list-decimal">Filter logs by latency {'>'}5 seconds</li>
                            <li className="list-decimal">Check which models are slowest</li>
                            <li className="list-decimal">Optimize prompts or switch providers</li>
                        </ol>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Capacity Planning</h3>
                        <p className="text-sm text-muted-foreground mb-2">
                            Prepare for growth:
                        </p>
                        <ol className="space-y-1 text-sm ml-6">
                            <li className="list-decimal">View requests-over-time trend</li>
                            <li className="list-decimal">Extrapolate future volume</li>
                            <li className="list-decimal">Budget for expected costs</li>
                        </ol>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Security Monitoring</h3>
                        <p className="text-sm text-muted-foreground mb-2">
                            Track attack attempts:
                        </p>
                        <ol className="space-y-1 text-sm ml-6">
                            <li className="list-decimal">View security incidents chart</li>
                            <li className="list-decimal">Identify spike in prompt injection attempts</li>
                            <li className="list-decimal">Investigate source and tighten security</li>
                        </ol>
                    </div>
                </div>
            </div>

            {/* Accessing via API */}
            <div className="space-y-4">
                <h2 id="api-access" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Accessing Analytics Programmatically
                </h2>

                <CodeBlock
                    filename="fetch-analytics.ts"
                    language="typescript"
                    code={`// GET /api/projects/{projectId}/analytics
const response = await fetch(
  'https://api.cencori.com/v1/projects/proj_123/analytics?' +
  'metric=requests&groupBy=model&start=2024-01-01',
  {
    headers: {
      'Authorization': \`Bearer \${CENCORI_API_KEY}\`
    }
  }
);

const { data } = await response.json();

// Example: Find most-used model
const sorted = data.sort((a, b) => b.value - a.value);
console.log(\`Most used model: \${sorted[0].model} (\${sorted[0].value} requests)\`);`}
                />
            </div>

            {/* Best Practices */}
            <div className="space-y-4">
                <h2 id="best-practices" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Best Practices
                </h2>

                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">Review analytics weekly to catch issues early</li>
                    <li className="list-disc">Set up cost alerts to avoid budget overruns</li>
                    <li className="list-disc">Track success rate—investigate if it drops below 95%</li>
                    <li className="list-disc">Compare model performance before making changes</li>
                    <li className="list-disc">Export data monthly for long-term trend analysis</li>
                    <li className="list-disc">Share analytics with stakeholders (product, finance, security teams)</li>
                </ul>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/guides/audit-logs">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Audit Logs</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/use-cases/vibe-coders">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">For Context Engineers</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
