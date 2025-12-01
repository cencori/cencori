"use client";

import Navbar from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { SocialProof } from "@/components/landing/SocialProof";
import { Features } from "@/components/landing/Features";
import { Integrations } from "@/components/landing/Integrations";
import { Pricing } from "@/components/landing/Pricing";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";
import { Logo } from "@/components/logo";
import { siteConfig } from "@/config/site";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function HomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userProfile, setUserProfile] = useState<{ name: string | null; avatar: string | null }>({ name: null, avatar: null });

  useEffect(() => {
    const checkUser = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (data?.session) {
        setIsAuthenticated(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const meta = user.user_metadata ?? {};
          const avatar = meta.avatar_url ?? meta.picture ?? null;
          const name = meta.name ?? user.email?.split("@")[0] ?? null;
          setUserProfile({ name: name as string | null, avatar: avatar as string | null });
        }
      } else {
        setIsAuthenticated(false);
        setUserProfile({ name: null, avatar: null });
      }
    };
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setIsAuthenticated(true);
        const { user } = session;
        if (user) {
          const meta = user.user_metadata ?? {};
          const avatar = meta.avatar_url ?? meta.picture ?? null;
          const name = meta.name ?? user.email?.split("@")[0] ?? null;
          setUserProfile({ name: name as string | null, avatar: avatar as string | null });
        }
      } else {
        setIsAuthenticated(false);
        setUserProfile({ name: null, avatar: null });
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const unauthenticatedActions = [
    { text: "Sign in", href: siteConfig.links.signInUrl, isButton: false },
    {
      text: "Get Started",
      href: siteConfig.links.getStartedUrl,
      isButton: true,
      variant: "default",
    },
  ];

  const authenticatedActions = [
    {
      text: "Dashboard",
      href: "/dashboard/organizations",
      isButton: true,
      variant: "default",
    },
    {
      text: userProfile.name || "User",
      href: "#",
      isButton: false,
      isAvatar: true,
      avatarSrc: userProfile.avatar,
      avatarFallback: (userProfile.name || "U").slice(0, 2).toUpperCase(),
    },
  ];



  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-foreground selection:text-background">
      <Navbar
        logo={<Logo variant="mark" className="h-4" />}
        name="cencori"
        homeUrl="/"
        actions={isAuthenticated ? authenticatedActions : unauthenticatedActions}
        isAuthenticated={isAuthenticated}
        userProfile={isAuthenticated ? userProfile : undefined}
      />

      <main>
        <Hero />
        <Features />
        <Integrations />
        <Pricing />
        <CTA />
      </main>

      <Footer />
    </div>
  );
}