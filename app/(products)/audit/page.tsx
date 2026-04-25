"use client";

import React, { useState, useEffect } from 'react';
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { CTA } from "@/components/landing/CTA";

export default function ProductAuditPage() {
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
      title: "Append-only logs",
      description: "Ensures data integrity and provides a clear, immutable record of all AI interactions with trace IDs.",
    },
    {
      title: "Compliance exports",
      description: "Generate CSV/PDF documentation and incident reports for regulatory compliance analysis.",
    },
    {
      title: "Retention & redaction",
      description: "Customize data retention periods and apply redaction rules based on organizational policies.",
    },
    {
      title: "Role-based access",
      description: "Securely control who can access and review audit logs with granular permissions for auditors.",
    },
    {
      title: "Built into Protect",
      description: "Seamlessly integrates with Cencori's AI protection features out of the box.",
    },
    {
      title: "Dashboard & API exports",
      description: "Access and manage audit logs directly through the Cencori dashboard or via dedicated APIs.",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar
        homeUrl="/"
        actions={isAuthenticated ? authenticatedActions : unauthenticatedActions}
        isAuthenticated={isAuthenticated}
        userProfile={isAuthenticated ? userProfile : undefined}
      />

      <main>
        {/* Hero Section */}
        <section className="relative flex flex-col items-center justify-center overflow-hidden bg-background pt-32 pb-20">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-500/5 via-background to-background pointer-events-none" />

          <div className="container relative z-10 px-4 md:px-6 flex flex-col items-center text-center">
            {/* Badge */}
            <div className="mb-8 animate-appear">
              <div className="group inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground transition-colors hover:text-foreground">
                <span>Immutable Logs & Compliance</span>
              </div>
            </div>

            {/* Headline */}
            <h1 className="mb-8 max-w-3xl text-[3rem] font-heading font-black leading-[0.95] tracking-[-0.02em] animate-appear sm:text-[4.5rem] lg:text-[5.5rem] text-foreground">
              <span className="font-serif italic font-normal text-muted-foreground">Audit.</span>
            </h1>

            {/* Subheadline */}
            <p className="mb-10 max-w-[38rem] text-base leading-[1.7] text-muted-foreground animate-appear [animation-delay:200ms]">
              Append-only audit trail of every AI interaction within your infrastructure. Built for compliance and incident reporting.
            </p>

            {/* CTAs */}
            <div className="mb-10 flex flex-wrap items-center justify-center gap-3 animate-appear [animation-delay:300ms]">
              <Link href={siteConfig.links.getStartedUrl}>
                <Button size="default" className="h-8 px-4 text-xs font-medium rounded-md bg-foreground text-background hover:bg-foreground/90 transition-all">
                  Get Started
                </Button>
              </Link>
              <Link href="mailto:support@fohnai.com">
                <Button variant="outline" size="default" className="h-8 px-4 text-xs font-medium rounded-md border-foreground/20 hover:bg-foreground/5 hover:border-foreground/40 transition-all">
                  Contact Sales
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* What it does / Who uses it */}
        <section className="py-16 px-4 border-t border-border/40 bg-muted/20">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div>
                <h2 className="text-xl font-semibold mb-4">What it Does</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Cencori&apos;s Audit feature provides an append-only audit trail of every AI interaction within your infrastructure. It stores discovery metadata and the full decision lineage for each interaction, offering robust filtering, customizable retention policies, and comprehensive export capabilities.
                </p>
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-4">Who Uses It</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Audit is essential for regulated industries and enterprise security teams that require a verifiable and comprehensive record of AI activities for compliance and risk management.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features List */}
        <section className="py-24 sm:py-32 border-t border-border/40">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <h2 className="text-3xl sm:text-[2.75rem] font-heading font-black tracking-[-0.03em] leading-[1.1] mb-20 max-w-2xl text-foreground">
              Key Features
            </h2>

            <div className="space-y-0">
              {features.map((item, i) => (
                <div key={item.title} className="group grid grid-cols-1 sm:grid-cols-12 gap-4 sm:gap-8 py-8 sm:py-10 cursor-default border-t border-border/40 first:border-t-0">
                  <div className="sm:col-span-1 text-sm text-muted-foreground/40 tabular-nums font-mono">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 className="sm:col-span-4 text-base font-medium group-hover:text-emerald-500 transition-colors duration-300">
                    {item.title}
                  </h3>
                  <p className="sm:col-span-7 text-sm text-muted-foreground leading-[1.7]">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <CTA isAuthenticated={isAuthenticated} />
      </main>

      <Footer />
    </div>
  );
}
