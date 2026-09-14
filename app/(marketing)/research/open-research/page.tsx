import type { Metadata } from "next";
import { CapabilityStub } from "@/components/marketing/CapabilityStub";

export const metadata: Metadata = {
  title: "Open Research | Cencori Research",
  description: "Datasets, models, tools, and open-source work from Cencori Research.",
};

export default function OpenResearchPage() {
  return (
    <CapabilityStub
      eyebrow="Cencori Research"
      title="Open Research"
      blurb="Datasets, models, tools, and open-source work from Cencori Research."
      backHref="/research"
      backLabel="Back to Research"
    />
  );
}
