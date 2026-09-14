import type { Metadata } from "next";
import Link from "next/link";
import { arcieBrand } from "@/lib/arcie-brand";

export const metadata: Metadata = {
  title: "Arcie | Model-agnostic agent infrastructure | Cencori",
  description: `${arcieBrand.definition}. ${arcieBrand.description} The framework is available; the managed API is in development.`,
  openGraph: {
    title: arcieBrand.definition,
    description: `${arcieBrand.description} The managed API is in development.`,
    url: "https://cencori.com/arcie",
  },
};

export default function ArciePage() {
  return (
      <main>
        <section className="overflow-x-clip border-b border-border/30 pt-28 sm:pt-36 pb-0">
          <div className="mx-auto max-w-6xl border-t border-x border-border/30 relative px-6 py-20 sm:px-12 sm:py-28">
            <div className="absolute -top-1.5 -left-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
            <div className="absolute -top-1.5 -right-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
            <div className="absolute -bottom-1.5 -left-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
            <div className="absolute -bottom-1.5 -right-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>

            <div className="max-w-3xl mx-auto text-center">
              <p className="mb-8 font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
                Open-source framework · Managed API
              </p>
              <h1 className="font-heading text-balance text-[1.875rem] sm:text-[2.125rem] lg:text-[2.375rem] font-semibold tracking-[-0.02em] leading-[1.15]">
                {arcieBrand.definition}.
              </h1>
              <p className="mt-5 text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
                {arcieBrand.description}
              </p>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                <a
                  href="https://github.com/cencori/arcie"
                  className="inline-flex min-h-11 items-center gap-2 rounded-md bg-foreground text-background px-4 text-xs font-medium hover:bg-foreground/90 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
                >
                  Explore the framework
                </a>
                <Link
                  href="/arcie/docs/managed-api"
                  className="inline-flex min-h-11 items-center gap-2 rounded-md border border-foreground/20 bg-transparent px-4 text-xs font-medium text-foreground/90 hover:border-foreground/40 hover:bg-foreground/5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
                >
                  Explore the managed API
                </Link>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                Framework available. Managed API in development.
              </p>
            </div>
          </div>
        </section>
        <section aria-labelledby="arcie-entry-points" className="mx-auto max-w-6xl border-x border-b border-border/30">
          <div className="px-6 py-10 sm:px-12 sm:py-14">
            <h2 id="arcie-entry-points" className="text-xl font-semibold tracking-tight">
              One agent system. Two ways to build.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Build the product around your agents. Choose how much of the
              underlying infrastructure you want to operate.
            </p>
          </div>
          <div className="grid border-t border-border/30 md:grid-cols-2">
            <article className="border-b border-border/30 px-6 py-10 sm:px-12 md:border-b-0 md:border-r">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {arcieBrand.framework.status}
              </p>
              <h3 className="mt-4 text-lg font-semibold">{arcieBrand.framework.label}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {arcieBrand.framework.description}
              </p>
              <Link href="/arcie/docs" className="mt-5 inline-flex min-h-11 items-center text-sm underline underline-offset-4 hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground">
                Read the framework docs
              </Link>
            </article>
            <article className="px-6 py-10 sm:px-12">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {arcieBrand.managedApi.status}
              </p>
              <h3 className="mt-4 text-lg font-semibold">{arcieBrand.managedApi.label}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {arcieBrand.managedApi.description}
              </p>
              <Link href="/arcie/docs/managed-api" className="mt-5 inline-flex min-h-11 items-center text-sm underline underline-offset-4 hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground">
                Read the API direction
              </Link>
            </article>
          </div>
        </section>
      </main>
  );
}
