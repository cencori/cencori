import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CapabilityStub } from "@/components/marketing/CapabilityStub";

const PAGES: Record<string, { title: string; blurb: string }> = {
  deployment: {
    title: "Deployment",
    blurb: "Deploy AI workloads on Cencori, wherever they need to run.",
  },
  "private-ai": {
    title: "Private AI",
    blurb: "AI infrastructure isolated to your organization.",
  },
  identity: {
    title: "Identity",
    blurb: "Identity and access for every AI workload.",
  },
  governance: {
    title: "Governance",
    blurb: "Policies and controls for operating AI at scale.",
  },
  "cost-control": {
    title: "Cost Control",
    blurb: "Budgets, limits, and spend visibility for AI workloads.",
  },
  "private-deployment": {
    title: "Private Deployment",
    blurb: "Deploy AI inside your own perimeter.",
  },
  vpc: {
    title: "Private Cloud / VPC",
    blurb: "Cencori primitives inside your virtual private cloud.",
  },
  audit: {
    title: "Audit",
    blurb: "Audit trails for every AI action.",
  },
  cloud: {
    title: "Cencori Cloud",
    blurb: "Run on Cencori Cloud.",
  },
  sovereign: {
    title: "Sovereign Infrastructure",
    blurb: "Nationally controlled Cencori deployments.",
  },
  edge: {
    title: "Edge",
    blurb: "Run Cencori at the edge.",
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
    title: `${page.title} | Cencori Infrastructure`,
    description: page.blurb,
  };
}

export default async function InfrastructureCapabilityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) notFound();

  return (
    <CapabilityStub
      eyebrow="Infrastructure"
      title={page.title}
      blurb={page.blurb}
      backHref="/"
      backLabel="Back to home"
    />
  );
}
