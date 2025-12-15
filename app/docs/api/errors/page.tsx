import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function ErrorsReferencePage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-20">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Error Reference
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Complete reference for all error codes, HTTP status codes, and troubleshooting steps for Cencori API errors.
                </p>
            </div>

            {/* Error Format */}
            <div className="space-y-4">
                <h2 id="error-format" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Error Response Format
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    All errors follow a consistent JSON format:
                </p>

                <CodeBlock
                    filename="error-response.json"
                    language="json"
                    code={`{
  "error": "Error message describing what went wrong",
  "code": "ERROR_CODE",
  "status": 400,
  "details": {
    // Optional additional context
  }
}`}
                />
            </div>

            {/* HTTP Status Codes */}
            <div className="space-y-4">
                <h2 id="status-codes" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    HTTP Status Codes
                </h2>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left p-3 font-semibold">Status</th>
                                <th className="text-left p-3 font-semibold">Meaning</th>
                                <th className="text-left p-3 font-semibold">Typical Cause</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="p-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">200</code></td>
                                <td className="p-3">OK</td>
                                <td className="p-3">Request succeeded</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">400</code></td>
                                <td className="p-3">Bad Request</td>
                                <td className="p-3">Invalid parameters or malformed request</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">401</code></td>
                                <td className="p-3">Unauthorized</td>
                                <td className="p-3">Missing or invalid API key</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">403</code></td>
                                <td className="p-3">Forbidden</td>
                                <td className="p-3">Security violation or tier restriction</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">404</code></td>
                                <td className="p-3">Not Found</td>
                                <td className="p-3">Resource doesn&apos;t exist</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">429</code></td>
                                <td className="p-3">Too Many Requests</td>
                                <td className="p-3">Rate limit exceeded</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">500</code></td>
                                <td className="p-3">Internal Server Error</td>
                                <td className="p-3">Server-side error</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">503</code></td>
                                <td className="p-3">Service Unavailable</td>
                                <td className="p-3">Provider is down or overloaded</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Common Errors */}
            <div className="space-y-4">
                <h2 id="common-errors" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Common Error Codes
                </h2>

                <div className="space-y-6">
                    {/* INVALID_API_KEY */}
                    <div className="border border-border/40 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                            <h3 className="text-base font-semibold">INVALID_API_KEY</h3>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">401</code>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                            The provided API key is invalid, expired, or revoked.
                        </p>
                        <div className="space-y-2">
                            <p className="text-sm font-medium">Solutions:</p>
                            <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                                <li className="list-disc">Verify the key is correct</li>
                                <li className="list-disc">Check if the key has been revoked</li>
                                <li className="list-disc">Generate a new key from the dashboard</li>
                                <li className="list-disc">Ensure no whitespace in the key</li>
                            </ul>
                        </div>
                    </div>

                    {/* SECURITY_VIOLATION */}
                    <div className="border border-border/40 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                            <h3 className="text-base font-semibold">SECURITY_VIOLATION</h3>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">403</code>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                            Request blocked due to security filters (PII detection, prompt injection, harmful content).
                        </p>
                        <div className="space-y-2">
                            <p className="text-sm font-medium">Solutions:</p>
                            <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                                <li className="list-disc">Review incident in dashboard for details</li>
                                <li className="list-disc">Remove sensitive data from request</li>
                                <li className="list-disc">Sanitize user input before sending</li>
                                <li className="list-disc">Check for prompt injection patterns</li>
                            </ul>
                        </div>
                    </div>

                    {/* RATE_LIMIT_EXCEEDED */}
                    <div className="border border-border/40 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                            <h3 className="text-base font-semibold">RATE_LIMIT_EXCEEDED</h3>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">429</code>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                            Too many requests in a short time period.
                        </p>
                        <div className="space-y-2">
                            <p className="text-sm font-medium">Solutions:</p>
                            <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                                <li className="list-disc">Implement exponential backoff</li>
                                <li className="list-disc">Check rate limit headers</li>
                                <li className="list-disc">Upgrade your tier for higher limits</li>
                                <li className="list-disc">Batch requests where possible</li>
                            </ul>
                        </div>
                    </div>

                    {/* INSUFFICIENT_CREDITS */}
                    <div className="border border-border/40 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                            <h3 className="text-base font-semibold">INSUFFICIENT_CREDITS</h3>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">403</code>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                            Your organization has run out of credits.
                        </p>
                        <div className="space-y-2">
                            <p className="text-sm font-medium">Solutions:</p>
                            <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                                <li className="list-disc">Top up credits in dashboard</li>
                                <li className="list-disc">Enable auto-recharge</li>
                                <li className="list-disc">Monitor credit balance</li>
                            </ul>
                        </div>
                    </div>

                    {/* TIER_RESTRICTED */}
                    <div className="border border-border/40 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                            <h3 className="text-base font-semibold">TIER_RESTRICTED</h3>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">403</code>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                            The requested feature or provider requires a paid subscription.
                        </p>
                        <div className="space-y-2">
                            <p className="text-sm font-medium">Solutions:</p>
                            <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                                <li className="list-disc">Upgrade to a paid tier</li>
                                <li className="list-disc">Use Gemini models (free tier)</li>
                                <li className="list-disc">Contact sales for enterprise access</li>
                            </ul>
                        </div>
                    </div>

                    {/* INVALID_MODEL */}
                    <div className="border border-border/40 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                            <h3 className="text-base font-semibold">INVALID_MODEL</h3>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">400</code>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                            The specified model is not supported or doesn&apos;t exist.
                        </p>
                        <div className="space-y-2">
                            <p className="text-sm font-medium">Solutions:</p>
                            <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                                <li className="list-disc">Check model name spelling</li>
                                <li className="list-disc">See <Link href="/docs/concepts/models" className="text-primary hover:underline">supported models</Link></li>
                                <li className="list-disc">Verify provider is configured</li>
                            </ul>
                        </div>
                    </div>

                    {/* PROVIDER_ERROR */}
                    <div className="border border-border/40 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                            <h3 className="text-base font-semibold">PROVIDER_ERROR</h3>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">503</code>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                            The AI provider (OpenAI, Anthropic, etc.) returned an error or is unavailable.
                        </p>
                        <div className="space-y-2">
                            <p className="text-sm font-medium">Solutions:</p>
                            <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                                <li className="list-disc">Retry after a short delay</li>
                                <li className="list-disc">Try a different provider/model</li>
                                <li className="list-disc">Check provider status pages</li>
                                <li className="list-disc">Report persistent issues to support</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Error Handling Code */}
            <div className="space-y-4">
                <h2 id="handling" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Error Handling Best Practices
                </h2>

                <CodeBlock
                    filename="error-handling.ts"
                    language="typescript"
                    code={`import { Cencori } from 'cencori';

const cencori = new Cencori({ apiKey: process.env.CENCORI_API_KEY });

async function makeRequest(messages: any[]) {
  try {
    const response = await cencori.ai.chat({
      model: 'gpt-4o',
      messages,
    });
    return response;
  } catch (error: any) {
    // Authentication errors
    if (error.status === 401) {
      console.error('Invalid API key');
      // Rotate key or alert admin
    }
    
    // Security violations
    if (error.code === 'SECURITY_VIOLATION') {
      console.error('Request blocked by security filters');
      // Log for review, sanitize input
    }
    
    // Rate limiting
    if (error.status === 429) {
      console.error('Rate limit exceeded');
      // Implement exponential backoff
      const retryAfter = error.retryAfter || 60;
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return makeRequest(messages); // Retry
    }
    
    // Insufficient credits
    if (error.code === 'INSUFFICIENT_CREDITS') {
      console.error('Out of credits');
      // Alert billing team, show upgrade prompt
    }
    
    // Provider errors (retry)
    if (error.status === 503) {
      console.error('Provider unavailable');
      // Retry with exponential backoff
      await new Promise(resolve => setTimeout(resolve, 5000));
      return makeRequest(messages);
    }
    
    // Generic error
    console.error('API error:', error.message);
    throw error;
  }
}`}
                />
            </div>

            {/* Rate Limit Headers */}
            <div className="space-y-4">
                <h2 id="rate-limit-headers" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Rate Limit Headers
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    When rate limited, check these response headers:
                </p>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left p-3 font-semibold">Header</th>
                                <th className="text-left p-3 font-semibold">Description</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="p-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">X-RateLimit-Limit</code></td>
                                <td className="p-3">Maximum requests per time window</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">X-RateLimit-Remaining</code></td>
                                <td className="p-3">Requests remaining in current window</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">X-RateLimit-Reset</code></td>
                                <td className="p-3">Unix timestamp when limit resets</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">Retry-After</code></td>
                                <td className="p-3">Seconds to wait before retrying</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/api/keys">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">API Keys API</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/guides/migrate-openai">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Migrating from OpenAI</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
