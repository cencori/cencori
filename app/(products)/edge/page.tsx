"use client";

import React, { useState, useEffect } from 'react';
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { supabase } from "@/lib/supabaseClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Code2, ChevronRight, CheckCircle } from 'lucide-react';
import Navbar from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Logo } from "@/components/logo";
import { VercelLogo, SupabaseLogo, VSCodeLogo, CursorLogo } from "@/components/icons/BrandIcons";

export default function ProductEdgePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userProfile, setUserProfile] = useState<{ name: string | null; avatar: string | null }>({ name: null, avatar: null });

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
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
    { text: "Get Started", href: siteConfig.links.getStartedUrl, isButton: true, variant: "default" },
  ];

  const authenticatedActions = [
    { text: "Dashboard", href: "/dashboard/organizations", isButton: true, variant: "default" },
    { text: userProfile.name || "User", href: "#", isButton: false, isAvatar: true, avatarSrc: userProfile.avatar, avatarFallback: (userProfile.name || "U").slice(0, 2).toUpperCase() },
  ];

  const features = [
    {
      icon: VercelLogo,
      title: "Vercel Integration",
      description: "One-click install from Vercel marketplace. Adds Cencori request protection to all edge deployments with preview checks.",
    },
    {
      icon: SupabaseLogo,
      title: "Supabase Extension",
      description: "Route Supabase edge functions through Cencori for enhanced security and real-time request filtering.",
    },
    {
      icon: Code2,
      title: "IDE Plugins",
      description: "Pre-deploy security checks directly in Cursor and VSCode. Catch issues before they reach production.",
    },
  ];


  const capabilities = [
    "One-click marketplace installation",
    "Zero-config edge middleware",
    "Automatic request/response filtering",
    "Preview deploy protection",
    "Real-time security feedback",
    "Integration manifests for platforms",
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar
        logo={<Logo variant="mark" className="h-4" />}
        name="cencori"
        homeUrl="/"
        actions={isAuthenticated ? authenticatedActions : unauthenticatedActions}
        isAuthenticated={isAuthenticated}
        userProfile={isAuthenticated ? userProfile : undefined}
      />

      <main>
        {/* Hero Section */}
        <section className="pt-32 pb-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="outline" className="mb-4 text-xs font-medium px-3 py-1 rounded-full border-border/60">
              Platform Integrations
            </Badge>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Cencori Edge
            </h1>
            <p className="text-base text-muted-foreground max-w-2xl mx-auto mb-8">
              Pre-built integrations and middleware for Vercel, Supabase, and edge runtimes.
              Activate AI protection without extensive engineering effort.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button asChild className="h-9 px-4 text-sm rounded-full">
                <Link href={siteConfig.links.getStartedUrl}>
                  Get Started
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild className="h-9 px-4 text-sm rounded-full">
                <Link href="/docs/integrations">
                  View Docs
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-16 px-4 border-t border-border/40">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-xl font-semibold mb-2">Key Integrations</h2>
              <p className="text-sm text-muted-foreground">
                Deploy Cencori protection across your entire stack
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="group p-6 rounded-lg border border-border/40 bg-card hover:border-border/60 transition-colors"
                >
                  <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center mb-4">
                    <feature.icon className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                  <h3 className="text-sm font-semibold mb-2">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Capabilities */}
        <section className="py-16 px-4 border-t border-border/40 bg-muted/20">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-xl font-semibold mb-2">Built for Platforms</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Edge is designed for platform marketplaces and developer product teams
                  who want to offer robust AI security to their users with minimal friction.
                </p>
                <Button variant="outline" asChild className="h-8 px-3 text-xs rounded-full">
                  <Link href="/contact">
                    Contact Sales
                  </Link>
                </Button>
              </div>
              <div className="space-y-3">
                {capabilities.map((capability, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">{capability}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 px-4 border-t border-border/40">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-xl font-semibold mb-2">
              Ready to integrate?
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Start protecting your platform&apos;s AI requests in minutes.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button asChild className="h-9 px-4 text-sm rounded-full">
                <Link href={siteConfig.links.getStartedUrl}>
                  Get Started Free
                </Link>
              </Button>
              <Button variant="ghost" asChild className="h-9 px-4 text-sm rounded-full">
                <Link href="mailto:support@fohnai.com">
                  Talk to Us
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
