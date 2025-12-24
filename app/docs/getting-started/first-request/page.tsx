import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function MakeFirstRequestPage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Making Your First Request
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Complete walkthrough from installation to your first successful AI request. Get started in under 5 minutes.
                </p>
            </div>

            {/* Step 1: Sign Up */}
            <div className="space-y-4">
                <h2 id="sign-up" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Step 1: Create Your Account
                </h2>

                <ol className="space-y-2 text-sm ml-6 list-decimal">
                    <li>Go to <Link href="/dashboard" className="text-primary hover:underline">cencori.com/dashboard</Link></li>
                    <li>Click &quot;Sign Up&quot;</li>
                    <li>Sign in with Google, GitHub, or email</li>
                    <li>Verify your email (if using email signup)</li>
                </ol>
            </div>

            {/* Step 2: Create Project */}
            <div className="space-y-4">
                <h2 id="create-project" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Step 2: Create a Project
                </h2>

                <ol className="space-y-2 text-sm ml-6 list-decimal">
                    <li>In your dashboard, click &quot;Create Project&quot;</li>
                    <li>Enter a name (e.g., &quot;My First App&quot;)</li>
                    <li>Add a description (optional)</li>
                    <li>Click &quot;Create&quot;</li>
                </ol>

                <div className="mt-4 p-4 bg-muted/20 border border-border/40">
                    <p className="text-xs text-muted-foreground">
                        <strong>Tip:</strong> Create separate projects for development and production environments.
                    </p>
                </div>
            </div>

            {/* Step 3: Generate API Key */}
            <div className="space-y-4">
                <h2 id="generate-key" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Step 3: Generate an API Key
                </h2>

                <ol className="space-y-2 text-sm ml-6 list-decimal">
                    <li>Navigate to your project</li>
                    <li>Go to &quot;API Keys&quot; in the sidebar</li>
                    <li>Click &quot;Generate New Key&quot;</li>
                    <li>Choose environment (Test or Production)</li>
                    <li>Copy the key immediately - it won&apos;t be shown again!</li>
                    <li>Store it securely in your <code className="text-xs bg-muted px-1.5 py-0.5 rounded">.env</code> file</li>
                </ol>

                <CodeBlock
                    filename=".env"
                    language="bash"
                    code={`CENCORI_API_KEY=cen_test_your_api_key_here`}
                />
            </div>

            {/* Step 4: Install SDK */}
            <div className="space-y-4">
                <h2 id="install-sdk" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Step 4: Install the SDK
                </h2>

                <p className="text-sm text-muted-foreground">
                    <strong>JavaScript/TypeScript:</strong>
                </p>
                <CodeBlock
                    filename="terminal"
                    language="bash"
                    code={`npm install cencori
# or
yarn add cencori
# or
pnpm add cencori`}
                />

                <p className="text-sm text-muted-foreground mt-4">
                    <strong>Python:</strong>
                </p>
                <CodeBlock
                    filename="terminal"
                    language="bash"
                    code={`pip install cencori`}
                />
            </div>

            {/* Step 5: Write Code */}
            <div className="space-y-4">
                <h2 id="write-code" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Step 5: Make Your First Request
                </h2>

                <CodeBlock
                    filename="index.ts"
                    language="typescript"
                    code={`import { Cencori } from 'cencori';

// Initialize the client
const cencori = new Cencori({
  apiKey: process.env.CENCORI_API_KEY!,
});

// Make your first request
async function main() {
  try {
    const response = await cencori.ai.chat({
      model: 'gpt-4o',
      messages: [
        { role: 'user', content: 'Hello! Tell me a joke.' }
      ],
    });

    console.log('AI Response:', response.content);
    console.log('Model Used:', response.model);
    console.log('Tokens Used:', response.usage?.total_tokens);
    console.log('Cost:', response.cost_usd);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();`}
                />
            </div>

            {/* Step 6: Run */}
            <div className="space-y-4">
                <h2 id="run-code" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Step 6: Run Your Code
                </h2>

                <CodeBlock
                    filename="terminal"
                    language="bash"
                    code={`npx tsx index.ts
# or
node index.js
# or
npm run dev`}
                />

                <div className="mt-6 space-y-3">
                    <h3 className="text-base font-semibold">Expected Output:</h3>
                    <CodeBlock
                        filename="output"
                        language="text"
                        code={`AI Response: Why did the AI go to therapy? Because it had too many layers of emotional baggage!
Model Used: gpt-4o
Tokens Used: 45
Cost: 0.000675`}
                    />
                </div>
            </div>

            {/* Step 7: Check Dashboard */}
            <div className="space-y-4">
                <h2 id="check-dashboard" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Step 7: View in Dashboard
                </h2>

                <ol className="space-y-2 text-sm ml-6 list-decimal">
                    <li>Go back to your Cencori dashboard</li>
                    <li>Navigate to &quot;Request Logs&quot;</li>
                    <li>See your request with full details:</li>
                </ol>

                <ul className="space-y-1 text-sm ml-12 mt-3">
                    <li className="list-disc">Timestamp</li>
                    <li className="list-disc">Model and provider used</li>
                    <li className="list-disc">Full request and response</li>
                    <li className="list-disc">Token usage and cost</li>
                    <li className="list-disc">Safety score</li>
                </ul>
            </div>

            {/* Try Different Models */}
            <div className="space-y-4">
                <h2 id="try-models" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Try Different Models
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Now try switching providers - just change the model name:
                </p>

                <CodeBlock
                    filename="try-models.ts"
                    language="typescript"
                    code={`// Try Claude
const claudeResponse = await cencori.ai.chat({
  model: 'claude-3-opus',
  messages: [{ role: 'user', content: 'Hello!' }],
});

// Try Gemini
const geminiResponse = await cencori.ai.chat({
  model: 'gemini-2.5-flash',
  messages: [{ role: 'user', content: 'Hello!' }],
});

// All work the same way!`}
                />
            </div>

            {/* Try Streaming */}
            <div className="space-y-4">
                <h2 id="try-streaming" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Try Streaming
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Get real-time responses with streaming:
                </p>

                <CodeBlock
                    filename="streaming.ts"
                    language="typescript"
                    code={`const stream = cencori.ai.chatStream({
  model: 'gpt-4o',
  messages: [
    { role: 'user', content: 'Write a haiku about AI' }
  ],
});

for await (const chunk of stream) {
  process.stdout.write(chunk.delta);
}
console.log('\\nDone!');`}
                />
            </div>

            {/* Troubleshooting */}
            <div className="space-y-4">
                <h2 id="troubleshooting" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Troubleshooting
                </h2>

                <div className="space-y-4">
                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-2">401 Unauthorized Error</h3>
                        <p className="text-sm text-muted-foreground mb-2">Cause: Invalid API key</p>
                        <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                            <li className="list-disc">Double-check your API key</li>
                            <li className="list-disc">Verify it&apos;s in your .env file</li>
                            <li className="list-disc">Restart your application</li>
                        </ul>
                    </div>

                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-2">403 Forbidden Error</h3>
                        <p className="text-sm text-muted-foreground mb-2">Cause: Tier restriction or security filter</p>
                        <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                            <li className="list-disc">Free tier only supports Gemini models</li>
                            <li className="list-disc">Check if request was blocked for security</li>
                            <li className="list-disc">View incident in dashboard</li>
                        </ul>
                    </div>

                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-2">Module Not Found</h3>
                        <p className="text-sm text-muted-foreground mb-2">Cause: SDK not installed</p>
                        <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                            <li className="list-disc">Run <code className="text-xs bg-muted px-1.5 py-0.5 rounded">npm install cencori</code></li>
                            <li className="list-disc">Check your package.json</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Next Steps */}
            <div className="space-y-4">
                <h2 id="next-steps" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    What&apos;s Next?
                </h2>

                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">
                        <Link href="/docs/concepts/multi-provider" className="text-primary hover:underline">
                            Learn about multi-provider support
                        </Link>
                    </li>
                    <li className="list-disc">
                        <Link href="/docs/concepts/streaming" className="text-primary hover:underline">
                            Implement streaming for better UX
                        </Link>
                    </li>
                    <li className="list-disc">
                        <Link href="/docs/concepts/security" className="text-primary hover:underline">
                            Understand security features
                        </Link>
                    </li>
                    <li className="list-disc">
                        <Link href="/docs/api/chat" className="text-primary hover:underline">
                            Explore full Chat API reference
                        </Link>
                    </li>
                </ul>
            </div>

            {/* Navigation */}
            <div className="flex justify-end items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/concepts/projects">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Projects</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
