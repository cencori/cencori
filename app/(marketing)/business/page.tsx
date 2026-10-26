import type { Metadata } from "next";
import { BusinessLanding } from "@/components/business/BusinessLanding";

const description = "An AI agent that answers your customers on WhatsApp and your website, takes bookings and orders, and collects payments. From ₦15,000 a month.";

export const metadata: Metadata = {
  title: "Cencori for Business | Your customers, answered on WhatsApp",
  description,
  alternates: { canonical: "https://business.cencori.com" },
  openGraph: {
    title: "Cencori for Business",
    description,
    url: "https://business.cencori.com",
    siteName: "Cencori",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Cencori for Business", description },
};

export default function BusinessPage() {
  return <BusinessLanding />;
}
