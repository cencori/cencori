import { Metadata } from "next";
import { AboutAfrica } from "@/components/about/AboutAfrica";
import { AboutHero } from "@/components/about/AboutHero";
import { AboutMission } from "@/components/about/AboutMission";
import { AboutTeam } from "@/components/about/AboutTeam";

export const metadata: Metadata = {
  title: "About | Cencori",
  description:
    "Cencori is a deep technology company building the infrastructure AI runs on.",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-[#f4f4ef]">
      <AboutHero />
      <AboutMission />
      <AboutAfrica />
      <AboutTeam />
    </main>
  );
}
