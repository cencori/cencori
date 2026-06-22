import Link from "next/link";

export default function Home() {
  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50 flex justify-center pt-6">
        <nav className="flex items-center gap-6 px-6 py-3 rounded-full bg-card/80 backdrop-blur-xl border border-border text-sm">
          <span className="font-semibold tracking-tight text-base">Jett</span>
          <div className="flex gap-5 text-muted">
            <Link href="/docs" className="hover:text-zinc-100 transition-colors">
              Docs
            </Link>
            <a
              href="https://github.com/cencori/jett"
              className="hover:text-zinc-100 transition-colors"
            >
              GitHub
            </a>
          </div>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <section className="max-w-3xl mx-auto text-center pt-32 pb-40">
          <div className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-medium tracking-widest uppercase bg-accent-soft text-accent border border-accent/20 mb-8">
            Open Source
          </div>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[0.95]">
            Build agents faster than the
            <span className="text-accent"> speed of light</span>.
          </h1>
          <p className="mt-6 text-lg text-muted max-w-xl mx-auto leading-relaxed">
            Define agents as files. No SDK boilerplate, no DSL to learn. Write
            agents in TypeScript, deploy anywhere, and let Cencori handle the
            infrastructure.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <a
              href="https://github.com/cencori/jett"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 bg-zinc-100 text-surface font-medium text-sm hover:bg-zinc-200 transition-all active:scale-[0.98]"
            >
              Get Started
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-surface/10 text-xs">
                ↗
              </span>
            </a>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 border border-border text-sm font-medium text-muted hover:text-zinc-100 hover:border-zinc-600 transition-all"
            >
              Read the docs
            </Link>
          </div>
        </section>

        <section className="w-full max-w-5xl pb-40 grid grid-cols-1 md:grid-cols-3 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-card p-8"
            >
              <div className="w-10 h-10 rounded-xl bg-accent-soft flex items-center justify-center text-lg mb-5">
                {f.icon}
              </div>
              <h3 className="font-semibold text-base mb-2">{f.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted">
        <p>Jett is open source under the MIT License.</p>
      </footer>
    </>
  );
}

const features = [
  {
    icon: "📁",
    title: "Filesystem-first",
    body: "Agents, tools, knowledge, and policies are plain files in your project. No hidden state, no magic.",
  },
  {
    icon: "⚡",
    title: "Built on Cencori",
    body: "Model routing, billing, and security delegate to Cencori Gateway. Ship without managing LLM infrastructure.",
  },
  {
    icon: "🚀",
    title: "Instant deploy",
    body: "Write agents locally, push to production. Jett compiles to a manifest your runtime can load.",
  },
];
