import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

export const GatewayWedge = () => {
  return (
    <section className="bg-background border-b border-border/30">
      <div className="mx-auto max-w-6xl border-x border-border/30 relative">
        {/* Corner Intersection Markers */}
        <div className="absolute -top-1.5 -left-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
        <div className="absolute -top-1.5 -right-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
        <div className="absolute -bottom-1.5 -left-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
        <div className="absolute -bottom-1.5 -right-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>

        {/* Column Divider Intersection Markers */}
        <div className="hidden md:flex absolute -top-1.5 left-1/2 -translate-x-1/2 h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
        <div className="hidden md:flex absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>

        <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/30">
          {/* Left Side: Content */}
          <div className="px-6 py-16 md:py-24 md:pr-12 flex flex-col justify-center">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              Start here
            </p>
            <h2 className="font-serif text-3xl font-normal leading-tight tracking-tight sm:text-4xl lg:text-5xl text-foreground">
              AI Gateway
            </h2>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground">
              One OpenAI-compatible API for every model — with enterprise security,
              real-time observability, and smart routing built in.
            </p>
            <Link href={siteConfig.links.products.aiGateway} className="mt-8 inline-block">
              <Button className="h-7 rounded-md bg-foreground px-3 text-[11px] font-medium text-background hover:bg-foreground/90 transition-colors">
                Explore AI Gateway
              </Button>
            </Link>
          </div>

          {/* Right Side: Architecture Diagram */}
          <div className="px-6 py-16 md:py-24 flex items-center justify-center">
            {/* Light mode diagram */}
            <Image
              src="/archie-ww.svg"
              alt="Cencori AI Gateway architecture — request pipeline with guardrails, semantic cache, and smart failover routing to multiple providers"
              width={520}
              height={400}
              className="block dark:hidden w-full h-auto"
              priority
            />
            {/* Dark mode diagram */}
            <Image
              src="/archie.svg"
              alt="Cencori AI Gateway architecture — request pipeline with guardrails, semantic cache, and smart failover routing to multiple providers"
              width={520}
              height={400}
              className="hidden dark:block w-full h-auto"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
};
