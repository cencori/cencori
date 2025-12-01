import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function PIIDetectionPage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    PII Detection
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Automatically detect and protect personally identifiable information (PII) in AI requests and responses.
                </p>
            </div>

            {/* What is PII */}
            <div className="space-y-4">
                <h2 id="what-is-pii" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    What is PII?
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Personally Identifiable Information (PII) is any data that can identify a specific individual. Sending PII to third-party AI providers can:
                </p>
                <ul className="space-y-2 text-sm ml-6 mt-3">
                    <li className="list-disc">Violate GDPR, HIPAA, or other privacy regulations</li>
                    <li className="list-disc">Expose sensitive customer data</li>
                    <li className="list-disc">Result in data breaches and legal liability</li>
                    <li className="list-disc">Damage customer trust</li>
                </ul>
            </div>

            {/* What Cencori Detects */}
            <div className="space-y-4">
                <h2 id="detected-pii" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    What Cencori Detects
                </h2>

                <div className="overflow-x-auto mt-4">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left p-3 font-semibold">PII Type</th>
                                <th className="text-left p-3 font-semibold">Examples</th>
                                <th className="text-left p-3 font-semibold">Pattern</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="p-3 font-semibold">Email Addresses</td>
                                <td className="p-3">john@example.com</td>
                                <td className="p-3">Regex + validation</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold">Phone Numbers</td>
                                <td className="p-3">+1-555-123-4567</td>
                                <td className="p-3">Multiple formats</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold">Social Security Numbers</td>
                                <td className="p-3">123-45-6789</td>
                                <td className="p-3">US SSN format</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold">Credit Card Numbers</td>
                                <td className="p-3">4532-1234-5678-9010</td>
                                <td className="p-3">Luhn algorithm</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold">IP Addresses</td>
                                <td className="p-3">192.168.1.1</td>
                                <td className="p-3">IPv4/IPv6</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold">Postal Addresses</td>
                                <td className="p-3">123 Main St, NY 10001</td>
                                <td className="p-3">Address patterns</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold">Government IDs</td>
                                <td className="p-3">Passport numbers, licenses</td>
                                <td className="p-3">Country-specific</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* How It Works */}
            <div className="space-y-4">
                <h2 id="how-it-works" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    How PII Detection Works
                </h2>

                <div className="my-6 p-4 border border-border/40 bg-muted/5">
                    <div className="space-y-4 text-sm">
                        <div>
                            <div className="font-semibold mb-1">1. Request Received</div>
                            <div className="text-muted-foreground">Your application sends a request through Cencori</div>
                        </div>
                        <div className="ml-4 text-primary">↓</div>
                        <div>
                            <div className="font-semibold mb-1">2. PII Scan</div>
                            <div className="text-muted-foreground">Cencori scans the prompt for PII using regex and ML models</div>
                        </div>
                        <div className="ml-4 text-primary">↓</div>
                        <div>
                            <div className="font-semibold mb-1">3. Detection Found</div>
                            <div className="text-muted-foreground">If PII is detected, request is flagged as a security incident</div>
                        </div>
                        <div className="ml-4 text-primary">↓</div>
                        <div>
                            <div className="font-semibold mb-1">4. Action Taken</div>
                            <div className="text-muted-foreground">Block request or redact PII based on your policy</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Automatic Blocking */}
            <div className="space-y-4">
                <h2 id="automatic-blocking" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Automatic PII Blocking
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    By default, Cencori blocks requests containing PII and returns an error:
                </p>

                <CodeBlock
                    filename="pii-blocked-response.json"
                    language="json"
                    code={`{
  "error": "Request blocked due to PII detection",
  "code": "PII_DETECTED",
  "status": 403,
  "details": {
    "patterns_detected": ["EMAIL", "PHONE_NUMBER"],
    "incident_id": "inc_abc123"
  }
}`}
                />

                <p className="text-sm text-muted-foreground mt-4">
                    The request never reaches the AI provider, protecting your users&apos; data.
                </p>
            </div>

            {/* Handling PII Incidents */}
            <div className="space-y-4">
                <h2 id="handling-incidents" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Handling PII Detection in Your Code
                </h2>

                <CodeBlock
                    filename="handle-pii.ts"
                    language="typescript"
                    code={`try {
  const response = await cencori.ai.chat({
    model: 'gpt-4o',
    messages: [{ 
      role: 'user', 
      content: userInput // May contain PII
    }],
  });
  
  return response.content;
} catch (error: any) {
  if (error.code === 'PII_DETECTED') {
    // Handle PII detection gracefully
    return {
      error: 'Your message contains sensitive information. Please remove personal details.',
      pii_types: error.details.patterns_detected
    };
  }
  
  throw error;
}`}
                />
            </div>

            {/* Redaction Mode */}
            <div className="space-y-4">
                <h2 id="redaction" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    PII Redaction (Coming Soon)
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Instead of blocking, you can enable automatic redaction. Cencori will replace PII with placeholders:
                </p>

                <CodeBlock
                    filename="redacted-example"
                    language="text"
                    code={`Original:
"My email is john@example.com and my phone is 555-1234"

Redacted:
"My email is [EMAIL_REDACTED] and my phone is [PHONE_REDACTED]"`}
                />

                <p className="text-sm text-muted-foreground mt-3">
                    This allows the request to proceed while protecting sensitive data.
                </p>
            </div>

            {/* Viewing Incidents */}
            <div className="space-y-4">
                <h2 id="viewing-incidents" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Viewing PII Incidents in Dashboard
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    All PII detection events are logged as security incidents. To view:
                </p>

                <ol className="space-y-2 text-sm ml-6 list-decimal mt-3">
                    <li>Navigate to your project dashboard</li>
                    <li>Click &quot;Security&quot; in the sidebar</li>
                    <li>Filter by &quot;PII Detection&quot; incident type</li>
                    <li>View details including:
                        <ul className="ml-6 mt-2 space-y-1">
                            <li className="list-disc">Which PII types were detected</li>
                            <li className="list-disc">Timestamp and user info</li>
                            <li className="list-disc">The triggering request (PII redacted)</li>
                        </ul>
                    </li>
                </ol>
            </div>

            {/* Custom Patterns */}
            <div className="space-y-4">
                <h2 id="custom-patterns" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Custom PII Patterns (Enterprise)
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Enterprise customers can add custom PII patterns specific to their business:
                </p>

                <ul className="space-y-2 text-sm ml-6 mt-3">
                    <li className="list-disc">Employee IDs (e.g., EMP-12345)</li>
                    <li className="list-disc">Internal project codes</li>
                    <li className="list-disc">Customer reference numbers</li>
                    <li className="list-disc">Industry-specific identifiers (medical record numbers, account IDs)</li>
                </ul>

                <p className="text-sm text-muted-foreground mt-4">
                    Contact sales to configure custom patterns for your organization.
                </p>
            </div>

            {/* False Positives */}
            <div className="space-y-4">
                <h2 id="false-positives" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Handling False Positives
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Sometimes legitimate content is flagged as PII:
                </p>

                <div className="space-y-3 mt-4">
                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-2">Example: Fictional Data</h3>
                        <p className="text-sm text-muted-foreground">
                            &quot;Create a sample user profile with email test@example.com&quot; might be flagged, even though it&apos;s fictional.
                        </p>
                    </div>

                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-2">Solution: Whitelist Domains</h3>
                        <p className="text-sm text-muted-foreground">
                            Configure Cencori to allow specific domains or patterns in your project settings.
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
                    <li className="list-disc">Enable PII detection for all production projects</li>
                    <li className="list-disc">Educate users to avoid sharing personal information in prompts</li>
                    <li className="list-disc">Review PII incidents weekly to identify patterns</li>
                    <li className="list-disc">Use redaction mode for non-critical PII (e.g., names in support tickets)</li>
                    <li className="list-disc">Block mode for strict compliance (healthcare, finance)</li>
                    <li className="list-disc">Monitor false positive rates and adjust sensitivity</li>
                </ul>
            </div>

            {/* Compliance */}
            <div className="space-y-4">
                <h2 id="compliance" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Compliance Benefits
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    PII detection helps you comply with:
                </p>

                <ul className="space-y-2 text-sm ml-6 mt-3">
                    <li className="list-disc"><strong>GDPR:</strong> Prevent unauthorized processing of personal data</li>
                    <li className="list-disc"><strong>HIPAA:</strong> Protect patient health information</li>
                    <li className="list-disc"><strong>SOC 2:</strong> Demonstrate data protection controls</li>
                    <li className="list-disc"><strong>CCPA:</strong> California Consumer Privacy Act compliance</li>
                </ul>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/guides/cost-optimization">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Cost Optimization</span>
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
