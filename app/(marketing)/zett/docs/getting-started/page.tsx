import Link from "next/link";

export default function GettingStarted() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border/30">
        <div className="mx-auto max-w-screen-xl px-4 md:px-6">
          <div className="flex items-center gap-3 py-3">
            <Link href="/zett" className="text-xs text-muted-foreground hover:text-foreground transition-colors">&larr; Zett</Link>
            <span className="text-muted-foreground/30 text-xs">/</span>
            <Link href="/zett/docs" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Docs</Link>
            <span className="text-muted-foreground/30 text-xs">/</span>
            <span className="text-xs font-medium">Getting Started</span>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 md:px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight mb-8">Getting Started</h1>

        <h2 className="text-base font-semibold tracking-tight mb-3">Install</h2>
        <pre className="rounded-xl border border-border/30 bg-card p-4 text-xs overflow-x-auto font-mono mb-8">
          <code>{`npx zett@latest init my-agent
cd my-agent
npm install`}</code>
        </pre>

        <h2 className="text-base font-semibold tracking-tight mb-3">Run</h2>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
          This starts a local dev server. Send requests:
        </p>
        <pre className="rounded-xl border border-border/30 bg-card p-4 text-xs overflow-x-auto font-mono mb-8">
          <code>{`npm run dev`}</code>
        </pre>
        <pre className="rounded-xl border border-border/30 bg-card p-4 text-xs overflow-x-auto font-mono mb-8">
          <code>{`curl -X POST http://localhost:3000 \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello!"}'`}</code>
        </pre>

        <h2 className="text-base font-semibold tracking-tight mb-3">Add a Tool</h2>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
          Create <code className="font-mono text-foreground">agent/tools/get_weather.ts</code>:
        </p>
        <pre className="rounded-xl border border-border/30 bg-card p-4 text-xs overflow-x-auto font-mono mb-8">
          <code>{`import { defineTool } from "zett/tools";
import { z } from "zod";

export default defineTool({
  description: "Get the current weather for a city.",
  inputSchema: z.object({ city: z.string() }),
  async execute({ city }) {
    return { city, condition: "Sunny", temperatureF: 72 };
  },
});`}</code>
        </pre>

        <h2 className="text-base font-semibold tracking-tight mb-3">Deploy</h2>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
          Set your Cencori API key and deploy to your infrastructure:
        </p>
        <pre className="rounded-xl border border-border/30 bg-card p-4 text-xs overflow-x-auto font-mono mb-8">
          <code>{`export CENCORI_API_KEY=sk_...
export CENCORI_PROJECT_ID=proj_...

npm run build`}</code>
        </pre>
      </div>
    </div>
  );
}
