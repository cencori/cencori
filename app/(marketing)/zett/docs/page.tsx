import Link from "next/link";

export default function ZettDocs() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border/30">
        <div className="mx-auto max-w-screen-xl px-4 md:px-6">
          <div className="flex items-center gap-3 py-3">
            <Link href="/zett" className="text-xs text-muted-foreground hover:text-foreground transition-colors">&larr; Zett</Link>
            <span className="text-muted-foreground/30 text-xs">/</span>
            <span className="text-xs font-medium">Docs</span>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 md:px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight mb-3">Zett Documentation</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Zett is a filesystem-first framework for production agents on Cencori.
        </p>
        <hr className="border-border/30 mb-8" />

        <h2 className="text-base font-semibold tracking-tight mb-3">Getting Started</h2>
        <ul className="space-y-2 mb-8">
          <li><Link href="/zett/docs/getting-started" className="text-xs text-[#a855f7] hover:underline">Getting Started</Link></li>
          <li><Link href="/zett/docs/project-layout" className="text-xs text-[#a855f7] hover:underline">Project Layout</Link></li>
        </ul>

        <h2 className="text-base font-semibold tracking-tight mb-3">Authoring</h2>
        <ul className="space-y-1.5 mb-8 text-xs text-muted-foreground">
          <li><code className="text-foreground font-mono">defineAgent</code> &mdash; Agent configuration</li>
          <li><code className="text-foreground font-mono">defineTool</code> &mdash; Tool creation</li>
          <li><code className="text-foreground font-mono">defineInstructions</code> &mdash; System prompt</li>
          <li><code className="text-foreground font-mono">defineSkill</code> &mdash; Loadable procedures</li>
          <li><code className="text-foreground font-mono">defineHook</code> &mdash; Lifecycle hooks</li>
          <li><code className="text-foreground font-mono">defineChannel</code> &mdash; Message channels</li>
          <li><code className="text-foreground font-mono">defineSchedule</code> &mdash; Recurring jobs</li>
        </ul>

        <h2 className="text-base font-semibold tracking-tight mb-3">Runtime</h2>
        <ul className="space-y-1.5 mb-8 text-xs text-muted-foreground">
          <li><code className="text-foreground font-mono">getSession</code> &mdash; Current session context</li>
          <li><code className="text-foreground font-mono">getContext</code> &mdash; Shared context</li>
          <li><code className="text-foreground font-mono">runAgent</code> &mdash; Execute a single turn</li>
          <li><code className="text-foreground font-mono">streamAgent</code> &mdash; Stream a response</li>
        </ul>

        <h2 className="text-base font-semibold tracking-tight mb-3">Cencori Integration</h2>
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          <li><code className="text-foreground font-mono">cencori: &#123;&#125;</code> config block in agent.ts</li>
          <li>Policies (security, budgets, guardrails)</li>
          <li>Sessions (durable execution)</li>
        </ul>
      </div>
    </div>
  );
}
