import type { Metadata } from "next";
import { CapabilityStub } from "@/components/marketing/CapabilityStub";

export const metadata: Metadata = {
  title: "Publications | Cencori Research",
  description: "Papers, technical reports, benchmarks from Cencori Research.",
};

export default function PublicationsPage() {
  return (
    <CapabilityStub
      eyebrow="Cencori Research"
      title="Publications"
      blurb="Papers, technical reports, benchmarks from Cencori Research."
      backHref="/research"
      backLabel="Back to Research"
    />
  );
}
