import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function MigrateAnthropicPage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Migrating from Anthropic
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Step-by-step guide to migrate from Anthropic SDK to Cencori. Keep Claude while gaining security, logging, and multi-provider flexibility.
                </p>
            </div>

            {/* Why Migrate */}
            <div className="space-y-4">
                <h2 id="why-migrate" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Why Migrate to Cencori?
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Already using Claude? Here&apos;s what Cencori adds:
                </p>
                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc"><strong>Keep using Claude:</strong> Same models, same quality</li>
                    <li className="list-disc"><strong>Add OpenAI & Gemini:</strong> Switch providers without code changes</li>
                    <li className="list-disc"><strong>Built-in Security:</strong> Automatic PII and prompt injection detection</li>
                    <li className="list-disc"><strong>Cost Tracking:</strong> See exact costs per request</li>
                    <li className="list-disc"><strong>Complete Logging:</strong> Audit trail for compliance</li>
                </ul>
            </div>

            {/* Before and After */}
            <div className="space-y-4">
                <h2 id="before-after" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Code Comparison
                </h2>

                <div className="space-y-6">
                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">Before (Anthropic SDK)</h3>
                        <CodeBlock
                            filename="before.ts"
                            language="typescript"
                            code={`import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const response = await anthropic.messages.create({
  model: 'claude-3-opus-20240229',
  max_tokens: 1024,
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

const response = await cencori.ai.chat({
  model: 'claude-3-opus',
  maxTokens: 1024,
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
                            code={`npm uninstall @anthropic-ai/sdk
npm install cencori`}
                        />
                    </div>

                    {/* Step 2 */}
                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">Step 2: Get Cencori API Key</h3>
                        <ol className="space-y-1 text-sm ml-6 list-decimal">
                            <li>Sign up at <Link href="/dashboard" className="text-primary hover:underline">cencori.com/dashboard</Link></li>
                            <li>Create a project</li>
                            <li>Generate an API key</li>
                        </ol>
                    </div>

                    {/* Step 3 */}
                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">Step 3: Add Your Anthropic Key to Cencori</h3>
                        <ol className="space-y-1 text-sm ml-6 list-decimal">
                            <li>In Cencori dashboard, go to Project Settings</li>
                            <li>Navigate to &quot;Provider Keys&quot;</li>
                            <li>Add your Anthropic API key</li>
                            <li>Save</li>
                        </ol>
                        <div className="mt-3 p-4 bg-muted/20 border border-border/40">
                            <p className="text-xs text-muted-foreground">
                                <strong>Note:</strong> Cencori uses your Anthropic key to make requests on your behalf. You keep full control.
                            </p>
                        </div>
                    </div>

                    {/* Step 4 */}
                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">Step 4: Update Your Code</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm font-medium mb-2">Old:</p>
                                <CodeBlock
                                    filename="old.ts"
                                    language="typescript"
                                    code={`import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});`}
                                />
                            </div>
                            <div>
                                <p className="text-sm font-medium mb-2">New:</p>
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
                                <th className="text-left p-3 font-semibold">Anthropic SDK</th>
                                <th className="text-left p-3 font-semibold">Cencori SDK</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="p-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">anthropic.messages.create()</code></td>
                                <td className="p-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">cencori.ai.chat()</code></td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">claude-3-opus-20240229</code></td>
                                <td className="p-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">claude-3-opus</code></td>
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

            {/* System Messages */}
            <div className="space-y-4">
                <h2 id="system-messages" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    System Message Handling
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Anthropic SDK has a separate <code className="text-xs bg-muted px-1.5 py-0.5 rounded">system</code> parameter. Cencori handles this automatically:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                        <p className="text-sm font-medium mb-2">Anthropic Native:</p>
                        <CodeBlock
                            filename="anthropic.ts"
                            language="typescript"
                            code={`await anthropic.messages.create({
  model: 'claude-3-opus-20240229',
  system: 'You are helpful',
  messages: [
    { role: 'user', content: 'Hello' }
  ],
});`}
                        />
                    </div>
                    <div>
                        <p className="text-sm font-medium mb-2">Cencori (automatic):</p>
                        <CodeBlock
                            filename="cencori.ts"
                            language="typescript"
                            code={`await cencori.ai.chat({
  model: 'claude-3-opus',
  messages: [
    { role: 'system', content: 'You are helpful' },
    { role: 'user', content: 'Hello' }
  ],
});`}
                        />
                    </div>
                </div>

                <div className="mt-4 p-4 bg-muted/20 border border-border/40">
                    <p className="text-xs text-muted-foreground">
                        <strong>Tip:</strong> Cencori automatically converts system messages to Anthropic&apos;s format. Just use the standard messages array.
                    </p>
                </div>
            </div>

            {/* Streaming */}
            <div className="space-y-4">
                <h2 id="streaming" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Migrating Streaming Code
                </h2>

                <div className="space-y-6">
                    <div>
                        <p className="text-sm font-medium mb-2">Anthropic Streaming:</p>
                        <CodeBlock
                            filename="anthropic-stream.ts"
                            language="typescript"
                            code={`const stream = await anthropic.messages.create({
  model: 'claude-3-opus-20240229',
  messages: messages,
  stream: true,
});

for await (const event of stream) {
  if (event.type === 'content_block_delta') {
    process.stdout.write(event.delta.text || '');
  }
}`}
                        />
                    </div>

                    <div>
                        <p className="text-sm font-medium mb-2">Cencori Streaming:</p>
                        <CodeBlock
                            filename="cencori-stream.ts"
                            language="typescript"
                            code={`const stream = cencori.ai.chatStream({
  model: 'claude-3-opus',
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

            {/* Bonus Features */}
            <div className="space-y-4">
                <h2 id="bonus" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Bonus: Multi-Provider Freedom
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Now that you&apos;re on Cencori, switching to other providers is trivial:
                </p>

                <CodeBlock
                    filename="multi-provider.ts"
                    language="typescript"
                    code={`// Use Claude (same as before)
const claudeResponse = await cencori.ai.chat({
  model: 'claude-3-opus',
  messages: messages,
});

// Try GPT-4 (just change model!)
const gptResponse = await cencori.ai.chat({
  model: 'gpt-4o',
  messages: messages, // Same messages!
});

// Or Gemini (also just change model!)
const geminiResponse = await cencori.ai.chat({
  model: 'gemini-2.5-flash',
  messages: messages,
});`}
                />

                <div className="mt-4 p-4 bg-muted/20 border border-border/40">
                    <p className="text-xs text-muted-foreground">
                        <strong>Pro Tip:</strong> A/B test models to find the best quality/cost ratio for each use case.
                    </p>
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
                        <Link href="/docs/concepts/models" className="text-primary hover:underline">
                            Compare model pricing and capabilities
                        </Link>
                    </li>
                    <li className="list-disc">
                        <Link href="/dashboard" className="text-primary hover:underline">
                            View your analytics dashboard
                        </Link>
                    </li>
                </ul>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/guides/migrate-openai">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Migrate from OpenAI</span>
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
