import type { Metadata } from "next";
import { CapabilityStub } from "@/components/marketing/CapabilityStub";

export const metadata: Metadata = {
  title: "Critical Systems — AI infrastructure where failure matters",
  description:
    "AI infrastructure for environments where reliability, control and failure matter.",
};

export default function CriticalSystemsPage() {
  return (
    <CapabilityStub
      eyebrow="Infrastructure"
      title="Critical Systems"
      blurb="AI infrastructure for environments where reliability, control and failure matter."
      backHref="/"
      backLabel="Back to home"
    />
  );
}
