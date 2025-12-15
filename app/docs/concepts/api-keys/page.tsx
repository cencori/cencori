import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function APIKeysPage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    API Keys
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Learn how to create, manage, and secure API keys for authenticating requests to Cencori.
                </p>
            </div>

            {/* Overview */}
            <div className="space-y-4">
                <h2 id="overview" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    What are API Keys?
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    API keys are secret tokens that authenticate your application when making requests to Cencori. Each key is tied to a specific project and environment.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Think of API keys like passwords, they prove your application has permission to use Cencori&apos;s services.
                </p>
            </div>

            {/* Key Types */}
            <div className="space-y-4">
                <h2 id="key-types" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Key Types
                </h2>

                <div className="space-y-6">
                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-2">Production Keys</h3>
                        <p className="text-sm text-muted-foreground mb-3">
                            Format: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">cen_...</code>
                        </p>
                        <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                            <li className="list-disc">Use in live applications</li>
                            <li className="list-disc">Counted toward production usage</li>
                            <li className="list-disc">Billed against your credits</li>
                            <li className="list-disc">Isolated from test data</li>
                        </ul>
                    </div>

                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-2">Test Keys</h3>
                        <p className="text-sm text-muted-foreground mb-3">
                            Format: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">cen_test_...</code>
                        </p>
                        <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                            <li className="list-disc">Use during development</li>
                            <li className="list-disc">Separate analytics from production</li>
                            <li className="list-disc">Still consumes credits</li>
                            <li className="list-disc">Same features as production</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Creating Keys */}
            <div className="space-y-4">
                <h2 id="creating-keys" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Creating API Keys
                </h2>

                <ol className="space-y-3 text-sm ml-6 list-decimal">
                    <li>Go to your <Link href="/dashboard" className="text-primary hover:underline">Cencori Dashboard</Link></li>
                    <li>Select your project</li>
                    <li>Navigate to &quot;API Keys&quot; in the sidebar</li>
                    <li>Click &quot;Generate New Key&quot;</li>
                    <li>Choose environment (Production or Test)</li>
                    <li>Add an optional description</li>
                    <li>Copy the key immediately - it won&apos;t be shown again!</li>
                </ol>

                <div className="mt-4 p-4 bg-muted/20 border border-border/40">
                    <p className="text-xs text-muted-foreground">
                        <strong>Important:</strong> API keys are only displayed once during creation. Store them securely in environment variables.
                    </p>
                </div>
            </div>

            {/* Using Keys */}
            <div className="space-y-4">
                <h2 id="using-keys" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Using API Keys
                </h2>

                <div className="space-y-6">
                    <div>
                        <h3 className="text-base font-semibold mb-3">With SDK</h3>
                        <CodeBlock
                            filename="app.ts"
                            language="typescript"
                            code={`import { Cencori } from 'cencori';

const cencori = new Cencori({
  apiKey: process.env.CENCORI_API_KEY, // Store in environment variable
});

const response = await cencori.ai.chat({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
});`}
                        />
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-3">With REST API</h3>
                        <CodeBlock
                            filename="request.sh"
                            language="bash"
                            code={`curl -X POST https://cencori.com/api/ai/chat \\
  -H "Content-Type: application/json" \\
  -H "CENCORI_API_KEY: cen_xxx" \\
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`}
                        />
                    </div>
                </div>
            </div>

            {/* Security Best Practices */}
            <div className="space-y-4">
                <h2 id="security" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Security Best Practices
                </h2>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <h3 className="text-base font-semibold">✅ Do</h3>
                        <ul className="space-y-2 text-sm ml-6">
                            <li className="list-disc">Store keys in environment variables</li>
                            <li className="list-disc">Use different keys for development and production</li>
                            <li className="list-disc">Rotate keys regularly (every 90 days)</li>
                            <li className="list-disc">Revoke unused or compromised keys immediately</li>
                            <li className="list-disc">Keep keys server-side only (never in client code)</li>
                            <li className="list-disc">Use descriptive names to track key usage</li>
                        </ul>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-base font-semibold">❌ Don&apos;t</h3>
                        <ul className="space-y-2 text-sm ml-6">
                            <li className="list-disc">Commit keys to version control (git)</li>
                            <li className="list-disc">Share keys between environments</li>
                            <li className="list-disc">Expose keys in client-side code</li>
                            <li className="list-disc">Share keys with third parties</li>
                            <li className="list-disc">Use production keys in development</li>
                            <li className="list-disc">Hard-code keys in your application</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Environment Variables */}
            <div className="space-y-4">
                <h2 id="environment-variables" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Environment Variables Setup
                </h2>

                <div className="space-y-6">
                    <div>
                        <h3 className="text-base font-semibold mb-3">Node.js (.env file)</h3>
                        <CodeBlock
                            filename=".env"
                            language="bash"
                            code={`# Production
CENCORI_API_KEY=cen_xxx

# Test
CENCORI_TEST_API_KEY=cen_test_xxx`}
                        />
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-3">Vercel</h3>
                        <ol className="space-y-1 text-sm ml-6 list-decimal">
                            <li>Go to Project Settings &gt; Environment Variables</li>
                            <li>Add <code className="text-xs bg-muted px-1.5 py-0.5 rounded">CENCORI_API_KEY</code></li>
                            <li>Select environments (Production, Preview, Development)</li>
                            <li>Save</li>
                        </ol>
                    </div>
                </div>
            </div>

            {/* Key Rotation */}
            <div className="space-y-4">
                <h2 id="rotation" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Key Rotation
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Rotate keys regularly to minimize security risk:
                </p>

                <ol className="space-y-2 text-sm ml-6 list-decimal">
                    <li>Generate a new API key in the dashboard</li>
                    <li>Update your application&apos;s environment variables</li>
                    <li>Deploy the updated configuration</li>
                    <li>Verify the new key works</li>
                    <li>Revoke the old key from the dashboard</li>
                </ol>

                <div className="mt-4 p-4 bg-muted/20 border border-border/40">
                    <p className="text-xs text-muted-foreground">
                        <strong>Tip:</strong> Keep both keys active for a brief overlap period to avoid downtime during rotation.
                    </p>
                </div>
            </div>

            {/* Revoking Keys */}
            <div className="space-y-4">
                <h2 id="revoking" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Revoking Keys
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    If a key is compromised or no longer needed:
                </p>

                <ol className="space-y-2 text-sm ml-6 list-decimal">
                    <li>Go to API Keys in your dashboard</li>
                    <li>Find the key to revoke</li>
                    <li>Click &quot;Revoke&quot;</li>
                    <li>Confirm the action</li>
                </ol>

                <p className="text-sm text-muted-foreground leading-relaxed mt-4">
                    Revoked keys immediately stop working. Any requests using that key will return a <code className="text-xs bg-muted px-1.5 py-0.5 rounded">401 Unauthorized</code> error.
                </p>
            </div>

            {/* Monitoring Usage */}
            <div className="space-y-4">
                <h2 id="monitoring" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Monitoring Key Usage
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Track which keys are being used in your dashboard:
                </p>

                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">View request counts per key</li>
                    <li className="list-disc">See last used timestamp</li>
                    <li className="list-disc">Monitor costs per key</li>
                    <li className="list-disc">Identify unused keys</li>
                </ul>
            </div>

            {/* Troubleshooting */}
            <div className="space-y-4">
                <h2 id="troubleshooting" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Troubleshooting
                </h2>

                <div className="space-y-4">
                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-2">401 Unauthorized</h3>
                        <p className="text-sm text-muted-foreground mb-2">Causes:</p>
                        <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                            <li className="list-disc">Invalid API key</li>
                            <li className="list-disc">Key has been revoked</li>
                            <li className="list-disc">Missing <code className="text-xs bg-muted px-1.5 py-0.5 rounded">CENCORI_API_KEY</code> header</li>
                            <li className="list-disc">Typo in key value</li>
                        </ul>
                    </div>

                    <div className="border border-border/40 rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-2">Key Not Working After Creation</h3>
                        <p className="text-sm text-muted-foreground mb-2">Solutions:</p>
                        <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                            <li className="list-disc">Wait 30 seconds for propagation</li>
                            <li className="list-disc">Check environment variable is set correctly</li>
                            <li className="list-disc">Restart your application</li>
                            <li className="list-disc">Verify no whitespace in key</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/concepts/projects">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Projects</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/concepts/multi-provider">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Multi-Provider</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
