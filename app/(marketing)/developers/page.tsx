import type { Metadata } from "next";
import { DevelopersHero } from "@/components/developers/DevelopersHero";
import { DevelopersProducts } from "@/components/developers/DevelopersProducts";
import { DevelopersBuild } from "@/components/developers/DevelopersBuild";
import { DevelopersBlog } from "@/components/developers/DevelopersBlog";
import { DevelopersFaq } from "@/components/developers/DevelopersFaq";
import { DevelopersCTA } from "@/components/developers/DevelopersCTA";

const developersOgImage = "/og/developers?v=2";

export const metadata: Metadata = {
  title: "Cencori for Developers | Build and run AI",
  description:
    "One API for every frontier model, infrastructure to train and deploy your own, and observability to run it all in production.",
  alternates: {
    canonical: "https://developers.cencori.com",
  },
  openGraph: {
    title: "Cencori for Developers",
    description:
      "One API for every frontier model, infrastructure to train and deploy your own, and observability to run it all in production.",
    url: "https://developers.cencori.com",
    siteName: "Cencori",
    type: "website",
    images: [
      {
        url: developersOgImage,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cencori for Developers",
    description:
      "One API for every frontier model, infrastructure to train and deploy your own, and observability to run it all in production.",
    images: [developersOgImage],
  },
};

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
