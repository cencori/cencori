import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function APIKeysAPIPage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-20">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    API Keys API
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Complete API reference for managing API keys programmatically.
                </p>
            </div>

            {/* Overview */}
            <div className="space-y-4">
                <h2 id="overview" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Overview
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The API Keys API allows you to create, list, and revoke API keys for your projects. All endpoints require authentication.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Base URL: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">https://cencori.com/api</code>
                </p>
            </div>

            {/* List API Keys */}
            <div className="space-y-4">
                <h2 id="list-keys" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    List API Keys
                </h2>
                <p className="text-sm text-muted-foreground">
                    Get all API keys for a project.
                </p>

                <div className="space-y-4">
                    <div>
                        <h3 className="text-base font-semibold mb-2">Request</h3>
                        <CodeBlock
                            filename="request"
                            language="bash"
                            code={`GET /api/projects/{projectId}/api-keys?environment={environment}

Headers:
  CENCORI_API_KEY: your_api_key

Query Parameters:
  environment: "production" | "test" (optional)`}
                        />
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Response</h3>
                        <CodeBlock
                            filename="response.json"
                            language="json"
                            code={`{
  "keys": [
    {
      "id": "key_123",
      "name": "Production Key",
      "prefix": "cen_",
      "environment": "production",
      "created_at": "2024-01-01T00:00:00Z",
      "last_used_at": "2024-01-15T12:30:00Z",
      "usage_count": 1542
    }
  ]
}`}
                        />
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Example</h3>
                        <CodeBlock
                            filename="list-keys.ts"
                            language="typescript"
                            code={`const response = await fetch(
  'https://cencori.com/api/projects/proj_123/api-keys?environment=production',
  {
    headers: {
      'CENCORI_API_KEY': process.env.CENCORI_API_KEY!,
    },
  }
);

const { keys } = await response.json();
console.log(\`Found \${keys.length} API keys\`);`}
                        />
                    </div>
                </div>
            </div>

            {/* Create API Key */}
            <div className="space-y-4">
                <h2 id="create-key" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Create API Key
                </h2>
                <p className="text-sm text-muted-foreground">
                    Generate a new API key for a project.
                </p>

                <div className="space-y-4">
                    <div>
                        <h3 className="text-base font-semibold mb-2">Request</h3>
                        <CodeBlock
                            filename="request"
                            language="bash"
                            code={`POST /api/projects/{projectId}/api-keys

Headers:
  CENCORI_API_KEY: your_api_key
  Content-Type: application/json

Body:
{
  "name": "My API Key",
  "environment": "production" | "test"
}`}
                        />
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Parameters</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left p-3 font-semibold">Field</th>
                                        <th className="text-left p-3 font-semibold">Type</th>
                                        <th className="text-left p-3 font-semibold">Required</th>
                                        <th className="text-left p-3 font-semibold">Description</th>
                                    </tr>
                                </thead>
                                <tbody className="text-muted-foreground">
                                    <tr className="border-b">
                                        <td className="p-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">name</code></td>
                                        <td className="p-3">string</td>
                                        <td className="p-3">❌</td>
                                        <td className="p-3">Descriptive name for the key</td>
                                    </tr>
                                    <tr className="border-b">
                                        <td className="p-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">environment</code></td>
                                        <td className="p-3">string</td>
                                        <td className="p-3">✅</td>
                                        <td className="p-3">production or test</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Response</h3>
                        <CodeBlock
                            filename="response.json"
                            language="json"
                            code={`{
  "id": "key_123",
  "name": "My API Key",
  "key": "cen_live_123abc...xyz",
  "environment": "production",
  "created_at": "2024-01-15T12:30:00Z"
}`}
                        />
                    </div>

                    <div className="mt-4 p-4 bg-muted/20 border border-border/40">
                        <p className="text-xs text-muted-foreground">
                            <strong>Important:</strong> The full API key is only shown once during creation. Store it securely!
                        </p>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Example</h3>
                        <CodeBlock
                            filename="create-key.ts"
                            language="typescript"
                            code={`const response = await fetch(
  'https://cencori.com/api/projects/proj_123/api-keys',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CENCORI_API_KEY': process.env.CENCORI_API_KEY!,
    },
    body: JSON.stringify({
      name: 'Production API Key',
      environment: 'production',
    }),
  }
);

const { key } = await response.json();
console.log('New API key:', key);
// Store this securely - it won't be shown again!`}
                        />
                    </div>
                </div>
            </div>

            {/* Revoke API Key */}
            <div className="space-y-4">
                <h2 id="revoke-key" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Revoke API Key
                </h2>
                <p className="text-sm text-muted-foreground">
                    Permanently revoke an API key.
                </p>

                <div className="space-y-4">
                    <div>
                        <h3 className="text-base font-semibold mb-2">Request</h3>
                        <CodeBlock
                            filename="request"
                            language="bash"
                            code={`DELETE /api/projects/{projectId}/api-keys/{keyId}

Headers:
  CENCORI_API_KEY: your_api_key`}
                        />
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Response</h3>
                        <CodeBlock
                            filename="response.json"
                            language="json"
                            code={`{
  "success": true,
  "message": "API key revoked successfully"
}`}
                        />
                    </div>

                    <div className="mt-4 p-4 bg-muted/20 border border-border/40">
                        <p className="text-xs text-muted-foreground">
                            <strong>Note:</strong> Revoked keys stop working immediately. All requests using the revoked key will return 401 errors.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Example</h3>
                        <CodeBlock
                            filename="revoke-key.ts"
                            language="typescript"
                            code={`const response = await fetch(
  'https://cencori.com/api/projects/proj_123/api-keys/key_456',
  {
    method: 'DELETE',
    headers: {
      'CENCORI_API_KEY': process.env.CENCORI_API_KEY!,
    },
  }
);

const result = await response.json();
console.log(result.message);`}
                        />
                    </div>
                </div>
            </div>

            {/* Get Key Usage Stats */}
            <div className="space-y-4">
                <h2 id="key-stats" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Get Key Usage Stats
                </h2>
                <p className="text-sm text-muted-foreground">
                    Retrieve usage statistics for a specific API key.
                </p>

                <div className="space-y-4">
                    <div>
                        <h3 className="text-base font-semibold mb-2">Request</h3>
                        <CodeBlock
                            filename="request"
                            language="bash"
                            code={`GET /api/projects/{projectId}/api-keys/{keyId}/stats

Headers:
  CENCORI_API_KEY: your_api_key`}
                        />
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Response</h3>
                        <CodeBlock
                            filename="response.json"
                            language="json"
                            code={`{
  "key_id": "key_123",
  "total_requests": 15420,
  "total_cost_usd": 125.50,
  "last_used_at": "2024-01-15T12:30:00Z",
  "requests_by_day": [
    {
      "date": "2024-01-15",
      "count": 542,
      "cost_usd": 4.25
    }
  ],
  "requests_by_model": {
    "gpt-4o": 8500,
    "claude-3-opus": 6920
  }
}`}
                        />
                    </div>
                </div>
            </div>

            {/* Error Responses */}
            <div className="space-y-4">
                <h2 id="errors" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Error Responses
                </h2>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left p-3 font-semibold">Status</th>
                                <th className="text-left p-3 font-semibold">Error</th>
                                <th className="text-left p-3 font-semibold">Description</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="p-3">400</td>
                                <td className="p-3">Invalid Request</td>
                                <td className="p-3">Missing required parameters</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">401</td>
                                <td className="p-3">Unauthorized</td>
                                <td className="p-3">Invalid API key</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">403</td>
                                <td className="p-3">Forbidden</td>
                                <td className="p-3">No permission to manage keys</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">404</td>
                                <td className="p-3">Not Found</td>
                                <td className="p-3">Project or key doesn&apos;t exist</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Best Practices */}
            <div className="space-y-4">
                <h2 id="best-practices" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Best Practices
                </h2>

                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">Use descriptive names to identify key purpose</li>
                    <li className="list-disc">Rotate keys regularly (every 90 days)</li>
                    <li className="list-disc">Use separate keys for different environments</li>
                    <li className="list-disc">Revoke unused keys immediately</li>
                    <li className="list-disc">Monitor key usage for anomalies</li>
                    <li className="list-disc">Never commit keys to version control</li>
                </ul>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/api/projects">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Projects API</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/api/errors">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Errors Reference</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
