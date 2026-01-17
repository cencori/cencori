import { CodeBlock } from "@/components/docs/CodeBlock";

export default function Step5Page() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold tracking-tight mb-2">
                    Install the SDK
                </h1>
                <p className="text-muted-foreground">
                    Time to add Cencori to your project! Choose your preferred language.
                </p>
            </div>

            {/* JavaScript/TypeScript */}
            <div className="space-y-4">
                <h2 className="text-lg font-semibold">JavaScript / TypeScript</h2>
                <p className="text-sm text-muted-foreground">
                    Install the Cencori SDK using your package manager:
                </p>
                <CodeBlock
                    language="bash"
                    filename="terminal"
                    code={`npm install cencori

# or with yarn
yarn add cencori

# or with pnpm
pnpm add cencori`}
                />
            </div>

            {/* Vercel AI SDK */}
            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Vercel AI SDK (Optional)</h2>
                <p className="text-sm text-muted-foreground">
                    If you&apos;re using the Vercel AI SDK, install our provider package:
                </p>
                <CodeBlock
                    language="bash"
                    filename="terminal"
                    code={`npm install @cencori/ai-sdk ai`}
                />
            </div>

            {/* Python */}
            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Python</h2>
                <p className="text-sm text-muted-foreground">
                    Install using pip:
                </p>
                <CodeBlock
                    language="bash"
                    filename="terminal"
                    code={`pip install cencori`}
                />
            </div>

            {/* Environment Variable */}
            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Set Up Environment Variable</h2>
                <p className="text-sm text-muted-foreground">
                    Add your API key to your environment. Create a <code className="px-1.5 py-0.5 rounded bg-muted text-xs">.env.local</code> file in your project root:
                </p>
                <CodeBlock
                    language="bash"
                    filename=".env.local"
                    code={`CENCORI_API_KEY=csk_your_key_here`}
                />
            </div>

            <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <p className="text-sm">
                    <strong>💡 Tip:</strong> The SDK automatically reads <code className="px-1 py-0.5 rounded bg-muted text-xs">CENCORI_API_KEY</code> from your environment, so you don&apos;t need to pass it explicitly.
                </p>
            </div>

            {/* Verify Installation */}
            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Verify Installation</h2>
                <p className="text-sm text-muted-foreground">
                    Quick check if everything is set up correctly:
                </p>
                <CodeBlock
                    language="typescript"
                    filename="test.ts"
                    code={`import { Cencori } from 'cencori';

const cencori = new Cencori();
console.log(cencori.getConfig());
// Should print: { baseUrl: 'https://cencori.com', apiKeyHint: 'csk_...****' }`}
                />
            </div>
        </div>
    );
}
