import Link from "next/link";

export default function ProjectLayout() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border/30">
        <div className="mx-auto max-w-screen-xl px-4 md:px-6">
          <div className="flex items-center gap-3 py-3">
            <Link href="/zett" className="text-xs text-muted-foreground hover:text-foreground transition-colors">&larr; Zett</Link>
            <span className="text-muted-foreground/30 text-xs">/</span>
            <Link href="/zett/docs" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Docs</Link>
            <span className="text-muted-foreground/30 text-xs">/</span>
            <span className="text-xs font-medium">Project Layout</span>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 md:px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight mb-8">Project Layout</h1>

        <pre className="rounded-xl border border-border/30 bg-card p-4 text-xs overflow-x-auto font-mono mb-8 leading-relaxed">
          <code>{`my-agent/
├── agent/
│   ├── agent.ts           # defineAgent({ model, cencori })
│   ├── instructions.md    # always-on system prompt
│   ├── tools/             # defineTool — what it can do
│   ├── knowledge/         # defineSkill — what it knows
│   ├── subagents/         # specialist child agents
│   ├── channels/          # defineChannel — HTTP, Slack, etc.
│   ├── schedules/         # defineSchedule — recurring jobs
│   ├── sessions/          # durable execution configuration
│   └── policies/          # security, budgets, guardrails
├── package.json
└── tsconfig.json`}</code>
        </pre>

        <h2 className="text-base font-semibold tracking-tight mb-3">agent.ts</h2>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
          Required config. Defines the model and Cencori integration:
        </p>
        <pre className="rounded-xl border border-border/30 bg-card p-4 text-xs overflow-x-auto font-mono mb-8">
          <code>{`import { defineAgent } from "zett";

export default defineAgent({
  model: "claude-sonnet-4-5",
  cencori: {
    project: "proj_abc",
    billing: { budget: "50.00/month" },
  },
});`}</code>
        </pre>

        <h2 className="text-base font-semibold tracking-tight mb-3">instructions.md</h2>
        <p className="text-xs text-muted-foreground leading-relaxed mb-8">
          Required. The system prompt that defines the agent&apos;s personality and behavior.
        </p>

        <h2 className="text-base font-semibold tracking-tight mb-3">tools/</h2>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
          Optional. TypeScript files exporting a <code className="font-mono text-foreground">defineTool</code> config:
        </p>
        <pre className="rounded-xl border border-border/30 bg-card p-4 text-xs overflow-x-auto font-mono mb-8">
          <code>{`import { defineTool } from "zett/tools";
import { z } from "zod";

export default defineTool({
  description: "...",
  inputSchema: z.object({ ... }),
  async execute(input) { ... },
});`}</code>
        </pre>

        <h2 className="text-base font-semibold tracking-tight mb-3">knowledge/</h2>
        <p className="text-xs text-muted-foreground leading-relaxed mb-8">
          Optional. Markdown or TypeScript files with reference knowledge the agent can load on demand.
        </p>

        <h2 className="text-base font-semibold tracking-tight mb-3">channels/</h2>
        <p className="text-xs text-muted-foreground leading-relaxed mb-8">
          Optional. HTTP, Slack, or custom message ingress.
        </p>

        <h2 className="text-base font-semibold tracking-tight mb-3">schedules/</h2>
        <p className="text-xs text-muted-foreground leading-relaxed mb-8">
          Optional. Recurring cron jobs.
        </p>

        <h2 className="text-base font-semibold tracking-tight mb-3">sessions/</h2>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
          Optional. Configure session behavior:
        </p>
        <pre className="rounded-xl border border-border/30 bg-card p-4 text-xs overflow-x-auto font-mono mb-8">
          <code>{`export default {
  maxTurns: 50,
  idleTimeoutMs: 300000,
  memory: { strategy: "lastN", limit: 20 },
};`}</code>
        </pre>

        <h2 className="text-base font-semibold tracking-tight mb-3">policies/</h2>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
          Optional. Security guards and budgets:
        </p>
        <pre className="rounded-xl border border-border/30 bg-card p-4 text-xs overflow-x-auto font-mono mb-8">
          <code>{`export default {
  inputGuards: ["pii-redaction"],
  outputGuards: ["content-filtering"],
  budget: { maxSpendPerSession: "5.00" },
};`}</code>
        </pre>
      </div>
    </div>
  );
}
