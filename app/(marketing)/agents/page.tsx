import type { Metadata } from "next";
import { CapabilityStub } from "@/components/marketing/CapabilityStub";

export const metadata: Metadata = {
  title: "Agents — Build anywhere. Run agents on Cencori",
  description:
    "Cencori agent infrastructure: runtime, deployment, persistent agents, scheduled runs, tools, state, approvals, and traces.",
};

export default function AgentsPage() {
  return (
    <CapabilityStub
      eyebrow="Infrastructure"
      title="Agents"
      blurb="Build anywhere. Run agents on Cencori."
      backHref="/"
      backLabel="Back to home"
    />
  );
}
