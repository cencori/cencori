"use client";

import { useMarketingPath } from "@/components/marketing/useMarketingPath";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { DevelopersFooterGlow } from "@/components/developers/DevelopersFooterGlow";

export function MarketingFooter() {
  const pathname = useMarketingPath();
  const isDevelopers =
    pathname?.startsWith("/developers") ||
    pathname === "/ai-gateway" ||
    pathname === "/ai-gateway/models";

  return <SiteFooter bottomGlow={isDevelopers ? <DevelopersFooterGlow /> : undefined} />;
}
