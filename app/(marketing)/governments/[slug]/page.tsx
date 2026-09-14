import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CapabilityStub } from "@/components/marketing/CapabilityStub";

const PAGES: Record<string, { title: string; blurb: string }> = {
  "sovereign-ai": {
    title: "Sovereign AI",
    blurb: "Nationally controlled AI systems on Cencori.",
  },
  "data-residency": {
    title: "Data Residency",
    blurb: "Keep data where the law says it must stay.",
  },
  "private-models": {
    title: "Private Models",
    blurb: "Models under national or institutional control.",
  },
  "regional-compute": {
    title: "Regional Compute",
    blurb: "Compute pinned to a region, on demand.",
  },
  "institutional-governance": {
    title: "Institutional Governance",
    blurb: "Governance fit for public institutions.",
  },
  auditability: {
    title: "Auditability",
    blurb: "Every decision traceable, every action accountable.",
  },
  "controlled-networking": {
    title: "Controlled Networking",
    blurb: "Networking with explicit, enforceable boundaries.",
  },
  "on-premise": {
    title: "On-premise",
    blurb: "Cencori infrastructure on your own hardware.",
  },
};

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) return {};
  return {
    title: `${page.title} | Cencori for Governments`,
    description: page.blurb,
  };
}

export default async function GovernmentCapabilityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) notFound();

  return (
    <CapabilityStub
      eyebrow="Government & Sovereign Infrastructure"
      title={page.title}
      blurb={page.blurb}
      backHref="/governments"
      backLabel="Back to Governments"
    />
  );
}
