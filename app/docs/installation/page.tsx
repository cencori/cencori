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
                    Install and configure the Cencori SDK for your preferred language. We offer official SDKs for JavaScript/TypeScript and Python.
                </p>
            </div>

            {/* Language Selection */}
            <div className="space-y-4">
                <h2 id="choose-sdk" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Choose Your SDK
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <a href="#javascript" className="p-4 border border-border/60 rounded-lg hover:border-primary/50 hover:bg-muted/20 transition-colors">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="font-semibold">JavaScript / TypeScript</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Node.js, Next.js, React, and other JS frameworks</p>
                    </a>
                    <a href="#python" className="p-4 border border-border/60 rounded-lg hover:border-primary/50 hover:bg-muted/20 transition-colors">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="font-semibold">Python</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Django, FastAPI, Flask, and data science workflows</p>
                    </a>
                </div>
            </div>

            {/* ==================== JAVASCRIPT SDK ==================== */}
            <div className="space-y-8 pt-8 border-t border-border/40">
                <h2 id="javascript" className="scroll-m-20 text-2xl font-bold tracking-tight flex items-center gap-2">
                    JavaScript / TypeScript SDK
                </h2>

                {/* JS System Requirements */}
                <div className="space-y-4">
                    <h3 id="js-requirements" className="scroll-m-20 text-lg font-semibold tracking-tight">
                        Requirements
                    </h3>
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
                    </ul>
                </div>

                {/* JS Package Installation */}
                <div className="space-y-4">
                    <h3 id="js-installation" className="scroll-m-20 text-lg font-semibold tracking-tight">
                        Installation
                    </h3>

                    <div className="space-y-3">
                        <CodeBlock
                            filename="terminal"
                            language="bash"
                            code={`# Using npm
npm install cencori

# Using yarn
yarn add cencori

# Using pnpm
pnpm add cencori`}
                        />
                    </div>
                </div>

                {/* JS Initialization */}
                <div className="space-y-4">
                    <h3 id="js-initialization" className="scroll-m-20 text-lg font-semibold tracking-tight">
                        SDK Initialization
                    </h3>
                    <CodeBlock
                        filename="lib/cencori.ts"
                        language="typescript"
                        code={`import { Cencori } from "cencori";

export const cencori = new Cencori({
  apiKey: process.env.CENCORI_API_KEY!,
});`}
                    />
                </div>

                {/* JS Basic Usage */}
                <div className="space-y-4">
                    <h3 id="js-usage" className="scroll-m-20 text-lg font-semibold tracking-tight">
                        Basic Usage
                    </h3>
                    <CodeBlock
                        filename="example.ts"
                        language="typescript"
                        code={`import { cencori } from "./lib/cencori";

// Non-streaming
const response = await cencori.ai.chat({
  messages: [{ role: "user", content: "Hello!" }],
  model: "gpt-4o"
});

console.log(response.content);

// Streaming
for await (const chunk of cencori.ai.chatStream({
  messages: [{ role: "user", content: "Tell me a story" }],
  model: "gpt-4o"
})) {
  process.stdout.write(chunk.delta);
}`}
                    />
                </div>
            </div>

            {/* ==================== PYTHON SDK ==================== */}
            <div className="space-y-8 pt-8 border-t border-border/40">
                <h2 id="python" className="scroll-m-20 text-2xl font-bold tracking-tight flex items-center gap-2">
                Python SDK
                </h2>

                {/* Python System Requirements */}
                <div className="space-y-4">
                    <h3 id="python-requirements" className="scroll-m-20 text-lg font-semibold tracking-tight">
                        Requirements
                    </h3>
                    <ul className="space-y-2 text-sm ml-6">
                        <li className="list-disc">
                            <strong>Python:</strong> Version 3.8 or higher
                        </li>
                        <li className="list-disc">
                            <strong>pip:</strong> pip 21.0+ (comes with Python)
                        </li>
                    </ul>
                </div>

                {/* Python Package Installation */}
                <div className="space-y-4">
                    <h3 id="python-installation" className="scroll-m-20 text-lg font-semibold tracking-tight">
                        Installation
                    </h3>

                    <CodeBlock
                        filename="terminal"
                        language="bash"
                        code={`# Using pip
pip install cencori

# Using pip with virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\\Scripts\\activate
pip install cencori

# Using poetry
poetry add cencori`}
                    />

                    <div className="p-4 bg-muted/20 border border-border/40">
                        <p className="text-xs text-muted-foreground">
                            <strong>Tip:</strong> We recommend using a virtual environment to avoid dependency conflicts. The SDK has minimal dependencies (only <code className="text-xs bg-muted px-1.5 py-0.5 rounded">httpx</code>).
                        </p>
                    </div>
                </div>

                {/* Python Initialization */}
                <div className="space-y-4">
                    <h3 id="python-initialization" className="scroll-m-20 text-lg font-semibold tracking-tight">
                        SDK Initialization
                    </h3>
                    <CodeBlock
                        filename="cencori_client.py"
                        language="python"
                        code={`import os
from cencori import Cencori

# Initialize with API key
cencori = Cencori(api_key=os.environ.get("CENCORI_API_KEY"))

# Or pass the key directly (not recommended for production)
cencori = Cencori(api_key="cen_your_api_key_here")`}
                    />
                </div>

                {/* Python Basic Usage */}
                <div className="space-y-4">
                    <h3 id="python-usage" className="scroll-m-20 text-lg font-semibold tracking-tight">
                        Basic Usage
                    </h3>
                    <CodeBlock
                        filename="example.py"
                        language="python"
                        code={`from cencori import Cencori

cencori = Cencori(api_key="your-api-key")

# Non-streaming
response = cencori.ai.chat(
    messages=[{"role": "user", "content": "Hello!"}],
    model="gpt-4o"
)

print(response.content)`}
                    />
                </div>

                {/* Python Streaming */}
                <div className="space-y-4">
                    <h3 id="python-streaming" className="scroll-m-20 text-lg font-semibold tracking-tight">
                        Streaming Responses
                    </h3>
                    <CodeBlock
                        filename="streaming.py"
                        language="python"
                        code={`from cencori import Cencori

cencori = Cencori(api_key="your-api-key")

# Streaming - real-time token output
for chunk in cencori.ai.chat_stream(
    messages=[{"role": "user", "content": "Tell me a story"}],
    model="gpt-4o"
):
    print(chunk.delta, end="", flush=True)`}
                    />
                </div>

                {/* Python Error Handling */}
                <div className="space-y-4">
                    <h3 id="python-errors" className="scroll-m-20 text-lg font-semibold tracking-tight">
                        Error Handling
                    </h3>
                    <CodeBlock
                        filename="error_handling.py"
                        language="python"
                        code={`from cencori import (
    Cencori,
    AuthenticationError,
    RateLimitError,
    SafetyError
)

cencori = Cencori(api_key="your-api-key")

try:
    response = cencori.ai.chat(
        messages=[{"role": "user", "content": "Hello!"}]
    )
    print(response.content)
except AuthenticationError:
    print("Invalid API key - check your credentials")
except RateLimitError:
    print("Too many requests - slow down or upgrade your plan")
except SafetyError as e:
    print(f"Content blocked by safety filters: {e.reasons}")`}
                    />
                </div>
            </div>

            {/* ==================== COMMON SECTIONS ==================== */}

            {/* Environment Variables */}
            <div className="space-y-4 pt-8 border-t border-border/40">
                <h2 id="environment-setup" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Environment Setup
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Store your API key securely using environment variables:
                </p>

                <CodeBlock
                    filename=".env"
                    language="bash"
                    code={`# Cencori API Key
CENCORI_API_KEY=cen_your_api_key_here`}
                />

                <div className="p-4 bg-muted/20 border border-border/40">
                    <p className="text-xs text-muted-foreground">
                        <strong>Security:</strong> Never commit your <code className="text-xs bg-muted px-1.5 py-0.5 rounded">.env</code> file to version control. Add it to your <code className="text-xs bg-muted px-1.5 py-0.5 rounded">.gitignore</code>.
                    </p>
                </div>
            </div>

            {/* Supported Models */}
            <div className="space-y-4">
                <h2 id="supported-models" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Supported Models
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Both SDKs support the same models across all providers:
                </p>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border/40">
                                <th className="text-left py-2 font-medium">Provider</th>
                                <th className="text-left py-2 font-medium">Models</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b border-border/20">
                                <td className="py-2">OpenAI</td>
                                <td className="py-2 font-mono text-xs">gpt-4o, gpt-4-turbo, gpt-3.5-turbo</td>
                            </tr>
                            <tr className="border-b border-border/20">
                                <td className="py-2">Anthropic</td>
                                <td className="py-2 font-mono text-xs">claude-3-opus, claude-3-sonnet, claude-3-haiku</td>
                            </tr>
                            <tr className="border-b border-border/20">
                                <td className="py-2">Google</td>
                                <td className="py-2 font-mono text-xs">gemini-2.5-flash, gemini-2.0-flash</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Troubleshooting */}
            <div className="space-y-4">
                <h2 id="troubleshooting" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Troubleshooting
                </h2>

                <div className="space-y-6">
                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">JavaScript: Module Not Found</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            If you see <code className="text-xs bg-muted px-1.5 py-0.5 rounded">Cannot find module &apos;cencori&apos;</code>, verify installation:
                        </p>
                        <CodeBlock
                            filename="terminal"
                            language="bash"
                            code={`npm list cencori`}
                        />
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">Python: ModuleNotFoundError</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            If you see <code className="text-xs bg-muted px-1.5 py-0.5 rounded">ModuleNotFoundError: No module named &apos;cencori&apos;</code>:
                        </p>
                        <CodeBlock
                            filename="terminal"
                            language="bash"
                            code={`# Check if installed
pip show cencori

# If not found, install in current environment
pip install cencori

# Make sure you're in the right virtual environment
which python  # Should point to your venv`}
                        />
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-base font-semibold">Authentication Errors</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            If you receive authentication errors, verify your API key is correct and the environment variable is loaded properly.
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
                        Follow the <Link href="/docs/quick-start" className="text-primary hover:underline">Quick Start guide</Link> to make your first request
                    </li>
                    <li className="list-disc">
                        Learn about <Link href="/docs/concepts/security" className="text-primary hover:underline">Security features</Link> and threat detection
                    </li>
                    <li className="list-disc">
                        Explore the <Link href="/docs/api/chat" className="text-primary hover:underline">Chat API reference</Link> for detailed documentation
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

