import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function AuthenticationPage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-20">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Authentication
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Learn how to authenticate your requests to the Cencori API using API keys and understand best practices for secure credential management.
                </p>
            </div>

            {/* API Key Authentication */}
            <div className="space-y-4">
                <h2 id="api-key-auth" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    API Key Authentication
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Cencori uses API keys to authenticate requests. Your API key identifies your project and determines which security policies and rate limits apply to your requests.
                </p>

                <div className="space-y-3 mt-6">
                    <h3 className="text-base font-semibold">Getting Your API Key</h3>
                    <ol className="space-y-2 text-sm ml-6 list-decimal">
                        <li>Log in to the <a href="/dashboard" className="text-primary hover:underline">Cencori dashboard</a></li>
                        <li>Navigate to your project</li>
                        <li>Go to the <strong>&quot;API Keys&quot;</strong> tab</li>
                        <li>Click <strong>&quot;Generate New Key&quot;</strong></li>
                        <li>Copy the key immediately (it won&apos;t be shown again)</li>
                    </ol>
                </div>

                <div className="mt-4 p-4 bg-muted/20 border border-border/40">
                    <p className="text-xs text-muted-foreground">
                        <strong>Security Note:</strong> API keys are sensitive credentials. Never commit them to version control or expose them in client-side code.
                    </p>
                </div>
            </div>

            {/* Using API Keys */}
            <div className="space-y-4">
                <h2 id="using-keys" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Using API Keys
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Include your API key when initializing the Cencori SDK. The SDK automatically adds the necessary authentication headers to all requests.
                </p>

                <div className="space-y-3 mt-6">
                    <h3 className="text-base font-semibold">SDK Initialization</h3>
                    <CodeBlock
                        filename="lib/cencori.ts"
                        language="typescript"
                        code={`import { Cencori } from "cencori";

export const cencori = new Cencori({
  apiKey: process.env.CENCORI_API_KEY!,
  projectId: process.env.CENCORI_PROJECT_ID!,
});`}
                    />
                </div>

                <div className="space-y-3 mt-6">
                    <h3 className="text-base font-semibold">Direct HTTP Requests</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        If you&apos;re making direct HTTP requests without the SDK, include your API key in the <code className="text-xs bg-muted px-1.5 py-0.5 rounded">Authorization</code> header:
                    </p>
                    <CodeBlock
                        filename="example-request.ts"
                        language="typescript"
                        code={`const response = await fetch("https://api.cencori.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${process.env.CENCORI_API_KEY}\`,
    "Content-Type": "application/json",
    "X-Project-ID": process.env.CENCORI_PROJECT_ID!,
  },
  body: JSON.stringify({
    model: "gpt-4",
    messages: [
      { role: "user", content: "Hello!" }
    ],
  }),
});`}
                    />
                </div>
            </div>

            {/* Environment Variables */}
            <div className="space-y-4">
                <h2 id="environment-variables" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Environment Variables
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Store your API keys in environment variables to keep them secure and separate from your codebase.
                </p>

                <div className="space-y-3 mt-6">
                    <h3 className="text-base font-semibold">Local Development</h3>
                    <CodeBlock
                        filename=".env"
                        language="bash"
                        code={`# Cencori API Credentials
CENCORI_API_KEY=cen_prod_your_api_key_here
CENCORI_PROJECT_ID=proj_your_project_id_here`}
                    />
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Make sure to add <code className="text-xs bg-muted px-1.5 py-0.5 rounded">.env</code> to your <code className="text-xs bg-muted px-1.5 py-0.5 rounded">.gitignore</code> file.
                    </p>
                </div>

                <div className="space-y-3 mt-6">
                    <h3 className="text-base font-semibold">Production Deployment</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Set environment variables in your hosting platform:
                    </p>
                    <ul className="space-y-2 text-sm ml-6">
                        <li className="list-disc">
                            <strong>Vercel:</strong> Project Settings → Environment Variables
                        </li>
                        <li className="list-disc">
                            <strong>Netlify:</strong> Site Settings → Build &amp; Deploy → Environment
                        </li>
                        <li className="list-disc">
                            <strong>AWS/Docker:</strong> Use secrets management services (AWS Secrets Manager, Docker Secrets)
                        </li>
                        <li className="list-disc">
                            <strong>Heroku:</strong> Config Vars in the Settings tab
                        </li>
                    </ul>
                </div>
            </div>

            {/* Authentication Headers */}
            <div className="space-y-4">
                <h2 id="headers" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Required Headers
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    When making direct API requests, include these headers:
                </p>

                <ul className="space-y-2 text-sm ml-6 mt-4">
                    <li className="list-disc">
                        <strong>Authorization:</strong> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">Bearer YOUR_API_KEY</code> (required)
                    </li>
                    <li className="list-disc">
                        <strong>X-Project-ID:</strong> Your project ID (required)
                    </li>
                    <li className="list-disc">
                        <strong>Content-Type:</strong> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">application/json</code> (required for POST requests)
                    </li>
                    <li className="list-disc">
                        <strong>X-Environment:</strong> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">production</code> or <code className="text-xs bg-muted px-1.5 py-0.5 rounded">test</code> (optional, defaults to production)
                    </li>
                </ul>

                <CodeBlock
                    filename="headers-example.ts"
                    language="typescript"
                    code={`const headers = {
  "Authorization": "Bearer cen_prod_abc123xyz456",
  "X-Project-ID": "proj_789def012ghi",
  "Content-Type": "application/json",
  "X-Environment": "production",
};`}
                />
            </div>

            {/* Error Handling */}
            <div className="space-y-4">
                <h2 id="error-handling" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Authentication Errors
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Handle authentication errors gracefully in your application.
                </p>

                <div className="space-y-6 mt-6">
                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">Common Error Codes</h3>
                        <CodeBlock
                            filename="error-examples.ts"
                            language="typescript"
                            code={`// 401 Unauthorized - Invalid or missing API key
{
  "error": {
    "code": "INVALID_API_KEY",
    "message": "The provided API key is invalid or has been revoked."
  }
}

// 403 Forbidden - Valid key but insufficient permissions
{
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "Your API key does not have permission to access this resource."
  }
}

// 429 Too Many Requests - Rate limit exceeded
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "You have exceeded the rate limit for your plan.",
    "retryAfter": 60
  }
}`}
                        />
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">Handling Errors</h3>
                        <CodeBlock
                            filename="error-handling.ts"
                            language="typescript"
                            code={`import { cencori } from "@/lib/cencori";

async function makeRequest() {
  try {
    const response = await cencori.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: "Hello!" }],
    });
    
    return response;
  } catch (error: any) {
    // Handle authentication errors
    if (error.code === "INVALID_API_KEY") {
      console.error("API key is invalid or revoked");
      // Notify admin or trigger key rotation
    }
    
    if (error.code === "RATE_LIMIT_EXCEEDED") {
      console.error("Rate limit exceeded, retry after:", error.retryAfter);
      // Implement exponential backoff
    }
    
    if (error.code === "INSUFFICIENT_PERMISSIONS") {
      console.error("API key lacks required permissions");
      // Check project settings
    }
    
    throw error;
  }
}`}
                        />
                    </div>
                </div>
            </div>

            {/* Security Best Practices */}
            <div className="space-y-4">
                <h2 id="best-practices" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Security Best Practices
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Follow these guidelines to keep your API keys secure:
                </p>

                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">
                        <strong>Never expose keys in client-side code:</strong> API keys should only be used in server-side code or secure environments
                    </li>
                    <li className="list-disc">
                        <strong>Use environment variables:</strong> Store keys in <code className="text-xs bg-muted px-1.5 py-0.5 rounded">.env</code> files and never commit them to version control
                    </li>
                    <li className="list-disc">
                        <strong>Rotate keys regularly:</strong> Generate new keys periodically and revoke old ones
                    </li>
                    <li className="list-disc">
                        <strong>Use test keys for development:</strong> Keep production and test environments separate
                    </li>
                    <li className="list-disc">
                        <strong>Monitor API key usage:</strong> Check the dashboard for unusual activity or unauthorized access
                    </li>
                    <li className="list-disc">
                        <strong>Revoke compromised keys immediately:</strong> If a key is exposed, revoke it in the dashboard right away
                    </li>
                    <li className="list-disc">
                        <strong>Use separate keys for different services:</strong> Don&apos;t use the same key across multiple applications
                    </li>
                    <li className="list-disc">
                        <strong>Limit key permissions:</strong> Use keys with the minimum required permissions for each use case
                    </li>
                </ul>
            </div>

            {/* Key Rotation */}
            <div className="space-y-4">
                <h2 id="key-rotation" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    API Key Rotation
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Regularly rotating your API keys is a security best practice. Here&apos;s how to do it without downtime:
                </p>

                <ol className="space-y-2 text-sm ml-6 list-decimal mt-4">
                    <li>Generate a new API key in the Cencori dashboard</li>
                    <li>Update your application&apos;s environment variables with the new key</li>
                    <li>Deploy the updated application</li>
                    <li>Monitor logs to ensure the new key is working correctly</li>
                    <li>Wait 24-48 hours to ensure all services are using the new key</li>
                    <li>Revoke the old API key in the dashboard</li>
                </ol>

                <div className="mt-4 p-4 bg-muted/20 border border-border/40">
                    <p className="text-xs text-muted-foreground">
                        <strong>Pro Tip:</strong> Set a calendar reminder to rotate your production keys every 90 days.
                    </p>
                </div>
            </div>

            {/* Testing Authentication */}
            <div className="space-y-4">
                <h2 id="testing" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Testing Authentication
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Verify your authentication setup with a simple test request:
                </p>

                <CodeBlock
                    filename="test-auth.ts"
                    language="typescript"
                    code={`import { Cencori } from "cencori";

async function testAuthentication() {
  const cencori = new Cencori({
    apiKey: process.env.CENCORI_API_KEY!,
    projectId: process.env.CENCORI_PROJECT_ID!,
  });

  try {
    // Make a minimal request to test auth
    const response = await cencori.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: "Test" }],
      max_tokens: 5,
    });

    console.log("✓ Authentication successful!");
    console.log("Response:", response.choices[0].message.content);
    return true;
  } catch (error: any) {
    console.error("✗ Authentication failed:", error.message);
    console.error("Error code:", error.code);
    return false;
  }
}

testAuthentication();`}
                />
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
                <Link href="/docs/api/chat">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Chat</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
