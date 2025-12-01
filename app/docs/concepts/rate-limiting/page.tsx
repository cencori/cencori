import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function RateLimitingPage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Rate Limiting
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Understand Cencori&apos;s rate limiting system, how to handle limits, and best practices for high-volume applications.
                </p>
            </div>

            {/* Overview */}
            <div className="space-y-4">
                <h2 id="overview" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    What is Rate Limiting?
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Rate limiting controls how many requests you can make in a given time period. This protects the platform from abuse and ensures fair usage for all users.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Cencori enforces rate limits at multiple levels: per project, per user, and per organization.
                </p>
            </div>

            {/* Default Limits */}
            <div className="space-y-4">
                <h2 id="default-limits" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Default Rate Limits
                </h2>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left p-3 font-semibold">Tier</th>
                                <th className="text-left p-3 font-semibold">Requests/Minute</th>
                                <th className="text-left p-3 font-semibold">Requests/Day</th>
                                <th className="text-left p-3 font-semibold">Burst Limit</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="p-3">Free</td>
                                <td className="p-3">10</td>
                                <td className="p-3">1,000</td>
                                <td className="p-3">20</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">Starter</td>
                                <td className="p-3">60</td>
                                <td className="p-3">10,000</td>
                                <td className="p-3">100</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">Pro</td>
                                <td className="p-3">300</td>
                                <td className="p-3">50,000</td>
                                <td className="p-3">500</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">Enterprise</td>
                                <td className="p-3">Custom</td>
                                <td className="p-3">Custom</td>
                                <td className="p-3">Custom</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 p-4 bg-muted/20 border border-border/40">
                    <p className="text-xs text-muted-foreground">
                        <strong>Note:</strong> Burst limits allow short spikes above the per-minute limit, useful for handling traffic bursts.
                    </p>
                </div>
            </div>

            {/* Rate Limit Headers */}
            <div className="space-y-4">
                <h2 id="headers" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Rate Limit Headers
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Every response includes headers showing your current rate limit status:
                </p>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left p-3 font-semibold">Header</th>
                                <th className="text-left p-3 font-semibold">Description</th>
                                <th className="text-left p-3 font-semibold">Example</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="p-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">X-RateLimit-Limit</code></td>
                                <td className="p-3">Max requests per window</td>
                                <td className="p-3">60</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">X-RateLimit-Remaining</code></td>
                                <td className="p-3">Requests left in window</td>
                                <td className="p-3">45</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">X-RateLimit-Reset</code></td>
                                <td className="p-3">Unix timestamp when limit resets</td>
                                <td className="p-3">1701234567</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">Retry-After</code></td>
                                <td className="p-3">Seconds to wait (when limited)</td>
                                <td className="p-3">45</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Handling 429 Errors */}
            <div className="space-y-4">
                <h2 id="handling-429" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Handling Rate Limit Errors
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    When you exceed the rate limit, you&apos;ll receive a <code className="text-xs bg-muted px-1.5 py-0.5 rounded">429 Too Many Requests</code> error:
                </p>

                <CodeBlock
                    filename="rate-limit-error.json"
                    language="json"
                    code={`{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "status": 429,
  "retryAfter": 45
}`}
                />

                <div className="mt-6">
                    <h3 className="text-base font-semibold mb-3">Exponential Backoff Implementation</h3>
                    <CodeBlock
                        filename="exponential-backoff.ts"
                        language="typescript"
                        code={`async function makeRequestWithRetry(
  messages: any[],
  maxRetries = 3
): Promise<any> {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      const response = await cencori.ai.chat({
        model: 'gpt-4o',
        messages,
      });
      return response;
    } catch (error: any) {
      if (error.status === 429) {
        retries++;
        
        if (retries >= maxRetries) {
          throw error; // Max retries reached
        }
        
        // Exponential backoff: 2^retries seconds
        const waitTime = Math.pow(2, retries) * 1000;
        console.log(\`Rate limited, waiting \${waitTime}ms...\`);
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        throw error; // Not a rate limit error
      }
    }
  }
}`}
                    />
                </div>
            </div>

            {/* Checking Rate Limits */}
            <div className="space-y-4">
                <h2 id="checking-limits" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Checking Rate Limits Before Requests
                </h2>

                <CodeBlock
                    filename="check-limits.ts"
                    language="typescript"
                    code={`async function makeSmartRequest(messages: any[]) {
  const response = await fetch('https://cencori.com/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CENCORI_API_KEY': process.env.CENCORI_API_KEY!,
    },
    body: JSON.stringify({ model: 'gpt-4o', messages }),
  });

  // Check rate limit headers
  const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0');
  const resetTime = parseInt(response.headers.get('X-RateLimit-Reset') || '0');

  if (remaining < 5) {
    console.warn(\`Only \${remaining} requests remaining!\`);
    console.warn(\`Resets at: \${new Date(resetTime * 1000).toISOString()}\`);
    // Maybe slow down or queue requests
  }

  return response.json();
}`}
                />
            </div>

            {/* Best Practices */}
            <div className="space-y-4">
                <h2 id="best-practices" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Best Practices
                </h2>

                <div className="space-y-4">
                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-2">1. Implement Exponential Backoff</h3>
                        <p className="text-sm text-muted-foreground">
                            Always retry rate-limited requests with exponential backoff rather than aggressive retries.
                        </p>
                    </div>

                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-2">2. Monitor Headers</h3>
                        <p className="text-sm text-muted-foreground">
                            Track <code className="text-xs bg-muted px-1.5 py-0.5 rounded">X-RateLimit-Remaining</code> to know when you&apos;re approaching limits.
                        </p>
                    </div>

                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-2">3. Use Request Queues</h3>
                        <p className="text-sm text-muted-foreground">
                            Queue requests and process them at a controlled rate to stay under limits.
                        </p>
                    </div>

                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-2">4. Cache Responses</h3>
                        <p className="text-sm text-muted-foreground">
                            Cache identical requests to reduce API calls and stay under limits.
                        </p>
                    </div>

                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-2">5. Distribute Load</h3>
                        <p className="text-sm text-muted-foreground">
                            If hitting limits, consider using multiple projects or upgrading tier.
                        </p>
                    </div>
                </div>
            </div>

            {/* Request Queue Example */}
            <div className="space-y-4">
                <h2 id="queue-example" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Request Queue Implementation
                </h2>

                <CodeBlock
                    filename="request-queue.ts"
                    language="typescript"
                    code={`class RequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private requestsPerMinute: number;
  private delay: number;

  constructor(requestsPerMinute: number) {
    this.requestsPerMinute = requestsPerMinute;
    this.delay = 60000 / requestsPerMinute; // Time between requests
  }

  async add<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      if (!this.processing) {
        this.process();
      }
    });
  }

  private async process() {
    this.processing = true;
    
    while (this.queue.length > 0) {
      const request = this.queue.shift();
      if (request) {
        await request();
        await new Promise(resolve => setTimeout(resolve, this.delay));
      }
    }
    
    this.processing = false;
  }
}

// Usage
const queue = new RequestQueue(60); // 60 requests per minute

const response = await queue.add(() =>
  cencori.ai.chat({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Hello' }],
  })
);`}
                />
            </div>

            {/* Upgrading Limits */}
            <div className="space-y-4">
                <h2 id="upgrading" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Upgrading Rate Limits
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    If you consistently hit rate limits:
                </p>

                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">Upgrade your subscription tier in the dashboard</li>
                    <li className="list-disc">Contact sales for custom enterprise limits</li>
                    <li className="list-disc">Optimize your usage patterns</li>
                    <li className="list-disc">Implement caching and batching</li>
                </ul>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/concepts/credits">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Credits System</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/concepts/security">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Security</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
