"use client";

import { SiteNav } from "@/components/nav/SiteNav";
import { Hero } from "@/components/landing/Hero";
import { SocialProof } from "@/components/landing/SocialProof";
import { GatewayWedge } from "@/components/landing/GatewayWedge";
import { LatestPosts } from "@/components/landing/LatestPosts";
import { BottomCTA } from "@/components/landing/BottomCTA";
import { SiteFooter } from "@/components/marketing/SiteFooter";

export function LandingPage() {
  return (
    <div className="marketing-theme min-h-screen bg-background text-foreground selection:bg-foreground selection:text-background [--border:#b8b8b8] dark:[--border:#4a4a4a]">
      <SiteNav solid />

      <main>
        <Hero />
        <SocialProof />
        <GatewayWedge />
        <LatestPosts />
        <BottomCTA />
      </main>

      <SiteFooter />
    </div>
  );
}
