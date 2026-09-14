import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CapabilityStub } from "@/components/marketing/CapabilityStub";

const PAGES: Record<string, { title: string; blurb: string }> = {
  "financial-services": {
    title: "Financial Services",
    blurb:
      "AI infrastructure for financial systems where security, latency, governance and reliability matter.",
  },
  telecommunications: {
    title: "Telecommunications",
    blurb:
      "AI infrastructure for telecommunications networks where uptime and scale are non-negotiable.",
  },
  "healthcare-life-sciences": {
    title: "Healthcare & Life Sciences",
    blurb:
      "AI infrastructure for healthcare and life sciences where accuracy, privacy, and trust matter.",
  },
  "manufacturing-industrial": {
    title: "Manufacturing & Industrial",
    blurb:
      "AI infrastructure for manufacturing and industrial systems where precision and uptime matter.",
  },
  "energy-resources": {
    title: "Energy & Resources",
    blurb:
      "AI infrastructure for energy and resources where reliability and control matter.",
  },
  "government-public-systems": {
    title: "Government & Public Systems",
    blurb:
      "AI infrastructure for governments and public systems where accountability and continuity matter.",
  },
  "defence-national-security": {
    title: "Defence & National Security",
    blurb:
      "AI infrastructure for defence and national security where control and assurance matter.",
  },
  "agriculture-food-systems": {
    title: "Agriculture & Food Systems",
    blurb:
      "AI infrastructure for agriculture and food systems from soil to supply chain.",
  },
  "mobility-autonomous-systems": {
    title: "Mobility & Autonomous Systems",
    blurb:
      "AI infrastructure for mobility and autonomous systems where safety and reliability matter.",
  },
  technology: {
    title: "Technology",
    blurb:
      "AI infrastructure for technology companies building the intelligence era.",
  },
};

export function generateStaticParams() {
  return Object.keys(PAGES).map((sector) => ({ sector }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sector: string }>;
}): Promise<Metadata> {
  const { sector } = await params;
  const page = PAGES[sector];
  if (!page) return {};
  return {
    title: `${page.title} | Cencori Industries`,
    description: page.blurb,
  };
}

export default async function IndustrySectorPage({
  params,
}: {
  params: Promise<{ sector: string }>;
}) {
  const { sector } = await params;
  const page = PAGES[sector];
  if (!page) notFound();

  return (
    <CapabilityStub
      eyebrow="Industries"
      title={page.title}
      blurb={page.blurb}
      backHref="/"
      backLabel="Back to home"
    />
  );
}
