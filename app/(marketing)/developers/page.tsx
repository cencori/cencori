import { DevelopersHero } from "@/components/developers/DevelopersHero";
import { DevelopersProducts } from "@/components/developers/DevelopersProducts";
import { DevelopersBuild } from "@/components/developers/DevelopersBuild";
import { DevelopersBlog } from "@/components/developers/DevelopersBlog";
import { DevelopersFaq } from "@/components/developers/DevelopersFaq";
import { DevelopersCTA } from "@/components/developers/DevelopersCTA";

export default function DevelopersPage() {
  return (
    <main>
      <DevelopersHero />
      <DevelopersProducts />
      <DevelopersBuild />
      <DevelopersBlog />
      <DevelopersFaq />
      <DevelopersCTA />
    </main>
  );
}
