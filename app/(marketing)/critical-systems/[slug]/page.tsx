import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CapabilityStub } from "@/components/marketing/CapabilityStub";

const PAGES: Record<string, { title: string; blurb: string }> = {
  "financial-infrastructure": {
    title: "Financial Infrastructure",
    blurb: "AI infrastructure for financial systems.",
  },
  telecommunications: {
    title: "Telecommunications",
    blurb: "AI infrastructure for telecom networks.",
  },
  healthcare: {
    title: "Healthcare",
    blurb: "AI infrastructure for healthcare systems.",
  },
  "industrial-systems": {
    title: "Industrial Systems",
    blurb: "AI infrastructure for industry.",
  },
  energy: {
    title: "Energy",
    blurb: "AI infrastructure for energy systems.",
  },
  "public-infrastructure": {
    title: "Public Infrastructure",
    blurb: "AI infrastructure for public systems.",
  },
  defence: {
    title: "Defence",
    blurb: "AI infrastructure for defence systems.",
  },
  "autonomous-systems": {
    title: "Autonomous Systems",
    blurb: "AI infrastructure for autonomous machines.",
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
    title: `${page.title} | Cencori Critical Systems`,
    description: page.blurb,
  };
}

export default async function CriticalCapabilityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) notFound();

  return (
    <CapabilityStub
      eyebrow="Critical Systems"
      title={page.title}
      blurb={page.blurb}
      backHref="/critical-systems"
      backLabel="Back to Critical Systems"
    />
  );
}
