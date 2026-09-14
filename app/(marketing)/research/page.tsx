import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cencori Research — Pushing computing forward",
  description:
    "Cencori doesn't merely commercialize existing technology. We intend to push computing forward.",
};

const PROGRAMS = [
  {
    href: "/research/ai-systems",
    title: "AI Systems",
    blurb: "The systems around AI itself.",
  },
  {
    href: "/research/computing-systems",
    title: "Computing Systems",
    blurb: "Hardcore infrastructure research.",
  },
  {
    href: "/research/physical-ai-robotics",
    title: "Physical AI & Robotics",
    blurb: "Intelligence in machines and physical environments.",
  },
  {
    href: "/research/scientific-computing",
    title: "Scientific Computing",
    blurb: "Credibility beyond startup AI.",
  },
  {
    href: "/research/hardware-systems",
    title: "Hardware Systems",
    blurb: "Research toward future computing hardware.",
  },
  {
    href: "/research/security-reliability-governance",
    title: "Security, Reliability & Governance",
    blurb: "Safe failure for critical systems.",
  },
];

const OUTPUTS = [
  { href: "/research/publications", title: "Publications", blurb: "Papers, technical reports, benchmarks." },
  { href: "/research/open-research", title: "Open Research", blurb: "Datasets, models, tools, open-source work." },
  { href: "/research/partnerships", title: "Research Partnerships", blurb: "Universities, labs, institutional collaborations." },
  { href: "/blog/engineering", title: "Research Notes", blurb: "Engineering and scientific writing." },
  { href: "/research/labs", title: "Cencori Labs", blurb: "Future identity for a substantial research org." },
];

export default function ResearchPage() {
  return (
    <section className="bg-background">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:px-12 sm:py-32">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Cencori Research
        </p>
        <h1 className="mx-auto mt-4 max-w-3xl font-serif text-4xl font-normal leading-tight tracking-tight text-foreground sm:text-5xl">
          Cencori Research, not solutions for researchers.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Cencori doesn&apos;t merely commercialize existing technology. We intend to push computing forward.
        </p>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROGRAMS.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="rounded-lg border border-foreground/10 p-6 transition-colors hover:border-foreground/30 hover:bg-foreground/5"
            >
              <h2 className="font-serif text-xl text-foreground">{p.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{p.blurb}</p>
            </Link>
          ))}
        </div>
        <div className="mt-12 border-t border-foreground/10 pt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            Index
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {OUTPUTS.map((o) => (
              <Link
                key={o.href}
                href={o.href}
                className="rounded-lg border border-foreground/10 p-5 transition-colors hover:border-foreground/30 hover:bg-foreground/5"
              >
                <h3 className="text-sm font-medium text-foreground">{o.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{o.blurb}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
