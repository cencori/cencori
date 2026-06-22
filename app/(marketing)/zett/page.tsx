"use client";

import Navbar from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import Link from "next/link";

export default function ZettPage() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-foreground selection:text-background">
      <Navbar homeUrl="/" />

      <main>
        <section className="border-b border-border/30 pt-28 sm:pt-36 pb-0">
          <div className="mx-auto max-w-6xl border-t border-x border-border/30 relative px-6 py-20 sm:px-12 sm:py-28">
            <div className="absolute -top-1.5 -left-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
            <div className="absolute -top-1.5 -right-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
            <div className="absolute -bottom-1.5 -left-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
            <div className="absolute -bottom-1.5 -right-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>

            <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[10px] font-medium tracking-widest uppercase bg-muted/30 text-muted-foreground border border-border/20 mb-8">
                Open Source
              </div>
              <h1 className="font-heading text-[1.875rem] sm:text-[2.125rem] lg:text-[2.375rem] font-semibold tracking-[-0.02em] leading-[1.1]">
                Build agents faster than the
                <span className="text-[#a855f7]"> speed of light</span>.
              </h1>
              <p className="mt-5 text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
                Define agents as files. No SDK boilerplate, no DSL to learn. Write
                agents in TypeScript, deploy anywhere, and let Cencori handle the
                infrastructure.
              </p>
              <div className="mt-10 flex items-center justify-center gap-3">
                <a
                  href="https://github.com/cencori/zett"
                  className="inline-flex items-center gap-2 h-7 rounded-md bg-foreground text-background px-3 text-[11px] font-medium hover:bg-foreground/90 transition-all active:scale-[0.98]"
                >
                  Get Started
                </a>
                <Link
                  href="/zett/docs"
                  className="inline-flex items-center gap-2 h-7 rounded-md border border-foreground/20 bg-transparent px-3 text-[11px] font-medium text-foreground/90 hover:border-foreground/40 hover:bg-foreground/5 transition-all"
                >
                  Read the docs
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border/30">
          <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
            <div className="text-center mb-16">
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Why Zett
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-border/30 bg-card p-8 relative"
                >
                  <div className="absolute -top-1.5 -left-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/30 font-mono text-[10px] select-none pointer-events-none">+</div>
                  <div className="absolute -top-1.5 -right-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/30 font-mono text-[10px] select-none pointer-events-none">+</div>
                  <div className="absolute -bottom-1.5 -left-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/30 font-mono text-[10px] select-none pointer-events-none">+</div>
                  <div className="absolute -bottom-1.5 -right-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/30 font-mono text-[10px] select-none pointer-events-none">+</div>
                  <div className="w-10 h-10 rounded-xl bg-[#a855f7]/15 flex items-center justify-center text-lg mb-5">
                    {f.icon}
                  </div>
                  <h3 className="font-semibold text-sm mb-2">{f.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border/30">
          <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
            <div className="text-center mb-16">
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Code
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {codeExamples.map((ex) => (
                <div
                  key={ex.title}
                  className="rounded-2xl border border-border/30 bg-card p-8 relative"
                >
                  <div className="absolute -top-1.5 -left-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/30 font-mono text-[10px] select-none pointer-events-none">+</div>
                  <div className="absolute -top-1.5 -right-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/30 font-mono text-[10px] select-none pointer-events-none">+</div>
                  <div className="absolute -bottom-1.5 -left-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/30 font-mono text-[10px] select-none pointer-events-none">+</div>
                  <div className="absolute -bottom-1.5 -right-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/30 font-mono text-[10px] select-none pointer-events-none">+</div>
                  <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-4 block">{ex.title}</span>
                  <pre className="text-xs font-mono text-muted-foreground leading-relaxed overflow-x-auto">
                    <code>{ex.code}</code>
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32 text-center">
            <h2 className="font-heading text-[1.5rem] sm:text-[1.75rem] font-semibold tracking-[-0.02em] leading-[1.1] mb-4">
              Ship your first agent in minutes.
            </h2>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed mb-8">
              Install the CLI, scaffold a project, and deploy. No SDK boilerplate,
              no DSL to learn.
            </p>
            <pre className="inline-block rounded-xl border border-border/30 bg-card p-4 text-xs font-mono text-left mb-8">
              <code>{`npx zett@latest init my-agent
cd my-agent
npm run dev`}</code>
            </pre>
            <div className="flex items-center justify-center gap-3">
              <a
                href="https://github.com/cencori/zett"
                className="inline-flex items-center gap-2 h-7 rounded-md bg-foreground text-background px-3 text-[11px] font-medium hover:bg-foreground/90 transition-all active:scale-[0.98]"
              >
                View on GitHub
              </a>
              <Link
                href="/zett/docs"
                className="inline-flex items-center gap-2 h-7 rounded-md border border-foreground/20 bg-transparent px-3 text-[11px] font-medium text-foreground/90 hover:border-foreground/40 hover:bg-foreground/5 transition-all"
              >
                Read the docs
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

const features = [
  {
    icon: "\uD83D\uDCC1",
    title: "Filesystem-first",
    body: "Agents, tools, knowledge, and policies are plain files in your project. No hidden state, no magic.",
  },
  {
    icon: "\u26A1",
    title: "Built on Cencori",
    body: "Model routing, billing, and security delegate to Cencori Gateway. Ship without managing LLM infrastructure.",
  },
  {
    icon: "\uD83D\uDE80",
    title: "Instant deploy",
    body: "Write agents locally, push to production. Zett compiles to a manifest your runtime can load.",
  },
];

const codeExamples = [
  {
    title: "Define an Agent",
    code: `import { defineAgent } from "zett";

export default defineAgent({
  model: "claude-sonnet-4-5",
  cencori: {
    project: "proj_abc",
    billing: { budget: "50.00/month" },
  },
});`,
  },
  {
    title: "Define a Tool",
    code: `import { defineTool } from "zett/tools";
import { z } from "zod";

export default defineTool({
  description: "Get weather for a city.",
  inputSchema: z.object({ city: z.string() }),
  async execute({ city }) {
    return { city, condition: "Sunny", temp: 72 };
  },
});`,
  },
];
