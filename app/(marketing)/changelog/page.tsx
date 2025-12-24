import React from 'react';
import Link from 'next/link';
import { Badge } from "@/components/ui/badge";
import type { Metadata } from "next";

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
    version: "1.5.0",
    date: "2025-12-24",
    title: "Python SDK Published",
    slug: "python-sdk-published",
    type: "feature",
    items: [
      "Published cencori package to PyPI",
      "Full feature parity with TypeScript SDK",
      "Streaming support with httpx",
      "Type-safe dataclasses for all responses",
      "Comprehensive error handling",
    ],
  },
  {
    version: "1.4.0",
    date: "2025-12-23",
    title: "Cenpact Design System",
    slug: "cenpact-design-system",
    type: "improvement",
    items: [
      "Introduced Cenpact: dense, developer-first design language",
      "Redesigned dashboard with compact layouts",
      "Updated blog and docs with new typography scale",
      "Dark mode native with subtle sophistication",
      "Dynamic OG image generation with Cenpact styling",
    ],
  },
  {
    version: "1.3.0",
    date: "2025-12-20",
    title: "Edge Feature (Preview)",
    slug: "edge-feature-preview",
    type: "feature",
    items: [
      "Edge runtime support for low-latency regions",
      "Automatic request routing to nearest edge node",
      "Preview available for Pro tier users",
      "Currently in beta, full release coming soon",
    ],
  },
  {
    version: "1.2.0",
    date: "2025-12-15",
    title: "TypeScript SDK Published",
    slug: "typescript-sdk-published",
    type: "feature",
    items: [
      "Published cencori package to npm",
      "Full client with cencori.ai.chat() and cencori.ai.chatStream()",
      "Typed responses and error handling",
      "ESM and CommonJS support",
      "Comprehensive documentation and examples",
    ],
  },
  {
    version: "1.0.0",
    date: "2025-12-01",
    title: "API Gateway Launch",
    slug: "api-gateway-launch",
    type: "feature",
    items: [
      "Multi-provider support (OpenAI, Anthropic, Google Gemini)",
      "Security scanning with PII detection and prompt injection protection",
      "Credits-based billing with real-time cost tracking",
      "Real-time streaming with Server-Sent Events",
      "Complete audit logs for every request",
      "Dashboard with analytics and usage tracking",
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
  );
}
