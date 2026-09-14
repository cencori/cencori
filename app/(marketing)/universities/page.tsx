import type { Metadata } from "next";
import { CapabilityStub } from "@/components/marketing/CapabilityStub";

export const metadata: Metadata = {
  title: "Research & Universities — Computing infrastructure for research",
  description:
    "Computing infrastructure for research, experimentation and education.",
};

export default function UniversitiesPage() {
  return (
    <CapabilityStub
      eyebrow="Infrastructure"
      title="Research & Universities"
      blurb="Computing infrastructure for research, experimentation and education."
      backHref="/"
      backLabel="Back to home"
    />
  );
}
