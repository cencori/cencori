import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function InstallationPage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Installation
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Detailed guide for installing and configuring the Cencori SDK in your JavaScript or TypeScript project.
                </p>
            </div>

            {/* System Requirements */}
            <div className="space-y-4">
                <h2 id="requirements" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    System Requirements
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Before installing Cencori, ensure your system meets these requirements:
                </p>
                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">
                        <strong>Node.js:</strong> Version 18.0.0 or higher
                    </li>
                    <li className="list-disc">
                        <strong>Package Manager:</strong> npm 8+, yarn 1.22+, or pnpm 7+
                    </li>
                    <li className="list-disc">
                        <strong>TypeScript:</strong> Version 4.5+ (optional but recommended)
                    </li>
                    <li className="list-disc">
                        <strong>Operating System:</strong> Windows, macOS, or Linux
                    </li>
                </ul>
            </div>

            {/* Package Installation */}
            <div className="space-y-4">
                <h2 id="package-installation" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Package Installation
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Install the Cencori SDK using your preferred package manager:
                </p>

                <div className="space-y-3">
                    <h3 className="text-base font-semibold">Using npm</h3>
                    <CodeBlock
                        filename="terminal"
                        language="bash"
                        code={`npm install cencori`}
                    />
                </div>

                <div className="space-y-3">
                    <h3 className="text-base font-semibold">Using yarn</h3>
                    <CodeBlock
                        filename="terminal"
                        language="bash"
                        code={`yarn add cencori`}
                    />
                </div>

                <div className="space-y-3">
                    <h3 className="text-base font-semibold">Using pnpm</h3>
                    <CodeBlock
                        filename="terminal"
                        language="bash"
                        code={`pnpm add cencori`}
                    />
                </div>

                <div className="mt-4 p-4 bg-muted/20 border border-border/40">
                    <p className="text-xs text-muted-foreground">
                        <strong>Note:</strong> The package name is <code className="text-xs bg-muted px-1.5 py-0.5 rounded">cencori</code>, not <code className="text-xs bg-muted px-1.5 py-0.5 rounded">@cencori/sdk</code>. Make sure to use the correct package name when installing.
                    </p>
                </div>
            </div>

            {/* Environment Setup */}
            <div className="space-y-4">
                <h2 id="environment-setup" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Environment Setup
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Create a <code className="text-xs bg-muted px-1.5 py-0.5 rounded">.env</code> file in your project root to store your API credentials:
                </p>

                <CodeBlock
                    filename=".env"
                    language="bash"
                    code={`# Cencori API Credentials
CENCORI_API_KEY=cen_your_api_key_here
CENCORI_PROJECT_ID=proj_your_project_id_here

# Optional: Set environment (production or test)
CENCORI_ENVIRONMENT=production`}
                />

                <div className="mt-4 p-4 bg-muted/20 border border-border/40">
                    <p className="text-xs text-muted-foreground">
                        <strong>Security:</strong> Never commit your <code className="text-xs bg-muted px-1.5 py-0.5 rounded">.env</code> file to version control. Add it to your <code className="text-xs bg-muted px-1.5 py-0.5 rounded">.gitignore</code> file to prevent accidental exposure of your API keys.
                    </p>
                </div>
            </div>

            {/* SDK Initialization */}
            <div className="space-y-4">
                <h2 id="sdk-initialization" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    SDK Initialization
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Create a Cencori client instance in your application:
                </p>

                <div className="space-y-3">
                    <h3 className="text-base font-semibold">Basic Configuration</h3>
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
                    <h3 className="text-base font-semibold">Advanced Configuration</h3>
                    <CodeBlock
                        filename="lib/cencori.ts"
                        language="typescript"
                        code={`import { Cencori } from "cencori";

export const cencori = new Cencori({
  apiKey: process.env.CENCORI_API_KEY!,
  projectId: process.env.CENCORI_PROJECT_ID!,
  
  // Optional: Set base URL (default: https://api.cencori.com)
  baseURL: "https://api.cencori.com",
  
  // Optional: Set timeout in milliseconds (default: 60000)
  timeout: 60000,
  
  // Optional: Enable debug logging
  debug: process.env.NODE_ENV === "development",
  
  // Optional: Set custom headers
  headers: {
    "X-Custom-Header": "value",
  },
});`}
                    />
                </div>
            </div>

            {/* Configuration Options */}
            <div className="space-y-4">
                <h2 id="configuration-options" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Configuration Options
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    The Cencori SDK accepts the following configuration options:
                </p>

                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">
                        <strong>apiKey</strong> (required): Your Cencori API key from the dashboard
                    </li>
                    <li className="list-disc">
                        <strong>projectId</strong> (required): Your project ID from the dashboard
                    </li>
                    <li className="list-disc">
                        <strong>baseURL</strong> (optional): Custom API endpoint URL
                    </li>
                    <li className="list-disc">
                        <strong>timeout</strong> (optional): Request timeout in milliseconds
                    </li>
                    <li className="list-disc">
                        <strong>debug</strong> (optional): Enable detailed logging for debugging
                    </li>
                    <li className="list-disc">
                        <strong>headers</strong> (optional): Additional HTTP headers for all requests
                    </li>
                </ul>
            </div>

            {/* Verification */}
            <div className="space-y-4">
                <h2 id="verification" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Verify Installation
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Test your installation by making a simple request:
                </p>

                <CodeBlock
                    filename="test-cencori.ts"
                    language="typescript"
                    code={`import { cencori } from "./lib/cencori";

async function testCencori() {
  try {
    const response = await cencori.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "user", content: "Hello, Cencori!" }
      ],
    });
    
    console.log("✓ Cencori is working!");
    console.log("Response:", response.choices[0].message.content);
  } catch (error) {
    console.error("✗ Error:", error);
  }
}

testCencori();`}
                />

                <p className="text-sm text-muted-foreground leading-relaxed mt-4">
                    Run this test script with:
                </p>

                <CodeBlock
                    filename="terminal"
                    language="bash"
                    code={`npx tsx test-cencori.ts`}
                />
            </div>

            {/* Troubleshooting */}
            <div className="space-y-4">
                <h2 id="troubleshooting" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Troubleshooting
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Common installation issues and their solutions:
                </p>

                <div className="space-y-6 mt-6">
                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">Module Not Found Error</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            If you see <code className="text-xs bg-muted px-1.5 py-0.5 rounded">Cannot find module &apos;cencori&apos;</code>, verify the package is installed:
                        </p>
                        <CodeBlock
                            filename="terminal"
                            language="bash"
                            code={`npm list cencori`}
                        />
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            If not found, reinstall the package.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">Authentication Errors</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            If you receive authentication errors, verify your API key and project ID are correct and properly loaded from environment variables.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">TypeScript Errors</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Ensure your TypeScript version is 4.5 or higher. The Cencori SDK includes full TypeScript definitions.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">Network Timeouts</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            If requests are timing out, increase the timeout value in your configuration or check your network connectivity.
                        </p>
                    </div>
                </div>
            </div>

            {/* Next Steps */}
            <div className="space-y-4">
                <h2 id="next-steps" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Next Steps
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Now that you&apos;ve installed Cencori, here&apos;s what to do next:
                </p>
                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">
                        Follow the <Link href="/docs/quick-start" className="text-primary hover:underline">Quick Start guide</Link> to make your first request
                    </li>
                    <li className="list-disc">
                        Learn about <Link href="/docs/concepts/security" className="text-primary hover:underline">Security features</Link> and threat detection
                    </li>
                    <li className="list-disc">
                        Explore the <Link href="/docs/api/chat" className="text-primary hover:underline">Chat API reference</Link> for detailed documentation
                    </li>
                    <li className="list-disc">
                        Set up <Link href="/docs/concepts/projects" className="text-primary hover:underline">Projects</Link> and manage your API keys
                    </li>
                </ul>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/quick-start">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Quick Start</span>
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
