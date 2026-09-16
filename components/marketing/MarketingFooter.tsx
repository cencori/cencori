"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { DevelopersFooterGlow } from "@/components/developers/DevelopersFooterGlow";

export function MarketingFooter() {
  const pathname = usePathname();
  const isDevelopers = pathname?.startsWith("/developers");

  return <SiteFooter bottomGlow={isDevelopers ? <DevelopersFooterGlow /> : undefined} />;
}
