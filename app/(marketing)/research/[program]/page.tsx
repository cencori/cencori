import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CapabilityStub } from "@/components/marketing/CapabilityStub";

const PAGES: Record<string, { title: string; blurb: string }> = {
  "ai-systems": {
    title: "AI Systems",
    blurb: "Research on the systems around AI itself — how models are trained, run, remembered and reasoned with.",
  },
  "computing-systems": {
    title: "Computing Systems",
    blurb: "Hardcore infrastructure research — distributed computing, runtimes, scheduling and performance at scale.",
  },
  "physical-ai-robotics": {
    title: "Physical AI & Robotics",
    blurb: "Research on intelligence in the physical world — robotics, autonomous machines and edge embodied systems.",
  },
  "scientific-computing": {
    title: "Scientific Computing",
    blurb: "Scientific computing that gives Cencori credibility beyond startup AI — from biology to climate to simulation.",
  },
  "hardware-systems": {
    title: "Hardware Systems",
    blurb: "Hardware systems research — architecture, accelerators and co-design. Research toward future Cencori silicon, not products today.",
  },
  "security-reliability-governance": {
    title: "Security, Reliability & Governance",
    blurb: "Research on AI security, privacy, verifiable audit and safe failure for critical-system assurance.",
  },
};

export function generateStaticParams() {
  return Object.keys(PAGES).map((program) => ({ program }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ program: string }>;
}): Promise<Metadata> {
  const { program } = await params;
  const page = PAGES[program];
  if (!page) return {};
  return {
    title: `${page.title} | Cencori Research`,
    description: page.blurb,
  };
}

export default async function ResearchProgramPage({
  params,
}: {
  params: Promise<{ program: string }>;
}) {
  const { program } = await params;
  const page = PAGES[program];
  if (!page) notFound();

  return (
    <CapabilityStub
      eyebrow="Cencori Research"
      title={page.title}
      blurb={page.blurb}
      backHref="/research"
      backLabel="Back to Research"
    />
  );
}
