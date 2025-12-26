import Link from "next/link";
import { ChevronLeft, ChevronRight, Lock, Globe, Server } from "lucide-react";
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
                    API keys authenticate your application when making requests to Cencori. Each key is tied to a specific project and can be configured for different use cases.
                </p>
            </div>

            {/* Key Types */}
            <div className="space-y-4">
                <h2 id="key-types" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Key Types
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Cencori offers two types of API keys for different security requirements:
                </p>

                <div className="space-y-4">
                    <div className="border border-border/40 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Lock className="h-4 w-4 text-muted-foreground" />
                            <h3 className="text-base font-semibold">Secret Keys</h3>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                            Format: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">csk_...</code> or <code className="text-xs bg-muted px-1.5 py-0.5 rounded">csk_test_...</code>
                        </p>
                        <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                            <li className="list-disc">For <strong>server-side use only</strong></li>
                            <li className="list-disc">Full access to all features</li>
                            <li className="list-disc">Never expose in browser or client code</li>
                            <li className="list-disc">Use in Node.js, Python, or server routes</li>
                        </ul>
                    </div>

                    <div className="border border-border/40 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            <h3 className="text-base font-semibold">Publishable Keys</h3>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                            Format: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">cpk_...</code> or <code className="text-xs bg-muted px-1.5 py-0.5 rounded">cpk_test_...</code>
                        </p>
                        <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                            <li className="list-disc">Safe for <strong>browser and client-side use</strong></li>
                            <li className="list-disc">Requires domain whitelisting</li>
                            <li className="list-disc">Only works from allowed domains</li>
                            <li className="list-disc">Use for web apps, mobile apps, SPAs</li>
                        </ul>
                    </div>

                    <div className="border border-amber-500/20 bg-amber-500/5 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Server className="h-4 w-4 text-amber-500" />
                            <h3 className="text-base font-semibold text-amber-600 dark:text-amber-400">Legacy Keys</h3>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                            Format: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">cen_...</code> or <code className="text-xs bg-muted px-1.5 py-0.5 rounded">cen_test_...</code>
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Existing keys created before key types are fully functional and treated as secret keys. No migration required.
                        </p>
                    </div>
                </div>
            </div>

            {/* Creating Keys */}
            <div className="space-y-4">
                <h2 id="creating-keys" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Creating API Keys
                </h2>

                <ol className="space-y-3 text-sm ml-6 list-decimal">
                    <li>Go to your <Link href="/dashboard" className="text-primary hover:underline">project settings</Link></li>
                    <li>Navigate to the &quot;API&quot; tab</li>
                    <li>Click &quot;New secret key&quot; or &quot;New publishable key&quot;</li>
                    <li>Enter a name for the key</li>
                    <li>For publishable keys: add allowed domains (e.g., <code className="text-xs bg-muted px-1 py-0.5 rounded">localhost</code>, <code className="text-xs bg-muted px-1 py-0.5 rounded">*.myapp.com</code>)</li>
                    <li>Copy the key immediately - it won&apos;t be shown again!</li>
                </ol>

                <div className="mt-4 p-4 bg-muted/20 border border-border/40">
                    <p className="text-xs text-muted-foreground">
                        <strong>Important:</strong> API keys are only displayed once. Store them securely in environment variables.
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
                        <h3 className="text-base font-semibold mb-3">Server-Side (Secret Key)</h3>
                        <CodeBlock
                            filename="app.ts"
                            language="typescript"
                            code={`import { Cencori } from 'cencori';

const cencori = new Cencori({
  apiKey: process.env.CENCORI_API_KEY, // csk_xxx
});

const response = await cencori.ai.chat({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
});`}
                        />
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-3">Browser (Publishable Key)</h3>
                        <CodeBlock
                            filename="browser.ts"
                            language="typescript"
                            code={`import { Cencori } from 'cencori';

// Safe to use in browser - only works from allowed domains
const cencori = new Cencori({
  apiKey: 'cpk_xxx', // Publishable key
});

const response = await cencori.ai.chat({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
});`}
                        />
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-3">REST API</h3>
                        <CodeBlock
                            filename="request.sh"
                            language="bash"
                            code={`curl -X POST https://cencori.com/api/ai/chat \\
  -H "Content-Type: application/json" \\
  -H "CENCORI_API_KEY: csk_xxx" \\
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`}
                        />
                    </div>
                </div>
            </div>

            {/* Domain Whitelisting */}
            <div className="space-y-4">
                <h2 id="domain-whitelisting" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Domain Whitelisting
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Publishable keys require domain whitelisting for security. Requests from non-whitelisted domains return <code className="text-xs bg-muted px-1.5 py-0.5 rounded">403 Forbidden</code>.
                </p>

                <div className="space-y-2">
                    <h3 className="text-base font-semibold">Supported Patterns</h3>
                    <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                        <li className="list-disc"><code className="text-xs bg-muted px-1 py-0.5 rounded">localhost</code> - Local development</li>
                        <li className="list-disc"><code className="text-xs bg-muted px-1 py-0.5 rounded">myapp.com</code> - Exact domain</li>
                        <li className="list-disc"><code className="text-xs bg-muted px-1 py-0.5 rounded">*.myapp.com</code> - All subdomains</li>
                    </ul>
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
                            <li className="list-disc">Use <strong>secret keys</strong> for server-side code</li>
                            <li className="list-disc">Use <strong>publishable keys</strong> with domain restrictions for browsers</li>
                            <li className="list-disc">Store secrets in environment variables</li>
                            <li className="list-disc">Use different keys for development and production</li>
                            <li className="list-disc">Rotate keys regularly (every 90 days)</li>
                            <li className="list-disc">Revoke unused or compromised keys immediately</li>
                        </ul>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-base font-semibold">❌ Don&apos;t</h3>
                        <ul className="space-y-2 text-sm ml-6">
                            <li className="list-disc">Expose secret keys (<code className="text-xs bg-muted px-1 py-0.5 rounded">csk_</code>) in client code</li>
                            <li className="list-disc">Commit keys to version control (git)</li>
                            <li className="list-disc">Share keys between environments</li>
                            <li className="list-disc">Hard-code keys in your application</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Environment Variables */}
            <div className="space-y-4">
                <h2 id="environment-variables" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Environment Variables
                </h2>

                <div className="space-y-6">
                    <div>
                        <h3 className="text-base font-semibold mb-3">Node.js (.env file)</h3>
                        <CodeBlock
                            filename=".env"
                            language="bash"
                            code={`# Server-side (secret key)
CENCORI_API_KEY=csk_xxx

# Test environment
CENCORI_TEST_API_KEY=csk_test_xxx

# Browser (publishable key - can be public)
NEXT_PUBLIC_CENCORI_PUBLISHABLE_KEY=cpk_xxx`}
                        />
                    </div>
                </div>
            </div>

            {/* Key Rotation */}
            <div className="space-y-4">
                <h2 id="rotation" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Key Rotation
                </h2>
                <ol className="space-y-2 text-sm ml-6 list-decimal">
                    <li>Generate a new API key</li>
                    <li>Update your environment variables</li>
                    <li>Deploy the updated configuration</li>
                    <li>Verify the new key works</li>
                    <li>Revoke the old key</li>
                </ol>
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
