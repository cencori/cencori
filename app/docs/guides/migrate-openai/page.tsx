import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function MigrateOpenAIPage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Migrating from OpenAI
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Step-by-step guide to migrate your application from OpenAI SDK to Cencori. Get security, logging, and multi-provider support with minimal code changes.
                </p>
            </div>

            {/* Why Migrate */}
            <div className="space-y-4">
                <h2 id="why-migrate" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Why Migrate to Cencori?
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Currently using the OpenAI SDK directly? Here&apos;s what you gain by switching to Cencori:
                </p>
                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc"><strong>Built-in Security:</strong> Automatic PII detection and prompt injection protection</li>
                    <li className="list-disc"><strong>Complete Logging:</strong> Every request logged with full metadata</li>
                    <li className="list-disc"><strong>Multi-Provider Support:</strong> Switch to Anthropic or Gemini without code changes</li>
                    <li className="list-disc"><strong>Cost Tracking:</strong> Real-time cost monitoring and analytics</li>
                    <li className="list-disc"><strong>Rate Limiting:</strong> Built-in protection against abuse</li>
                </ul>
            </div>

            {/* Before and After */}
            <div className="space-y-4">
                <h2 id="before-after" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Before and After Comparison
                </h2>

                <div className="space-y-6">
                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">Before (OpenAI SDK)</h3>
                        <CodeBlock
                            filename="before.ts"
                            language="typescript"
                            code={`import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// No built-in security
// No automatic logging
// Locked to OpenAI
// Manual cost tracking
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});`}
                        />
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">After (Cencori SDK)</h3>
                        <CodeBlock
                            filename="after.ts"
                            language="typescript"
                            code={`import { CencoriClient } from 'cencori';

const cencori = new CencoriClient({
  apiKey: process.env.CENCORI_API_KEY,
});

// Automatic security scanning
// Request logging builtin
// Multi-provider support
// Cost tracking included
const response = await cencori.ai.chat({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
});`}
                        />
                    </div>
                </div>
            </div>

            {/* Migration Steps */}
            <div className="space-y-4">
                <h2 id="migration-steps" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Migration Steps
                </h2>

                <div className="space-y-8">
                    {/* Step 1 */}
                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">Step 1: Install Cencori SDK</h3>
                        <CodeBlock
                            filename="terminal"
                            language="bash"
                            code={`npm uninstall openai
npm install cencori`}
                        />
                    </div>

                    {/* Step 2 */}
                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">Step 2: Get Your Cencori API Key</h3>
                        <p className="text-sm text-muted-foreground">
                            Sign up at <Link href="/dashboard" className="text-primary hover:underline">cencori.com/dashboard</Link>, create a project, and generate an API key.
                        </p>
                    </div>

                    {/* Step 3 */}
                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">Step 3: Update Your Code</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm font-medium mb-2">Old (OpenAI):</p>
                                <CodeBlock
                                    filename="old.ts"
                                    language="typescript"
                                    code={`import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});`}
                                />
                            </div>
                            <div>
                                <p className="text-sm font-medium mb-2">New (Cencori):</p>
                                <CodeBlock
                                    filename="new.ts"
                                    language="typescript"
                                    code={`import { CencoriClient } from 'cencori';

const cencori = new CencoriClient({
  apiKey: process.env.CENCORI_API_KEY,
});`}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Step 4 */}
                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">Step 4: Update API Calls</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm font-medium mb-2">Old:</p>
                                <CodeBlock
                                    filename="old.ts"
                                    language="typescript"
                                    code={`const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: messages,
});`}
                                />
                            </div>
                            <div>
                                <p className="text-sm font-medium mb-2">New:</p>
                                <CodeBlock
                                    filename="new.ts"
                                    language="typescript"
                                    code={`const response = await cencori.ai.chat({
  model: 'gpt-4o',
  messages: messages,
});`}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* API Mapping */}
            <div className="space-y-4">
                <h2 id="api-mapping" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    API Mapping Reference
                </h2>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left p-3 font-semibold">OpenAI SDK</th>
                                <th className="text-left p-3 font-semibold">Cencori SDK</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="p-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">openai.chat.completions.create()</code></td>
                                <td className="p-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">cencori.ai.chat()</code></td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">max_tokens</code></td>
                                <td className="p-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">maxTokens</code></td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">stream: true</code></td>
                                <td className="p-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">cencori.ai.chatStream()</code></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Streaming Migration */}
            <div className="space-y-4">
                <h2 id="streaming" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Migrating Streaming Code
                </h2>

                <div className="space-y-6">
                    <div>
                        <p className="text-sm font-medium mb-2">OpenAI Streaming:</p>
                        <CodeBlock
                            filename="openai-stream.ts"
                            language="typescript"
                            code={`const stream = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: messages,
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}`}
                        />
                    </div>

                    <div>
                        <p className="text-sm font-medium mb-2">Cencori Streaming:</p>
                        <CodeBlock
                            filename="cencori-stream.ts"
                            language="typescript"
                            code={`const stream = cencori.ai.chatStream({
  model: 'gpt-4o',
  messages: messages,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.delta);
  
  if (chunk.finish_reason) {
    console.log('\\nDone!');
  }
}`}
                        />
                    </div>
                </div>
            </div>

            {/* Testing Migration */}
            <div className="space-y-4">
                <h2 id="testing" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Testing Your Migration
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    After migrating, test your integration:
                </p>
                <ol className="space-y-2 text-sm ml-6 list-decimal">
                    <li>Make a simple chat request and verify the response</li>
                    <li>Check the Cencori dashboard for request logs</li>
                    <li>Verify security incidents are being detected (if any)</li>
                    <li>Test streaming if you use it</li>
                    <li>Monitor costs in the analytics dashboard</li>
                </ol>
            </div>

            {/* Bonus Features */}
            <div className="space-y-4">
                <h2 id="bonus-features" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Bonus: Features You Get for Free
                </h2>

                <div className="space-y-4">
                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-2">Switch to Anthropic</h3>
                        <p className="text-sm text-muted-foreground mb-3">
                            Just change the model parameter - no code changes needed:
                        </p>
                        <CodeBlock
                            filename="switch-provider.ts"
                            language="typescript"
                            code={`// Use Claude instead
const response = await cencori.ai.chat({
  model: 'claude-3-opus', // Just change this!
  messages: messages,
});`}
                        />
                    </div>

                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-2">Security Monitoring</h3>
                        <p className="text-sm text-muted-foreground">
                            View security incidents in your dashboard - no configuration needed. Cencori automatically detects PII leaks, prompt injection, and harmful content.
                        </p>
                    </div>

                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-2">Cost Breakdown</h3>
                        <p className="text-sm text-muted-foreground">
                            See exact costs per request, per model, per provider in real-time. Compare costs across different models easily.
                        </p>
                    </div>
                </div>
            </div>

            {/* Next Steps */}
            <div className="space-y-4">
                <h2 id="next-steps" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Next Steps
                </h2>
                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">
                        <Link href="/docs/concepts/multi-provider" className="text-primary hover:underline">
                            Explore multi-provider support
                        </Link>
                    </li>
                    <li className="list-disc">
                        <Link href="/docs/concepts/security" className="text-primary hover:underline">
                            Learn about security features
                        </Link>
                    </li>
                    <li className="list-disc">
                        <Link href="/dashboard" className="text-primary hover:underline">
                            View your dashboard
                        </Link>
                    </li>
                </ul>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/api/errors">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Error Reference</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/guides/migrate-anthropic">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Migrate from Anthropic</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
