import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CapabilityStub } from "@/components/marketing/CapabilityStub";

const PAGES: Record<string, { title: string; blurb: string }> = {
  robotics: {
    title: "Robotics",
    blurb: "Run AI inside robots.",
  },
  drones: {
    title: "Drones",
    blurb: "Run AI inside drones.",
  },
  vehicles: {
    title: "Vehicles",
    blurb: "Run AI inside vehicles.",
  },
  sensors: {
    title: "Sensors",
    blurb: "Run AI where the data is captured.",
  },
  "industrial-equipment": {
    title: "Industrial Equipment",
    blurb: "Run AI inside industrial equipment.",
  },
  "edge-devices": {
    title: "Edge Devices",
    blurb: "Run AI on edge devices.",
  },
  "fleet-deployment": {
    title: "Fleet Deployment",
    blurb: "Deploy AI across a fleet of machines.",
  },
  "local-inference": {
    title: "Local Inference",
    blurb: "Inference on-device, without the round trip.",
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
    title: `${page.title} | Cencori Edge & Physical AI`,
    description: page.blurb,
  };
}

export default async function EdgeAiCapabilityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) notFound();

  return (
    <CapabilityStub
      eyebrow="Edge & Physical AI"
      title={page.title}
      blurb={page.blurb}
      backHref="/edge-ai"
      backLabel="Back to Edge & Physical AI"
    />
  );
}
