import type { Metadata } from "next";
import { CapabilityStub } from "@/components/marketing/CapabilityStub";

export const metadata: Metadata = {
  title: "Compute — Deploy and run your agents on Cencori",
  description:
    "Connect a repository, deploy your agent and get a live endpoint, with models, memory and monitoring built in. Compute is in the works.",
};

// Hosted deployments are still a local-only build (lib/compute/availability.ts),
// so the public page says so instead of describing a product nobody can use yet.
export default function ComputePage() {
  return (
    <CapabilityStub
      eyebrow="Compute · Coming soon"
      title="Compute"
      blurb="Connect a repository, deploy your agent and get a live endpoint, with models, memory and monitoring built in."
      backHref="/"
      backLabel="Back to home"
    />
  );
}
