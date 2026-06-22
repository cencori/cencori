import Link from "next/link";

export default function ZettPage() {
  return (
    <div className="bg-background text-foreground selection:bg-foreground selection:text-background min-h-dvh flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-lg border-b border-border/30">
        <div className="mx-auto max-w-screen-xl px-4 md:px-6">
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-6">
              <Link href="/" className="text-xs text-muted hover:text-foreground transition-colors">
                Cencori
              </Link>
              <span className="text-muted/30 text-xs">/</span>
              <span className="font-semibold tracking-tight text-sm">Zett</span>
              <nav className="hidden md:flex items-center gap-5 ml-2">
                <Link href="/zett/docs" className="text-xs font-medium text-muted hover:text-foreground transition-colors">
                  Docs
                </Link>
                <a
                  href="https://github.com/cencori/zett"
                  className="text-xs font-medium text-muted hover:text-foreground transition-colors"
                >
                  GitHub
                </a>
              </nav>
            </div>
            <a
              href="https://github.com/cencori/zett"
              className="inline-flex items-center gap-2 h-7 rounded-md bg-foreground text-background px-3 text-[11px] font-medium hover:bg-foreground/90 transition-all active:scale-[0.98]"
            >
              Get Started
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="border-b border-border/30 pt-28 sm:pt-36 pb-0">
          <div className="mx-auto max-w-6xl border-t border-x border-border/30 relative px-6 py-20 sm:px-12 sm:py-28">
            <div className="absolute -top-1.5 -left-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
            <div className="absolute -top-1.5 -right-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
            <div className="absolute -bottom-1.5 -left-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
            <div className="absolute -bottom-1.5 -right-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>

            <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[10px] font-medium tracking-widest uppercase bg-accent-soft text-accent border border-accent/20 mb-8">
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
                  className="inline-flex items-center gap-2 h-7 rounded-md border border-border/20 bg-transparent px-3 text-[11px] font-medium text-foreground/90 hover:border-foreground/40 hover:bg-foreground/5 transition-all"
                >
                  Read the docs
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-32">
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
        </section>
      </main>

      <footer className="border-t border-border/30 pt-8 pb-4">
        <div className="max-w-screen-xl mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
            <div className="col-span-2 md:col-span-1">
              <span className="text-sm font-semibold tracking-tight">Zett</span>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-2">
                Build agents faster than the speed of light.
              </p>
            </div>
            <div>
              <h4 className="text-[10px] font-medium uppercase tracking-wider mb-3">Product</h4>
              <ul className="space-y-1.5">
                <li><Link href="/zett/docs" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Docs</Link></li>
                <li><a href="https://github.com/cencori/zett" className="text-xs text-muted-foreground hover:text-foreground transition-colors">GitHub</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[10px] font-medium uppercase tracking-wider mb-3">Ecosystem</h4>
              <ul className="space-y-1.5">
                <li><Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cencori</Link></li>
                <li><Link href="/docs" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cencori Docs</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[10px] font-medium uppercase tracking-wider mb-3">Legal</h4>
              <ul className="space-y-1.5">
                <li><Link href="/terms-of-service" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Terms</Link></li>
                <li><Link href="/privacy-policy" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Privacy</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border/20 pt-4">
            <p className="text-[10px] text-muted-foreground/50">
              &copy; 2026 Cencori Inc.
            </p>
          </div>
        </div>
      </footer>
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
