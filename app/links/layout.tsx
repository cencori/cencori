import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { absolute: "Links | Cencori" },
  description: "The computing infrastructure AI runs on. Everything Cencori, in one place.",
  alternates: { canonical: "https://links.cencori.com" },
  openGraph: {
    title: "Links | Cencori",
    description: "The computing infrastructure AI runs on. Everything Cencori, in one place.",
    url: "https://links.cencori.com",
    siteName: "Cencori",
    images: ["/og-v2.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function LinksLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
