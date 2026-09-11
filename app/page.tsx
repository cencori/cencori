import type { Metadata } from "next";
import { CencoriFuturePage } from "@/components/future/CencoriFuturePage";

export const metadata: Metadata = {
  title: "Cencori — The computing infrastructure AI runs on",
  description:
    "Cencori is a deep technology company building the infrastructure AI runs on.",
  alternates: {
    canonical: "https://cencori.com",
  },
  openGraph: {
    title: "Cencori — The computing infrastructure AI runs on",
    description:
      "Cencori is a deep technology company building the infrastructure AI runs on.",
    url: "https://cencori.com",
    siteName: "Cencori",
    images: [
      {
        url: "/brand/cencori-hero.jpg",
        width: 1672,
        height: 941,
        alt: "Cencori — The computing infrastructure AI runs on.",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cencori — The computing infrastructure AI runs on",
    description:
      "Cencori is a deep technology company building the infrastructure AI runs on.",
    images: ["/brand/cencori-hero.jpg"],
  },
};

export default function RootPage() {
  return <CencoriFuturePage />;
}
