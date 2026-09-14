import type { Metadata } from "next";
import { CapabilityStub } from "@/components/marketing/CapabilityStub";

export const metadata: Metadata = {
  title: "Cencori Labs | Cencori Research",
  description: "Future identity for a substantial Cencori research organization.",
};

export default function LabsPage() {
  return (
    <CapabilityStub
      eyebrow="Cencori Research"
      title="Cencori Labs"
      blurb="Future identity for a substantial Cencori research organization."
      backHref="/research"
      backLabel="Back to Research"
    />
  );
}
