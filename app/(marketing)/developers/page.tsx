import type { Metadata } from "next";
import { DevelopersHero } from "@/components/developers/DevelopersHero";
import { DevelopersProducts } from "@/components/developers/DevelopersProducts";
import { DevelopersBuild } from "@/components/developers/DevelopersBuild";
import { DevelopersBlog } from "@/components/developers/DevelopersBlog";
import { DevelopersFaq } from "@/components/developers/DevelopersFaq";
import { DevelopersCTA } from "@/components/developers/DevelopersCTA";
import { buildOgImageUrl } from "@/lib/og";

const developersOgImage = buildOgImageUrl({
  title: "Cencori for Developers",
  subtitle: "One API for every frontier model",
  type: "docs",
});

export const metadata: Metadata = {
  title: "Cencori for Developers | Build and run AI",
  description:
    "One API for every frontier model, infrastructure to train and deploy your own, and observability to run it all in production.",
  alternates: {
    canonical: "https://cencori.com/developers",
  },
  openGraph: {
    title: "Cencori for Developers",
    description:
      "One API for every frontier model, infrastructure to train and deploy your own, and observability to run it all in production.",
    url: "https://cencori.com/developers",
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
