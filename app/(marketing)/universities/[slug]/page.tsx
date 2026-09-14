import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CapabilityStub } from "@/components/marketing/CapabilityStub";

const PAGES: Record<string, { title: string; blurb: string }> = {
  "model-training": {
    title: "Model Training",
    blurb: "Train models for research, at any scale.",
  },
  "scientific-compute": {
    title: "Scientific Compute",
    blurb: "Compute for science, not just products.",
  },
  datasets: {
    title: "Datasets",
    blurb: "Store, version, and share research datasets.",
  },
  experiments: {
    title: "Experiments",
    blurb: "Run and reproduce experiments cleanly.",
  },
  checkpoints: {
    title: "Checkpoints",
    blurb: "Never lose a training run again.",
  },
  evaluation: {
    title: "Evaluation",
    blurb: "Evaluate models rigorously before you publish.",
  },
  simulation: {
    title: "Simulation",
    blurb: "Simulate worlds for models and agents.",
  },
  "research-agents": {
    title: "Research Agents",
    blurb: "Agents as instruments of discovery.",
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
    title: `${page.title} | Cencori for Research`,
    description: page.blurb,
  };
}

export default async function UniversityCapabilityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) notFound();

  return (
    <CapabilityStub
      eyebrow="Research & Universities"
      title={page.title}
      blurb={page.blurb}
      backHref="/universities"
      backLabel="Back to Research"
    />
  );
}
