"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { DevelopersFooterGlow } from "@/components/developers/DevelopersFooterGlow";

export function MarketingFooter() {
  const pathname = usePathname();
  const isDevelopers =
    pathname?.startsWith("/developers") ||
    pathname === "/ai-gateway" ||
    pathname === "/ai-gateway/models";

  return <SiteFooter bottomGlow={isDevelopers ? <DevelopersFooterGlow /> : undefined} />;
}
