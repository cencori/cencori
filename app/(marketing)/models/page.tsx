import type { Metadata } from "next";
import { CapabilityStub } from "@/components/marketing/CapabilityStub";

export const metadata: Metadata = {
  title: "Models — Build, train and run models on Cencori",
  description:
    "Cencori model infrastructure: training, fine-tuning, evaluation, registry, hosting, deployment, inference, and private models.",
};

export default function ModelsPage() {
  return (
    <CapabilityStub
      eyebrow="Infrastructure"
      title="Models"
      blurb="Build, train and run models on Cencori."
      backHref="/"
      backLabel="Back to home"
    />
  );
}
