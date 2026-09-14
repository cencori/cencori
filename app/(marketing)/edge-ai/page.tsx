import type { Metadata } from "next";
import { CapabilityStub } from "@/components/marketing/CapabilityStub";

export const metadata: Metadata = {
  title: "Edge & Physical AI — Run AI inside machines",
  description: "Run AI inside machines, devices and physical environments.",
};

export default function EdgeAiPage() {
  return (
    <CapabilityStub
      eyebrow="Infrastructure"
      title="Edge & Physical AI"
      blurb="Run AI inside machines, devices and physical environments."
      backHref="/"
      backLabel="Back to home"
    />
  );
}
