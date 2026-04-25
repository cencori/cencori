"use client";

import Navbar from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { SocialProof } from "@/components/landing/SocialProof";
import { Features } from "@/components/landing/Features";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";
import { HowToSetup } from "@/components/landing/HowToSetup";
import { ErasSection } from "@/components/landing/ErasSection";
import { FullStack } from "@/components/landing/FullStack";
import { Logo } from "@/components/logo";
import { siteConfig } from "@/config/site";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function HomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userProfile, setUserProfile] = useState<{ name: string | null; avatar: string | null }>({ name: null, avatar: null });

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setIsAuthenticated(true);
        const user = session.user;
        const meta = user.user_metadata ?? {};
        const avatar = meta.avatar_url ?? meta.picture ?? null;
        const name = meta.name ?? user.email?.split("@")[0] ?? null;
        setUserProfile({ name: name as string | null, avatar: avatar as string | null });
      } else {
        setIsAuthenticated(false);
        setUserProfile({ name: null, avatar: null });
      }
    };
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event: string, session: { user: { user_metadata?: Record<string, unknown>; email?: string } } | null) => {
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
        homeUrl="/"
        actions={isAuthenticated ? authenticatedActions : unauthenticatedActions}
        isAuthenticated={isAuthenticated}
        userProfile={isAuthenticated ? userProfile : undefined}
      />

      <main>
        <Hero isAuthenticated={isAuthenticated} />
        <SocialProof />
        <Features />
        <FullStack />
        <HowToSetup />
        <ErasSection />
        <CTA isAuthenticated={isAuthenticated} />
      </main>

      {/* Closing Statement */}
      <section className="py-20 sm:py-28 bg-background">
        <div className="max-w-3xl mx-auto px-4 md:px-6 text-center">
          <p className="font-serif italic text-lg sm:text-xl text-muted-foreground leading-relaxed">
            Ship models and applications from the same platform. Deploy fine-tuned models to auto-scaling inference endpoints, and host your complete AI application on a global edge network — no external infrastructure required.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
