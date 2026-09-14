import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CapabilityStub } from "@/components/marketing/CapabilityStub";

const PAGES: Record<string, { title: string; blurb: string }> = {
  "agent-runtime": {
    title: "Agent Runtime",
    blurb: "Run agents from any framework on Cencori infrastructure.",
  },
  deployment: {
    title: "Deployment",
    blurb: "Deploy agents to production in one step.",
  },
  "persistent-agents": {
    title: "Persistent Agents",
    blurb: "Agents that remember, across sessions and restarts.",
  },
  "scheduled-runs": {
    title: "Scheduled Runs",
    blurb: "Run agents on a schedule, hands-free.",
  },
  "api-triggers": {
    title: "API Triggers",
    blurb: "Invoke agents from any system over HTTP.",
  },
  webhooks: {
    title: "Webhooks",
    blurb: "React to the world with event-driven agents.",
  },
  tools: {
    title: "Tools",
    blurb: "Give agents tools to act with.",
  },
  state: {
    title: "State",
    blurb: "Durable state for long-running agents.",
  },
  "human-approval": {
    title: "Human Approval",
    blurb: "Humans in the loop where it matters.",
  },
  traces: {
    title: "Traces",
    blurb: "See exactly what every agent did, and why.",
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
    title: `${page.title} | Cencori Agents`,
    description: page.blurb,
  };
}

export default async function AgentCapabilityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) notFound();

  return (
    <CapabilityStub
      eyebrow="Agentic Infrastructure"
      title={page.title}
      blurb={page.blurb}
      backHref="/agents"
      backLabel="Back to Agents"
    />
  );
}
