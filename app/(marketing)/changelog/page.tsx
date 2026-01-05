import React from 'react';
import Link from 'next/link';
import { Badge } from "@/components/ui/badge";
import type { Metadata } from "next";
import Navbar from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Changelog",
  description: "New features, improvements, and fixes for Cencori.",
  openGraph: {
    title: "Changelog | Cencori",
    description: "New features, improvements, and fixes for Cencori.",
    images: ["/api/og?title=Changelog&subtitle=New features, improvements, and fixes&type=changelog"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Changelog | Cencori",
    description: "New features, improvements, and fixes for Cencori.",
    images: ["/api/og?title=Changelog&subtitle=New features, improvements, and fixes&type=changelog"],
  },
};

// Changelog entry types
type ChangeType = "feature" | "improvement" | "fix" | "breaking";

interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  slug: string;
  type: ChangeType;
  items: string[];
}

// Add new entries at the top of this array
const changelogData: ChangelogEntry[] = [
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

// Badge styling based on type
const typeBadgeStyles: Record<ChangeType, string> = {
  feature: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  improvement: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  fix: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  breaking: "bg-red-500/10 text-red-500 border-red-500/20",
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

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 pt-20">
        <div className="container mx-auto py-16 px-4 max-w-3xl">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl font-bold tracking-tight mb-4">Changelog</h1>
            <p className="text-muted-foreground text-lg">
              New features, improvements, and fixes for Cencori.
            </p>
          </div>

          {/* Timeline */}
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

            {/* Entries */}
            <div className="space-y-12">
              {changelogData.map((entry, index) => (
                <div key={entry.version} className="relative pl-8">
                  {/* Timeline dot */}
                  <div className="absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full bg-background border-2 border-primary" />

                  {/* Entry content */}
                  <div className="space-y-3">
                    {/* Version and date */}
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono font-semibold text-lg">
                        v{entry.version}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        {formatDate(entry.date)}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${typeBadgeStyles[entry.type]}`}
                      >
                        {typeLabels[entry.type]}
                      </Badge>
                    </div>

                    {/* Title */}
                    <Link href={`/blog/${entry.slug}`} className="group">
                      <h2 className="text-xl font-semibold group-hover:text-primary transition-colors">
                        {entry.title}
                      </h2>
                    </Link>

                    {/* Items */}
                    <ul className="space-y-2 text-muted-foreground">
                      {entry.items.map((item, itemIndex) => (
                        <li key={itemIndex} className="flex items-start gap-2">
                          <span className="text-primary mt-1.5">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
