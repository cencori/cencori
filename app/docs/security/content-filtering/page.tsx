import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function ContentFilteringPage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Content Filtering
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Automatically filter harmful, inappropriate, or policy-violating content in AI requests and responses.
                </p>
            </div>

            {/* What is Content Filtering */}
            <div className="space-y-4">
                <h2 id="overview" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    What is Content Filtering?
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Content filtering prevents your AI application from processing or generating harmful content, including:
                </p>
                <ul className="space-y-2 text-sm ml-6 mt-3">
                    <li className="list-disc">Hate speech and discrimination</li>
                    <li className="list-disc">Violence and graphic content</li>
                    <li className="list-disc">Sexual or adult content</li>
                    <li className="list-disc">Self-harm and dangerous activities</li>
                    <li className="list-disc">Illegal activities</li>
                </ul>
            </div>

            {/* Filter Categories */}
            <div className="space-y-4">
                <h2 id="categories" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Filter Categories
                </h2>

                <div className="overflow-x-auto mt-4">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left p-3 font-semibold">Category</th>
                                <th className="text-left p-3 font-semibold">Description</th>
                                <th className="text-left p-3 font-semibold">Examples</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="p-3 font-semibold">Hate Speech</td>
                                <td className="p-3">Attacks based on identity</td>
                                <td className="p-3">Racial slurs, religious attacks</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold">Violence</td>
                                <td className="p-3">Graphic or threatening content</td>
                                <td className="p-3">Violent threats, gore</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold">Sexual Content</td>
                                <td className="p-3">Adult or explicit material</td>
                                <td className="p-3">NSFW imagery, explicit text</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold">Self-Harm</td>
                                <td className="p-3">Dangerous behavior encouragement</td>
                                <td className="p-3">Suicide methods, self-injury</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold">Illegal Activity</td>
                                <td className="p-3">Instructions for crimes</td>
                                <td className="p-3">Drug manufacturing, theft</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold">Profanity</td>
                                <td className="p-3">Offensive language</td>
                                <td className="p-3">Curse words, slurs</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* How It Works */}
            <div className="space-y-4">
                <h2 id="how-it-works" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    How Content Filtering Works
                </h2>

                <div className="space-y-4">
                    <div>
                        <h3 className="text-base font-semibold mb-2">1. Input Scanning</h3>
                        <p className="text-sm text-muted-foreground">
                            Before sending to the AI provider, Cencori scans the user&apos;s prompt for harmful content.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">2. Classification</h3>
                        <p className="text-sm text-muted-foreground">
                            ML models categorize content and assign severity scores (low, medium, high, critical).
                        </p>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">3. Policy Enforcement</h3>
                        <p className="text-sm text-muted-foreground">
                            Based on your configured policy, the request is either blocked, flagged, or allowed with warnings.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">4. Output Monitoring</h3>
                        <p className="text-sm text-muted-foreground">
                            AI responses are also scanned. If harmful content is generated, it&apos;s blocked before reaching the user.
                        </p>
                    </div>
                </div>
            </div>

            {/* Policy Modes */}
            <div className="space-y-4">
                <h2 id="policy-modes" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Filtering Policy Modes
                </h2>

                <div className="overflow-x-auto mt-4">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left p-3 font-semibold">Mode</th>
                                <th className="text-left p-3 font-semibold">Behavior</th>
                                <th className="text-left p-3 font-semibold">Use Case</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="p-3 font-semibold">Strict</td>
                                <td className="p-3">Block all harmful content</td>
                                <td className="p-3">Public apps, children&apos;s apps</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold">Moderate</td>
                                <td className="p-3">Block high/critical only</td>
                                <td className="p-3">General purpose apps</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold">Permissive</td>
                                <td className="p-3">Log only, don&apos;t block</td>
                                <td className="p-3">Internal tools, research</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold">Custom</td>
                                <td className="p-3">Define your own rules</td>
                                <td className="p-3">Enterprise use cases</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Blocked Content Response */}
            <div className="space-y-4">
                <h2 id="blocked-response" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    When Content is Blocked
                </h2>

                <CodeBlock
                    filename="blocked-response.json"
                    language="json"
                    code={`{
  "error": "Content violation detected",
  "code": "CONTENT_FILTER_VIOLATION",
  "status": 403,
  "details": {
    "categories": ["violence", "illegal_activity"],
    "severity": "high",
    "incident_id": "inc_filter_123"
  }
}`}
                />
            </div>

            {/* Handling in Code */}
            <div className="space-y-4">
                <h2 id="handling" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Handling Content Filter Violations
                </h2>

                <CodeBlock
                    filename="handle-filter.ts"
                    language="typescript"
                    code={`try {
  const response = await cencori.ai.chat({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: userInput }],
  });
  
  return response.content;
} catch (error: any) {
  if (error.code === 'CONTENT_FILTER_VIOLATION') {
    // Log the incident
    console.warn('Content filter triggered:', error.details);
    
    // Return user-friendly message
    return {
      error: 'Your message violates our content policy. Please rephrase.',
      categories: error.details.categories,
      severity: error.details.severity
    };
  }
  
  throw error;
}`}
                />
            </div>

            {/* Custom Rules */}
            <div className="space-y-4">
                <h2 id="custom-rules" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Custom Filtering Rules (Enterprise)
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Enterprise customers can define custom rules:
                </p>

                <ul className="space-y-2 text-sm ml-6 mt-3">
                    <li className="list-disc">Industry-specific terms (e.g., medical terminology that&apos;s acceptable in healthcare)</li>
                    <li className="list-disc">Company-specific blocklists</li>
                    <li className="list-disc">Domain-specific allowlists</li>
                    <li className="list-disc">Regional language variations</li>
                </ul>
            </div>

            {/* Monitoring */}
            <div className="space-y-4">
                <h2 id="monitoring" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Monitoring Filter Activity
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    View all content filter incidents in your dashboard:
                </p>

                <ol className="space-y-2 text-sm ml-6 list-decimal mt-3">
                    <li>Navigate to project dashboard</li>
                    <li>Click &quot;Security&quot; sidebar</li>
                    <li>Filter by &quot;Content Filter Violation&quot;</li>
                    <li>View breakdown by:
                        <ul className="ml-6 mt-2 space-y-1">
                            <li className="list-disc">Category (violence, hate speech, etc.)</li>
                            <li className="list-disc">Severity level</li>
                            <li className="list-disc">Trends over time</li>
                        </ul>
                    </li>
                </ol>
            </div>

            {/* Best Practices */}
            <div className="space-y-4">
                <h2 id="best-practices" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Best Practices
                </h2>

                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">Start with Moderate mode and adjust based on your app&apos;s audience</li>
                    <li className="list-disc">Show clear error messages to users explaining policy violations</li>
                    <li className="list-disc">Review filter incidents weekly to identify abuse patterns</li>
                    <li className="list-disc">For creative writing apps, consider Permissive mode with output filtering</li>
                    <li className="list-disc">Test edge cases with your specific content</li>
                    <li className="list-disc">Combine with prompt injection protection for comprehensive security</li>
                </ul>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/security/prompt-injection">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Prompt Injection</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/security/incidents">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Security Incidents</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
