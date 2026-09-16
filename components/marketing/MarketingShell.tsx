"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingNav } from "@/components/nav/MarketingNav";

export function MarketingShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isDevelopers =
    pathname === "/developers" || pathname?.startsWith("/developers/");

  return (
    <div
      className={`${
        isDevelopers
          ? "developers-theme [--border:#4a4a4a]"
          : "marketing-theme [--border:#b8b8b8] dark:[--border:#4a4a4a]"
      } flex min-h-screen flex-col bg-background text-foreground`}
    >
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
