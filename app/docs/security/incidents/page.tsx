import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function SecurityIncidentsPage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Security Incidents
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Understand, monitor, and respond to security incidents detected by Cencori.
                </p>
            </div>

            {/* What are Security Incidents */}
            <div className="space-y-4">
                <h2 id="overview" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    What are Security Incidents?
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    A security incident is any event where Cencori detects suspicious, malicious, or policy-violating activity in an AI request or response. All incidents are logged for review and compliance.
                </p>
            </div>

            {/* Incident Types */}
            <div className="space-y-4">
                <h2 id="types" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Incident Types
                </h2>

                <div className="overflow-x-auto mt-4">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left p-3 font-semibold">Type</th>
                                <th className="text-left p-3 font-semibold">Description</th>
                                <th className="text-left p-3 font-semibold">Default Action</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="p-3 font-semibold">PII Detection</td>
                                <td className="p-3">Personal data found in prompt</td>
                                <td className="p-3">Block</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold">Prompt Injection</td>
                                <td className="p-3">Attempt to manipulate AI behavior</td>
                                <td className="p-3">Block</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold">Content Filter</td>
                                <td className="p-3">Harmful content detected</td>
                                <td className="p-3">Block</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold">Rate Limit</td>
                                <td className="p-3">Usage quota exceeded</td>
                                <td className="p-3">Block</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold">Suspicious Pattern</td>
                                <td className="p-3">Unusual usage detected</td>
                                <td className="p-3">Log</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Severity Levels */}
            <div className="space-y-4">
                <h2 id="severity" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Severity Levels
                </h2>

                <div className="space-y-3">
                    <div className="border-l-4 border-l-yellow-500 bg-yellow-500/5 p-4">
                        <h3 className="text-base font-semibold mb-1">Low</h3>
                        <p className="text-sm text-muted-foreground">
                            Minor policy violations or potential false positives. Review periodically.
                        </p>
                    </div>

                    <div className="border-l-4 border-l-orange-500 bg-orange-500/5 p-4">
                        <h3 className="text-base font-semibold mb-1">Medium</h3>
                        <p className="text-sm text-muted-foreground">
                            Clear policy violations but not urgent. Review weekly.
                        </p>
                    </div>

                    <div className="border-l-4 border-l-red-500 bg-red-500/5 p-4">
                        <h3 className="text-base font-semibold mb-1">High</h3>
                        <p className="text-sm text-muted-foreground">
                            Serious violations like prompt injection attempts. Review immediately.
                        </p>
                    </div>

                    <div className="border-l-4 border-l-purple-500 bg-purple-500/5 p-4">
                        <h3 className="text-base font-semibold mb-1">Critical</h3>
                        <p className="text-sm text-muted-foreground">
                            Potential security breaches or coordinated attacks. Investigate urgently.
                        </p>
                    </div>
                </div>
            </div>

            {/* Viewing Incidents */}
            <div className="space-y-4">
                <h2 id="viewing" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Viewing Incidents in Dashboard
                </h2>

                <ol className="space-y-2 text-sm ml-6 list-decimal">
                    <li>Navigate to your project dashboard</li>
                    <li>Click &quot;Security&quot; in the sidebar</li>
                    <li>View the incidents list with:
                        <ul className="ml-6 mt-2 space-y-1">
                            <li className="list-disc">Incident ID</li>
                            <li className="list-disc">Type and severity</li>
                            <li className="list-disc">Timestamp</li>
                            <li className="list-disc">User/API key info</li>
                        </ul>
                    </li>
                    <li>Click any incident to view full details</li>
                </ol>
            </div>

            {/* Incident Details */}
            <div className="space-y-4">
                <h2 id="details" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Incident Details
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Each incident record contains:
                </p>

                <ul className="space-y-2 text-sm ml-6 mt-3">
                    <li className="list-disc"><strong>Incident ID:</strong> Unique identifier for tracking</li>
                    <li className="list-disc"><strong>Timestamp:</strong> Exact time of detection</li>
                    <li className="list-disc"><strong>Type:</strong> PII, prompt injection, etc.</li>
                    <li className="list-disc"><strong>Severity:</strong> Low, medium, high, critical</li>
                    <li className="list-disc"><strong>Request Context:</strong> Model, user ID, project</li>
                    <li className="list-disc"><strong>Detection Details:</strong> What triggered the incident</li>
                    <li className="list-disc"><strong>Action Taken:</strong> Blocked, logged, or allowed</li>
                    <li className="list-disc"><strong>Redacted Prompt:</strong> The input (with PII removed)</li>
                </ul>
            </div>

            {/* Response Actions */}
            <div className="space-y-4">
                <h2 id="response-actions" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Recommended Response Actions
                </h2>

                <div className="space-y-4">
                    <div>
                        <h3 className="text-base font-semibold mb-2">For Low Severity:</h3>
                        <ul className="space-y-1 text-sm ml-6">
                            <li className="list-disc">Review monthly</li>
                            <li className="list-disc">Look for patterns</li>
                            <li className="list-disc">Adjust filter sensitivity if needed</li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">For Medium Severity:</h3>
                        <ul className="space-y-1 text-sm ml-6">
                            <li className="list-disc">Review weekly</li>
                            <li className="list-disc">Educate users if accidental</li>
                            <li className="list-disc">Consider user warnings</li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">For High/Critical Severity:</h3>
                        <ul className="space-y-1 text-sm ml-6">
                            <li className="list-disc">Investigate immediately</li>
                            <li className="list-disc">Identify the user/source</li>
                            <li className="list-disc">Consider account suspension</li>
                            <li className="list-disc">Review security policies</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Trends and Analytics */}
            <div className="space-y-4">
                <h2 id="trends" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Incident Trends
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The Security dashboard shows trends over time:
                </p>

                <ul className="space-y-2 text-sm ml-6 mt-3">
                    <li className="list-disc">Incidents per day/week/month</li>
                    <li className="list-disc">Breakdown by type</li>
                    <li className="list-disc">Severity distribution</li>
                    <li className="list-disc">Top users/API keys flagged</li>
                    <li className="list-disc">Geographic distribution (if available)</li>
                </ul>
            </div>

            {/* Programmatic Access */}
            <div className="space-y-4">
                <h2 id="api-access" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Accessing Incidents via API
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Fetch incidents programmatically for custom alerting:
                </p>

                <CodeBlock
                    filename="fetch-incidents.ts"
                    language="typescript"
                    code={`// GET /api/projects/{projectId}/incidents
const response = await fetch(
  'https://api.cencori.com/v1/projects/proj_123/incidents?severity=high',
  {
    headers: {
      'Authorization': \`Bearer \${CENCORI_API_KEY}\`
    }
  }
);

const { incidents } = await response.json();

incidents.forEach(incident => {
  console.log(\`[\${incident.severity}] \${incident.type} at \${incident.timestamp}\`);
  
  if (incident.severity === 'critical') {
    // Send alert to Slack, PagerDuty, etc.
    sendAlert(incident);
  }
});`}
                />
            </div>

            {/* Compliance */}
            <div className="space-y-4">
                <h2 id="compliance" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Compliance and Audit Trails
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Security incidents provide audit trails for compliance:
                </p>

                <ul className="space-y-2 text-sm ml-6 mt-3">
                    <li className="list-disc"><strong>SOC 2:</strong> Demonstrate security monitoring and incident response</li>
                    <li className="list-disc"><strong>GDPR:</strong> Proof of data protection measures</li>
                    <li className="list-disc"><strong>HIPAA:</strong> PHI access logging</li>
                    <li className="list-disc"><strong>ISO 27001:</strong> Information security management</li>
                </ul>

                <p className="text-sm text-muted-foreground mt-4">
                    Export incident logs for auditor review in CSV or JSON format.
                </p>
            </div>

            {/* Best Practices */}
            <div className="space-y-4">
                <h2 id="best-practices" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Best Practices
                </h2>

                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">Review high/critical incidents within 24 hours</li>
                    <li className="list-disc">Set up email/Slack alerts for critical incidents</li>
                    <li className="list-disc">Document your incident response process</li>
                    <li className="list-disc">Train team members on recognizing attack patterns</li>
                    <li className="list-disc">Export logs monthly for compliance records</li>
                    <li className="list-disc">Use incident trends to improve security policies</li>
                </ul>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/security/content-filtering">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Content Filtering</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/concepts/security">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Security Overview</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
