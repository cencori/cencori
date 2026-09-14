import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CapabilityStub } from "@/components/marketing/CapabilityStub";

const PAGES: Record<string, { title: string; blurb: string }> = {
  training: {
    title: "Training",
    blurb: "Train models on Cencori compute, at any scale.",
  },
  "fine-tuning": {
    title: "Fine-tuning",
    blurb: "Adapt frontier models to your data and your task.",
  },
  evaluation: {
    title: "Evaluation",
    blurb: "Measure model quality before you ship.",
  },
  "model-registry": {
    title: "Model Registry",
    blurb: "Version, store, and share every model in one registry.",
  },
  hosting: {
    title: "Hosting",
    blurb: "Host public and private models on Cencori infrastructure.",
  },
  deployment: {
    title: "Deployment",
    blurb: "Deploy models to production in one step.",
  },
  inference: {
    title: "Inference",
    blurb: "Low-latency inference for your own models.",
  },
  "private-models": {
    title: "Private Models",
    blurb: "Your models, isolated and under your control.",
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
    title: `${page.title} | Cencori Models`,
    description: page.blurb,
  };
}

export default async function ModelCapabilityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) notFound();

  return (
    <CapabilityStub
      eyebrow="Model Infrastructure"
      title={page.title}
      blurb={page.blurb}
      backHref="/models"
      backLabel="Back to Models"
    />
  );
}
