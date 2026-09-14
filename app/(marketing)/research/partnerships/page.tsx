import type { Metadata } from "next";
import { CapabilityStub } from "@/components/marketing/CapabilityStub";

export const metadata: Metadata = {
  title: "Research Partnerships | Cencori Research",
  description: "Universities, research labs, and institutional collaborations.",
};

export default function PartnershipsPage() {
  return (
    <CapabilityStub
      eyebrow="Cencori Research"
      title="Research Partnerships"
      blurb="Universities, research labs, and institutional collaborations."
      backHref="/research"
      backLabel="Back to Research"
    />
  );
}
