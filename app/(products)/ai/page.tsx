"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Shield, Zap, Lock, Users, Settings, Globe, ChevronRight, Code, Layers } from "lucide-react";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";

import Navbar from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

const features = [
  {
    title: "Request & Response Interception",
    description: "Transparently intercepts all AI calls via /v1/protect endpoint to apply security and compliance policies in real-time.",
    icon: Shield,
    className: "md:col-span-2 md:row-span-2",
    visual: "bg-emerald-500/10",
  },
  {
    title: "Rule Engine",
    description: "Configurable rules using keywords, regex, patterns, and thresholds to detect and act on sensitive data or policy violations.",
    icon: Settings,
    className: "md:col-span-2 md:row-span-1",
    visual: "bg-blue-500/10",
  },
  {
    title: "Redaction & Sanitization",
    description: "Automatically masks, truncates, or rewrites content to remove sensitive information.",
    icon: Lock,
    className: "md:col-span-1 md:row-span-2",
    visual: "bg-purple-500/10",
  },
  {
    title: "Per-tenant Policies",
    description: "Tailor security and data handling policies to individual organizations or projects.",
    icon: Users,
    className: "md:col-span-1 md:row-span-1",
    visual: "bg-orange-500/10",
  },
  {
    title: "Low Latency Mode",
    description: "Optimized for <50ms added latency in demanding production environments.",
    icon: Zap,
    className: "md:col-span-2 md:row-span-1",
    visual: "bg-yellow-500/10",
  },
  {
    title: "Global Edge Network",
    description: "Deploy protection close to your users for maximum performance worldwide.",
    icon: Globe,
    className: "md:col-span-1 md:row-span-1",
    visual: "bg-cyan-500/10",
  },
];

const integrations = [
  {
    title: "TypeScript SDK",
    description: "Easy integration into your application logic with full type safety.",
    icon: Code,
  },
  {
    title: "Edge Middleware",
    description: "Deploy protection at the edge for minimal latency on Vercel, Cloudflare, and more.",
    icon: Globe,
  },
  {
    title: "Simple Proxy Swap",
    description: "Quick integration by replacing your existing LLM proxy endpoint.",
    icon: Layers,
  },
];

export default function ProductAIPage() {
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
    { text: "Get Started", href: siteConfig.links.getStartedUrl, isButton: true, variant: "default" },
  ];

  const authenticatedActions = [
    { text: "Dashboard", href: "/dashboard/organizations", isButton: true, variant: "default" },
    { text: userProfile.name || "User", href: "#", isButton: false, isAvatar: true, avatarSrc: userProfile.avatar, avatarFallback: (userProfile.name || "U").slice(0, 2).toUpperCase() },
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
        {/* Hero Section */}
        <section className="relative min-h-[80vh] flex flex-col items-center justify-center overflow-hidden bg-background pt-32 pb-24">
          {/* Background Effects */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-500/10 via-background to-background pointer-events-none" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

          <div className="container relative z-10 px-4 md:px-6 flex flex-col items-center text-center">
            {/* Badge */}
            <div className="mb-8 animate-appear">
              <Link href="/docs" className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20">
                <span>AI Gateway</span>
                <ChevronRight className="h-4 w-4 ml-1 text-emerald-400/60" />
              </Link>
            </div>

            {/* Headline */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter mb-8 max-w-5xl animate-appear [animation-delay:100ms] text-transparent bg-clip-text bg-gradient-to-b from-foreground to-foreground/50">
              AI <span className="italic">Gateway</span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mb-12 animate-appear [animation-delay:200ms] leading-relaxed">
              The inline proxy between your applications and LLMs. Inspect, redact, sanitize, or block content in real-time with structured verdicts and full traceability.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 animate-appear [animation-delay:300ms]">
              <Link href={siteConfig.links.getStartedUrl}>
                <Button size="lg" className="h-12 px-8 text-base rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] dark:shadow-[0_0_20px_-5px_rgba(255,255,255,0.1)]">
                  Start Building <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/docs">
                <Button variant="outline" size="lg" className="h-12 px-8 text-base rounded-full border-foreground/20 hover:bg-foreground/5 hover:border-foreground/40 transition-all">
                  View Documentation
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-32 bg-background">
          <div className="container mx-auto px-4 md:px-6">
            <div className="flex flex-col items-center text-center mb-20">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tighter mb-6">
                Everything you need to<br />
                <span className="text-muted-foreground">protect your AI stack</span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl">
                Comprehensive request/response protection and policy enforcement for every AI interaction.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 auto-rows-[200px] gap-6 max-w-7xl mx-auto">
              {features.map((feature, i) => (
                <div
                  key={i}
                  className={cn(
                    "group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-b from-background/80 to-transparent p-8 transition-all duration-300 hover:border-foreground/20",
                    feature.className
                  )}
                >
                  <div className={cn(
                    "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                    "bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-foreground/5 via-transparent to-transparent"
                  )} />

                  <div className="relative z-10 flex flex-col gap-3">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", feature.visual)}>
                      <feature.icon className="h-5 w-5 text-foreground/80" />
                    </div>
                    <h3 className="text-xl font-semibold tracking-tight">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </div>

                  {/* Visual background element */}
                  <div className={cn(
                    "absolute bottom-0 right-0 w-2/3 h-2/3 rounded-tl-[40px] opacity-10 group-hover:opacity-20 transition-opacity",
                    feature.visual
                  )} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Integration Section */}
        <section className="py-32 bg-background border-t border-border/40">
          <div className="container mx-auto px-4 md:px-6">
            <div className="flex flex-col items-center text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tighter mb-6">
                Integrate in <span className="text-muted-foreground">minutes</span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl">
                Multiple integration options to fit your existing workflow and infrastructure.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {integrations.map((integration, i) => (
                <div
                  key={i}
                  className="group relative flex flex-col p-8 rounded-3xl border border-border/40 bg-gradient-to-b from-foreground/5 to-transparent transition-all duration-300 hover:border-foreground/20"
                >
                  <div className="w-12 h-12 rounded-xl bg-foreground/10 flex items-center justify-center mb-6">
                    <integration.icon className="h-6 w-6 text-foreground/80" />
                  </div>
                  <h3 className="text-xl font-semibold tracking-tight mb-3">{integration.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {integration.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Who Uses It Section */}
        <section className="py-32 bg-background border-t border-border/40">
          <div className="container mx-auto px-4 md:px-6">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tighter mb-8">
                Built for <span className="text-muted-foreground">modern teams</span>
              </h2>
              <p className="text-xl text-muted-foreground leading-relaxed mb-12">
                Whether you&apos;re a developer team, AI-first startup, or small to medium business, Cencori AI Gateway helps you secure your AI applications and ensure compliance without sacrificing performance.
              </p>

              <div className="flex flex-wrap justify-center gap-4">
                <div className="px-6 py-3 rounded-full border border-foreground/10 bg-foreground/5 text-sm font-medium">
                  Developer Teams
                </div>
                <div className="px-6 py-3 rounded-full border border-foreground/10 bg-foreground/5 text-sm font-medium">
                  AI-first Startups
                </div>
                <div className="px-6 py-3 rounded-full border border-foreground/10 bg-foreground/5 text-sm font-medium">
                  SMBs
                </div>
                <div className="px-6 py-3 rounded-full border border-foreground/10 bg-foreground/5 text-sm font-medium">
                  Enterprise
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-32 bg-background relative overflow-hidden">
          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <div className="relative overflow-hidden rounded-3xl border border-foreground/10 bg-foreground/5 px-6 py-24 md:px-12 text-center">
              {/* Background Effects */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent opacity-50" />
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

              <div className="relative z-10 flex flex-col items-center max-w-3xl mx-auto">
                <div className="mb-6 inline-flex items-center justify-center rounded-full border border-foreground/10 bg-foreground/5 px-3 py-1 text-sm font-medium text-foreground/80 backdrop-blur-sm">
                  <span>Start protecting today</span>
                </div>

                <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-6 text-transparent bg-clip-text bg-gradient-to-b from-foreground to-foreground/50">
                  Ready to secure your AI?
                </h2>
                <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl leading-relaxed">
                  Get started with Cencori AI Gateway and protect your AI applications in minutes.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                  <Link href={siteConfig.links.getStartedUrl}>
                    <Button size="lg" className="h-14 px-8 text-base rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] w-full sm:w-auto">
                      Get Started for Free
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </Link>
                  <Link href="mailto:support@fohnai.com">
                    <Button variant="outline" size="lg" className="h-14 px-8 text-base rounded-full border-foreground/20 hover:bg-foreground/5 hover:text-foreground transition-all w-full sm:w-auto bg-transparent backdrop-blur-sm">
                      Contact Us
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
