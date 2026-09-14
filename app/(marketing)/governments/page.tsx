import type { Metadata } from "next";
import { CapabilityStub } from "@/components/marketing/CapabilityStub";

export const metadata: Metadata = {
  title: "Governments — Infrastructure for nationally controlled AI systems",
  description:
    "Infrastructure for governments, public institutions and nationally controlled AI systems.",
};

export default function GovernmentsPage() {
  return (
    <CapabilityStub
      eyebrow="Infrastructure"
      title="Governments"
      blurb="Infrastructure for governments, public institutions and nationally controlled AI systems."
      backHref="/"
      backLabel="Back to home"
    />
  );
}
