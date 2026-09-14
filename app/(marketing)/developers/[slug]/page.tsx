import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CapabilityStub } from "@/components/marketing/CapabilityStub";

const PAGES: Record<string, { title: string; blurb: string }> = {
  apis: {
    title: "APIs",
    blurb: "One consistent API surface for everything Cencori offers.",
  },
  inference: {
    title: "Inference",
    blurb: "Fast, reliable inference on any frontier model.",
  },
  "agent-deployment": {
    title: "Agent Deployment",
    blurb: "Ship agents to production with a single deploy.",
  },
  "web-tools": {
    title: "Web Tools",
    blurb: "Search, fetch, extract, and crawl the web programmatically.",
  },
  multimodal: {
    title: "Multimodal",
    blurb: "Work with text, images, audio, and video in one pipeline.",
  },
  voice: {
    title: "Voice",
    blurb: "Real-time voice interfaces for AI products.",
  },
  billing: {
    title: "Billing",
    blurb: "Usage-based billing infrastructure for AI workloads.",
  },
  observability: {
    title: "Observability",
    blurb: "Traces, logs, and metrics across every AI call.",
  },
  sdks: {
    title: "SDKs",
    blurb: "First-class SDKs for every major language.",
  },
  cli: {
    title: "CLI",
    blurb: "Manage Cencori from the command line.",
  },
  mcp: {
    title: "MCP",
    blurb: "Cencori, native to every MCP client.",
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
    title: `${page.title} | Cencori for Developers`,
    description: page.blurb,
  };
}

export default async function DeveloperCapabilityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) notFound();

  return (
    <CapabilityStub
      eyebrow="Developers"
      title={page.title}
      blurb={page.blurb}
      backHref="/developers"
      backLabel="Back to Developers"
    />
  );
}
