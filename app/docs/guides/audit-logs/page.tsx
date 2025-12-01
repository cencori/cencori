import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function AuditLogsPage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Audit Logs
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Comprehensive logging of all AI requests and responses for compliance, debugging, and analytics.
                </p>
            </div>

            {/* What are Audit Logs */}
            <div className="space-y-4">
                <h2 id="overview" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    What are Audit Logs?
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Audit logs are immutable records of every AI request processed through Cencori. They provide complete traceability for compliance, security investigations, and performance optimization.
                </p>
            </div>

            {/* What Gets Logged */}
            <div className="space-y-4">
                <h2 id="what-gets-logged" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    What Gets Logged
                </h2>

                <div className="space-y-3">
                    <div>
                        <h3 className="text-base font-semibold mb-2">Request Information:</h3>
                        <ul className="space-y-1 text-sm ml-6">
                            <li className="list-disc">Complete prompt text</li>
                            <li className="list-disc">Model and parameters (temperature, max_tokens)</li>
                            <li className="list-disc">API key used</li>
                            <li className="list-disc">User/session identifier</li>
                            <li className="list-disc">Timestamp (millisecond precision)</li>
                            <li className="list-disc">IP address</li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Response Information:</h3>
                        <ul className="space-y-1 text-sm ml-6">
                            <li className="list-disc">AI-generated content</li>
                            <li className="list-disc">Token usage (input/output/total)</li>
                            <li className="list-disc">Cost calculation</li>
                            <li className="list-disc">Latency metrics</li>
                            <li className="list-disc">Provider used</li>
                            <li className="list-disc">Status code (success/error)</li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Security Metadata:</h3>
                        <ul className="space-y-1 text-sm ml-6">
                            <li className="list-disc">PII detection results</li>
                            <li className="list-disc">Content filter flags</li>
                            <li className="list-disc">Prompt injection score</li>
                            <li className="list-disc">Security incidents linked</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Log Retention */}
            <div className="space-y-4">
                <h2 id="retention" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Log Retention
                </h2>

                <div className="overflow-x-auto mt-4">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left p-3 font-semibold">Plan</th>
                                <th className="text-left p-3 font-semibold">Retention Period</th>
                                <th className="text-left p-3 font-semibold">Export Available</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="p-3">Free</td>
                                <td className="p-3">7 days</td>
                                <td className="p-3">No</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">Pro</td>
                                <td className="p-3">30 days</td>
                                <td className="p-3">CSV</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">Enterprise</td>
                                <td className="p-3">1 year+</td>
                                <td className="p-3">CSV, JSON, API</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <p className="text-sm text-muted-foreground mt-3">
                    After the retention period, logs are permanently deleted. Export important logs before they expire.
                </p>
            </div>

            {/* Viewing Logs */}
            <div className="space-y-4">
                <h2 id="viewing" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Viewing Logs in Dashboard
                </h2>

                <ol className="space-y-2 text-sm ml-6 list-decimal">
                    <li>Navigate to your project</li>
                    <li>Click &quot;Logs&quot; in the sidebar</li>
                    <li>Use filters to narrow results:
                        <ul className="ml-6 mt-2 space-y-1">
                            <li className="list-disc">Date range</li>
                            <li className="list-disc">Model</li>
                            <li className="list-disc">Status (success/error)</li>
                            <li className="list-disc">API key</li>
                            <li className="list-disc">Cost range</li>
                        </ul>
                    </li>
                    <li>Click any log entry to view full details</li>
                </ol>
            </div>

            {/* Searching Logs */}
            <div className="space-y-4">
                <h2 id="searching" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Searching Logs
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Search through logs using full-text search:
                </p>

                <ul className="space-y-2 text-sm ml-6 mt-3">
                    <li className="list-disc">Search prompts for specific keywords</li>
                    <li className="list-disc">Find all requests from a specific user</li>
                    <li className="list-disc">Identify expensive queries (high token usage)</li>
                    <li className="list-disc">Debug failed requests by error message</li>
                </ul>
            </div>

            {/* Accessing via API */}
            <div className="space-y-4">
                <h2 id="api-access" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Accessing Logs Programmatically
                </h2>

                <CodeBlock
                    filename="fetch-logs.ts"
                    language="typescript"
                    code={`// GET /api/projects/{projectId}/logs
const response = await fetch(
  'https://api.cencori.com/v1/projects/proj_123/logs?' +
  'start_date=2024-01-01&model=gpt-4o&limit=100',
  {
    headers: {
      'Authorization': \`Bearer \${CENCORI_API_KEY}\`
    }
  }
);

const { logs } = await response.json();

logs.forEach(log => {
  console.log(\`[\${log.timestamp}] \${log.model}: \${log.tokens} tokens, $\${log.cost}\`);
});`}
                />
            </div>

            {/* Exporting Logs */}
            <div className="space-y-4">
                <h2 id="exporting" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Exporting Logs
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Export logs for archival or external analysis:
                </p>

                <div className="space-y-3 mt-4">
                    <div>
                        <h3 className="text-base font-semibold mb-2">CSV Export (Pro+)</h3>
                        <p className="text-sm text-muted-foreground">
                            Download as CSV for Excel/Google Sheets analysis. Includes all fields except full prompt text (for PII protection).
                        </p>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">JSON Export (Enterprise)</h3>
                        <p className="text-sm text-muted-foreground">
                            Complete log data including prompts and responses. Useful for data warehouses or custom analysis.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Scheduled Exports (Enterprise)</h3>
                        <p className="text-sm text-muted-foreground">
                            Automatically export logs to S3, BigQuery, or Snowflake daily/weekly.
                        </p>
                    </div>
                </div>
            </div>

            {/* Compliance Use Cases */}
            <div className="space-y-4">
                <h2 id="compliance" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Compliance and Audit Use Cases
                </h2>

                <div className="space-y-3">
                    <div>
                        <h3 className="text-base font-semibold mb-2">SOC 2 Compliance</h3>
                        <p className="text-sm text-muted-foreground">
                            Demonstrate access controls and monitoring. Auditors can review who accessed what AI models and when.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">GDPR Right of Access</h3>
                        <p className="text-sm text-muted-foreground">
                            When users request their data, search logs by user ID to find all their AI interactions.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">HIPAA Audit Trails</h3>
                        <p className="text-sm text-muted-foreground">
                            Track all access to protected health information (PHI) for compliance reporting.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Forensic Investigation</h3>
                        <p className="text-sm text-muted-foreground">
                            If a security incident occurs, trace the exact sequence of events using timestamps and request IDs.
                        </p>
                    </div>
                </div>
            </div>

            {/* Best Practices */}
            <div className="space-y-4">
                <h2 id="best-practices" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Best Practices
                </h2>

                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">Export logs monthly for long-term archival</li>
                    <li className="list-disc">Use search to identify expensive or slow queries</li>
                    <li className="list-disc">Review error logs weekly to catch issues early</li>
                    <li className="list-disc">Set up alerts for unusual patterns (cost spikes, error rate increases)</li>
                    <li className="list-disc">Document your log retention policy for compliance</li>
                    <li className="list-disc">Redact sensitive data before sharing logs with third parties</li>
                </ul>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/security/incidents">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Security Incidents</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/guides/analytics">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Analytics Overview</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
