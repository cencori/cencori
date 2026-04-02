import React from 'react';
import Link from 'next/link';
import type { Metadata } from "next";
import Navbar from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { buildOgImageUrl } from "@/lib/og";

const changelogOgImage = buildOgImageUrl({
  title: "Changelog",
  subtitle: "New features, improvements, and fixes",
  type: "changelog",
});

export const metadata: Metadata = {
  title: "Changelog",
  description: "New features, improvements, and fixes for Cencori.",
  openGraph: {
    title: "Changelog | Cencori",
    description: "New features, improvements, and fixes for Cencori.",
    images: [changelogOgImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "Changelog | Cencori",
    description: "New features, improvements, and fixes for Cencori.",
    images: [changelogOgImage],
  },
};

// Changelog entry types
type ChangeType = "feature" | "improvement" | "fix" | "breaking";

interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  slug?: string;
  type: ChangeType;
  items: string[];
}

// Add new entries at the top of this array
const changelogData: ChangelogEntry[] = [
  {
    version: "1.1.0",
    date: "2026-04-02",
    title: "Platform expansion across gateway, Scan, observability, billing, and enterprise controls",
    slug: "march-2026-platform-expansion",
    type: "feature",
    items: [
      "Expanded the AI gateway with GPT-5.3 Instant, GPT-5.4, GPT-5.4 Pro, custom provider routing, semantic caching, and stronger fail-soft reliability.",
      "Upgraded Cencori Scan with repo-aware chat, continuity memory, AI quality review, more resilient investigations, and persistent diff / PR actions.",
      "Redesigned observability with anomaly intelligence, unified HTTP traffic views, platform event tracking, circuit breaker thresholds, and a rebuilt geo map.",
      "Shipped organization-level audit logs with backfill, SSO / SAML support, model mappings, export surfaces, and stronger enterprise governance controls.",
      "Added end-user billing, Stripe Connect invoicing flows, budget-oriented product messaging, and tighter integration support for Vercel and custom provider setups.",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-01-05",
    title: "Introducing Cencori",
    slug: "introducing-cencori",
    type: "feature",
    items: [
      "Unified AI Gateway with OpenAI, Anthropic, and Google Gemini support",
      "Real-time security: PII detection, jailbreak protection, content filtering",
      "Custom data rules with block, mask, and redact actions",
      "Multi-provider failover with automatic circuit breaker",
      "Complete audit logs and security incident tracking",
      "Real-time analytics dashboard with cost tracking",
      "TypeScript SDK (npm install cencori)",
      "AI Playground for testing prompts",
    ],
  },
];

const typeBadgeStyles: Record<ChangeType, string> = {
  feature: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500",
  improvement: "border-sky-500/20 bg-sky-500/10 text-sky-500",
  fix: "border-amber-500/20 bg-amber-500/10 text-amber-500",
  breaking: "border-red-500/20 bg-red-500/10 text-red-500",
};

const typeLabels: Record<ChangeType, string> = {
  feature: "Feature",
  improvement: "Improvement",
  fix: "Fix",
  breaking: "Breaking",
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const latestEntry = changelogData[0];

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-foreground selection:text-background flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24">
        <section className="relative mx-auto w-full max-w-4xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-foreground/5 via-background to-background" />

          <div className="relative border-b border-border/40 pb-10">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
              Changelog
            </p>
            <div className="mt-4 space-y-3">
              <div className="space-y-2">
                <h1 className="max-w-[10ch] text-3xl font-bold tracking-tighter text-balance text-foreground sm:text-4xl">
                  What changed.
                </h1>
                <p className="max-w-md text-[13px] leading-6 text-muted-foreground">
                  Compact release notes for what is live across Cencori.
                </p>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Latest v{latestEntry.version}
              </p>
            </div>
          </div>

          <div className="relative mt-8 sm:mt-10">
            <div className="absolute bottom-0 left-[10px] top-0 w-px bg-border/40 sm:left-[107px]" />
            {changelogData.map((entry, index) => {
              const visibleItems = index === 0 ? entry.items : entry.items.slice(0, 3);
              const hiddenCount = entry.items.length - visibleItems.length;

              return (
                <article key={entry.version} className="py-7 sm:py-8">
                  <div className="grid grid-cols-[22px_minmax(0,1fr)] gap-x-4 sm:grid-cols-[96px_22px_minmax(0,1fr)] sm:gap-x-6">
                    <div className="hidden sm:block pt-0.5 text-right">
                      <p className="font-mono text-[11px] font-medium tracking-tight text-foreground">
                        v{entry.version}
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                        {formatDate(entry.date)}
                      </p>
                    </div>

                    <div className="relative flex justify-center">
                      <div className="mt-1.5 h-2.5 w-2.5 rounded-full border border-border bg-background" />
                    </div>

                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-2 sm:hidden">
                        <span className="font-mono text-[11px] font-medium tracking-tight text-foreground">
                          v{entry.version}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDate(entry.date)}
                        </span>
                      </div>

                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] ${typeBadgeStyles[entry.type]}`}
                      >
                        {typeLabels[entry.type]}
                      </span>

                      {entry.slug ? (
                        <Link href={`/blog/${entry.slug}`} className="group block">
                          <h2 className="max-w-[18ch] text-xl font-semibold tracking-tighter text-balance text-foreground transition-colors group-hover:text-foreground/80 sm:text-[1.6rem]">
                            {entry.title}
                          </h2>
                        </Link>
                      ) : (
                        <h2 className="max-w-[18ch] text-xl font-semibold tracking-tighter text-balance text-foreground sm:text-[1.6rem]">
                          {entry.title}
                        </h2>
                      )}

                      <ul className="space-y-2.5">
                        {visibleItems.map((item, itemIndex) => (
                          <li key={itemIndex} className="max-w-3xl text-[13px] leading-6 text-muted-foreground">
                            {item}
                          </li>
                        ))}
                      </ul>

                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        {entry.slug && (
                          <Link
                            href={`/blog/${entry.slug}`}
                            className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground"
                          >
                            Full note
                          </Link>
                        )}

                        {hiddenCount > 0 && (
                          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                            +{hiddenCount} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
