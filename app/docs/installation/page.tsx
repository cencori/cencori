import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { SDKTabs } from "@/components/docs/SDKTabs";

export default function InstallationPage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Installation
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Install and configure the Cencori SDK for your preferred language.
                </p>
            </div>

            {/* SDK Tabs */}
            <SDKTabs
                defaultValue="javascript"
                tabs={[
                    {
                        value: "javascript",
                        label: "JavaScript / TypeScript",
                        content: <JavaScriptContent />
                    },
                    {
                        value: "python",
                        label: "Python",
                        content: <PythonContent />
                    },
                    {
                        value: "go",
                        label: "Go (coming soon)",
                        disabled: true,
                        content: (
                            <div className="p-8 text-center border border-dashed border-border/60 rounded-lg">
                                <p className="text-muted-foreground">Go SDK coming soon!</p>
                            </div>
                        )
                    }
                ]}
            />

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
                    Supported Providers & Models
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    All SDKs support 14+ providers with 50+ models:
                </p>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border/40">
                                <th className="text-left py-2 font-medium">Provider</th>
                                <th className="text-left py-2 font-medium">Key Models</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b border-border/20">
                                <td className="py-2">OpenAI</td>
                                <td className="py-2 font-mono text-xs">gpt-5, gpt-4o, gpt-4o-mini, o3, o1</td>
                            </tr>
                            <tr className="border-b border-border/20">
                                <td className="py-2">Anthropic</td>
                                <td className="py-2 font-mono text-xs">claude-opus-4, claude-sonnet-4, claude-3-5-sonnet</td>
                            </tr>
                            <tr className="border-b border-border/20">
                                <td className="py-2">Google</td>
                                <td className="py-2 font-mono text-xs">gemini-3-pro, gemini-2.5-flash, gemini-2.0-flash</td>
                            </tr>
                            <tr className="border-b border-border/20">
                                <td className="py-2">xAI</td>
                                <td className="py-2 font-mono text-xs">grok-4, grok-4.1, grok-3</td>
                            </tr>
                            <tr className="border-b border-border/20">
                                <td className="py-2">Mistral</td>
                                <td className="py-2 font-mono text-xs">mistral-large, codestral, devstral</td>
                            </tr>
                            <tr className="border-b border-border/20">
                                <td className="py-2">DeepSeek</td>
                                <td className="py-2 font-mono text-xs">deepseek-v3.2, deepseek-reasoner</td>
                            </tr>
                            <tr className="border-b border-border/20">
                                <td className="py-2">Meta</td>
                                <td className="py-2 font-mono text-xs">llama-4-maverick, llama-3.3-70b</td>
                            </tr>
                            <tr className="border-b border-border/20">
                                <td className="py-2 text-muted-foreground/60">+ 7 more</td>
                                <td className="py-2 text-xs text-muted-foreground/60">Groq, Cohere, Perplexity, Together, Qwen, OpenRouter, HuggingFace</td>
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

// ==================== JavaScript/TypeScript Content ====================
async function JavaScriptContent() {
    return (
        <>
            {/* Requirements */}
            <div className="space-y-4">
                <h2 className="scroll-m-20 text-lg font-semibold tracking-tight">
                    Requirements
                </h2>
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

            {/* Installation */}
            <div className="space-y-4">
                <h2 className="scroll-m-20 text-lg font-semibold tracking-tight">
                    Installation
                </h2>
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

            {/* SDK Initialization */}
            <div className="space-y-4">
                <h2 className="scroll-m-20 text-lg font-semibold tracking-tight">
                    SDK Initialization
                </h2>
                <CodeBlock
                    filename="lib/cencori.ts"
                    language="typescript"
                    code={`import { Cencori } from "cencori";

export const cencori = new Cencori({
  apiKey: process.env.CENCORI_API_KEY!,
});`}
                />
            </div>

            {/* Basic Usage */}
            <div className="space-y-4">
                <h2 className="scroll-m-20 text-lg font-semibold tracking-tight">
                    Basic Usage
                </h2>
                <CodeBlock
                    filename="example.ts"
                    language="typescript"
                    code={`import { cencori } from "./lib/cencori";

// Non-streaming
const response = await cencori.ai.chat({
  messages: [{ role: "user", content: "Hello!" }],
  model: "gpt-4o"
});

console.log(response.content);`}
                />
            </div>

            {/* Streaming */}
            <div className="space-y-4">
                <h2 className="scroll-m-20 text-lg font-semibold tracking-tight">
                    Streaming Responses
                </h2>
                <CodeBlock
                    filename="streaming.ts"
                    language="typescript"
                    code={`import { cencori } from "./lib/cencori";

for await (const chunk of cencori.ai.chatStream({
  messages: [{ role: "user", content: "Tell me a story" }],
  model: "gpt-4o"
})) {
  process.stdout.write(chunk.delta);
}`}
                />
            </div>

            {/* Error Handling */}
            <div className="space-y-4">
                <h2 className="scroll-m-20 text-lg font-semibold tracking-tight">
                    Error Handling
                </h2>
                <CodeBlock
                    filename="errors.ts"
                    language="typescript"
                    code={`import { 
  Cencori, 
  AuthenticationError, 
  RateLimitError, 
  SafetyError 
} from "cencori";

try {
  const response = await cencori.ai.chat({ messages: [...] });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error("Invalid API key");
  } else if (error instanceof RateLimitError) {
    console.error("Too many requests");
  } else if (error instanceof SafetyError) {
    console.error("Content blocked:", error.reasons);
  }
}`}
                />
            </div>
        </>
    );
}

// ==================== Python Content ====================
async function PythonContent() {
    return (
        <>
            {/* Requirements */}
            <div className="space-y-4">
                <h2 className="scroll-m-20 text-lg font-semibold tracking-tight">
                    Requirements
                </h2>
                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">
                        <strong>Python:</strong> Version 3.8 or higher
                    </li>
                    <li className="list-disc">
                        <strong>pip:</strong> pip 21.0+ (comes with Python)
                    </li>
                </ul>
            </div>

            {/* Installation */}
            <div className="space-y-4">
                <h2 className="scroll-m-20 text-lg font-semibold tracking-tight">
                    Installation
                </h2>
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

            {/* SDK Initialization */}
            <div className="space-y-4">
                <h2 className="scroll-m-20 text-lg font-semibold tracking-tight">
                    SDK Initialization
                </h2>
                <CodeBlock
                    filename="cencori_client.py"
                    language="python"
                    code={`import os
from cencori import Cencori

# Initialize with API key from environment
cencori = Cencori(api_key=os.environ.get("CENCORI_API_KEY"))

# Or pass the key directly (not recommended for production)
cencori = Cencori(api_key="cen_your_api_key_here")`}
                />
            </div>

            {/* Basic Usage */}
            <div className="space-y-4">
                <h2 className="scroll-m-20 text-lg font-semibold tracking-tight">
                    Basic Usage
                </h2>
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

            {/* Streaming */}
            <div className="space-y-4">
                <h2 className="scroll-m-20 text-lg font-semibold tracking-tight">
                    Streaming Responses
                </h2>
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

            {/* Error Handling */}
            <div className="space-y-4">
                <h2 className="scroll-m-20 text-lg font-semibold tracking-tight">
                    Error Handling
                </h2>
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
        </>
    );
}
