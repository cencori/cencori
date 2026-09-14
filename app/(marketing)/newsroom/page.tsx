import type { Metadata } from "next";
import { CapabilityStub } from "@/components/marketing/CapabilityStub";

export const metadata: Metadata = {
  title: "Newsroom | Cencori",
  description: "Announcements and company news from Cencori.",
};

export default function NewsroomPage() {
  return (
    <CapabilityStub
      eyebrow="Company"
      title="Newsroom"
      blurb="Announcements and company news from Cencori."
      backHref="/about"
      backLabel="About Cencori"
    />
  );
}
