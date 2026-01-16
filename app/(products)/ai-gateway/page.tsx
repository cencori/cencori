"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  ShieldCheckIcon,
  EyeIcon,
  CodeBracketIcon,
  DocumentCheckIcon,
  ChevronRightIcon,
  Square3Stack3DIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import {
  OpenAI,
  Anthropic,
  Google,
  Meta,
  Mistral,
  DeepSeek,
  Groq,
  Cohere,
  Perplexity,
  XAI,
} from "@lobehub/icons";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";

import Navbar from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

// The 5 core pillars of AI Gateway
const pillars = [
  {
    id: "routing",
    title: "Multi-Provider Routing",
    tagline: "14+ providers, one API",
    description: "Route requests to OpenAI, Anthropic, Google, Mistral, Meta, and more through a single unified API.",
    icon: Square3Stack3DIcon,
    color: "emerald",
    features: ["OpenAI-compatible API", "Automatic fallback", "Model equivalence mapping"],
  },
  {
    id: "security",
    title: "AI Security",
    tagline: "Production-grade protection",
    description: "Real-time protection against prompt injection, PII leakage, and harmful content.",
    icon: ShieldCheckIcon,
    color: "blue",
    features: ["Prompt injection detection", "PII scanning", "Content filtering"],
  },
  {
    id: "observability",
    title: "Full Observability",
    tagline: "See everything",
    description: "Complete visibility into every AI request. Logs, analytics, latency, and cost tracking.",
    icon: EyeIcon,
    color: "purple",
    features: ["Request/response logging", "P50/P90/P99 latency", "Cost per request"],
  },
  {
    id: "devplatform",
    title: "Developer Platform",
    tagline: "Ship faster",
    description: "TypeScript and Python SDKs, Vercel AI SDK integration, API key management.",
    icon: CodeBracketIcon,
    color: "orange",
    features: ["TypeScript & Python SDKs", "Vercel AI SDK provider", "Rate limiting"],
  },
  {
    id: "compliance",
    title: "Compliance Ready",
    tagline: "Enterprise-grade audit",
    description: "Full audit trail, security incident logging, and data governance policies.",
    icon: DocumentCheckIcon,
    color: "cyan",
    features: ["Audit logs", "Security incidents", "Policy enforcement"],
  },
];

// Supported providers
const providers = [
  { name: "OpenAI", icon: OpenAI },
  { name: "Anthropic", icon: Anthropic },
  { name: "Google", icon: Google },
  { name: "Meta", icon: Meta },
  { name: "Mistral", icon: Mistral },
  { name: "DeepSeek", icon: DeepSeek },
  { name: "Groq", icon: Groq },
  { name: "Cohere", icon: Cohere },
  { name: "Perplexity", icon: Perplexity },
  { name: "xAI", icon: XAI },
];

const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-500" },
  blue: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-500" },
  purple: { bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-500" },
  orange: { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-500" },
  cyan: { bg: "bg-cyan-500/10", border: "border-cyan-500/30", text: "text-cyan-500" },
};

export default function AIGatewayPage() {
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
        <section className="relative flex flex-col items-center justify-center overflow-hidden bg-background pt-32 pb-20">
          {/* Background Effects */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-foreground/5 via-background to-background pointer-events-none" />

          <div className="container relative z-10 px-4 md:px-6 flex flex-col items-center text-center">
            {/* Badge */}
            <div className="mb-8 animate-appear">
              <Link href="/" className="inline-flex items-center rounded-full border border-foreground/10 bg-foreground/5 px-3 py-1 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
                <span className="mr-2">Try AI Gateway</span>
                <ChevronRightIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </Link>
            </div>

            {/* Headline */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter mb-6 max-w-4xl animate-appear [animation-delay:100ms] text-transparent bg-clip-text bg-gradient-to-b from-foreground to-foreground/50">
              AI Gateway
            </h1>

            {/* Subheadline */}
            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mb-6 animate-appear [animation-delay:200ms] leading-relaxed">
              One API for every AI provider. Built-in security, observability, and compliance.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 animate-appear [animation-delay:300ms]">
              <Link href={siteConfig.links.getStartedUrl}>
                <Button size="default" className="h-10 px-6 text-sm rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] dark:shadow-[0_0_20px_-5px_rgba(255,255,255,0.1)]">
                  Get Started Free <ArrowRightIcon className="ml-2 h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
              <Link href="/docs">
                <Button variant="outline" size="default" className="h-10 px-6 text-sm rounded-full border-foreground/20 hover:bg-foreground/5 hover:border-foreground/40 transition-all">
                  Documentation
                </Button>
              </Link>
            </div>

            {/* Provider icons */}
            <div className="mt-12 animate-appear [animation-delay:400ms]">
              <p className="text-[10px] text-muted-foreground mb-3 uppercase tracking-wider">Supported Providers</p>
              <div className="flex flex-wrap justify-center gap-4">
                {providers.map((provider) => (
                  <div key={provider.name} className="opacity-50 hover:opacity-100 transition-opacity">
                    <provider.icon className="w-6 h-6" aria-hidden="true" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 5 Pillars Section */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4 md:px-6">
            <div className="flex flex-col items-center text-center mb-12">
              <h2 className="text-2xl md:text-4xl font-bold tracking-tighter mb-4 text-foreground">
                Everything in <span className="text-muted-foreground">one gateway</span>
              </h2>
              <p className="text-base text-muted-foreground max-w-xl">
                AI Gateway combines five essential capabilities into one unified solution.
              </p>
            </div>

            {/* Pillar Cards - Bento Style */}
            <div className="relative max-w-5xl mx-auto">
              {/* Outer border with + corner markers */}
              <div className="relative border border-border/40 bg-background">
                {/* Corner markers */}
                <div className="absolute -top-[7px] -left-[7px] w-[14px] h-[14px] flex items-center justify-center text-muted-foreground/50 text-xs z-10">+</div>
                <div className="absolute -top-[7px] -right-[7px] w-[14px] h-[14px] flex items-center justify-center text-muted-foreground/50 text-xs z-10">+</div>
                <div className="absolute -bottom-[7px] -left-[7px] w-[14px] h-[14px] flex items-center justify-center text-muted-foreground/50 text-xs z-10">+</div>
                <div className="absolute -bottom-[7px] -right-[7px] w-[14px] h-[14px] flex items-center justify-center text-muted-foreground/50 text-xs z-10">+</div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {pillars.map((pillar, index) => {
                    const colors = colorClasses[pillar.color];
                    const isLastRow = index >= 3;
                    const isRightEdge = (index + 1) % 3 === 0 || index === pillars.length - 1;
                    return (
                      <div
                        key={pillar.id}
                        className={cn(
                          "group relative flex flex-col p-6 transition-colors duration-300 hover:bg-foreground/[0.02]",
                          !isLastRow && "border-b border-border/40",
                          !isRightEdge && "lg:border-r border-border/40",
                          "md:border-r md:border-b border-border/40",
                          "md:[&:nth-child(2n)]:border-r-0",
                          "lg:[&:nth-child(2n)]:border-r",
                          "lg:[&:nth-child(3n)]:border-r-0",
                          pillar.id === "routing" && "lg:col-span-2"
                        )}
                      >
                        {/* Icon */}
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-4", colors.bg, colors.border, "border")}>
                          <pillar.icon className={cn("h-4 w-4", colors.text)} aria-hidden="true" />
                        </div>

                        {/* Content */}
                        <h3 className="text-base font-semibold tracking-tight mb-1">{pillar.title}</h3>
                        <p className={cn("text-xs font-medium mb-2", colors.text)}>{pillar.tagline}</p>
                        <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                          {pillar.description}
                        </p>

                        {/* Feature list */}
                        <ul className="mt-auto space-y-1.5">
                          {pillar.features.map((feature, i) => (
                            <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                              <CheckCircleIcon className={cn("w-3 h-3", colors.text)} aria-hidden="true" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Code Example Section */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid lg:grid-cols-2 gap-8 items-center max-w-5xl mx-auto">
              <div>
                <h2 className="text-2xl md:text-4xl font-bold tracking-tighter mb-4 text-foreground">
                  Integrate in <span className="text-muted-foreground">3 lines</span>
                </h2>
                <p className="text-base text-muted-foreground mb-6 leading-relaxed">
                  Drop-in replacement for your existing OpenAI calls. Switch providers with one parameter.
                </p>

                <div className="space-y-3">
                  {["Install the SDK", "Add your API key", "Start making requests"].map((step, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <span className="text-xs font-medium text-emerald-500">{i + 1}</span>
                      </div>
                      <span className="text-sm">{step}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <Link href="/docs/quickstart">
                    <Button variant="outline" size="sm" className="h-8 px-4 text-xs rounded-full">
                      Read the Quickstart <ArrowRightIcon className="ml-2 w-3 h-3" aria-hidden="true" />
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="relative">
                <div className="border border-border/40 bg-muted/20 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40 bg-muted/30">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                    <span className="ml-2 text-[10px] text-muted-foreground">cencori.ts</span>
                  </div>
                  <pre className="p-4 text-xs font-mono overflow-x-auto">
                    <code className="text-muted-foreground font-mono">
                      <span className="text-blue-400">import</span> {"{"} Cencori {"}"} <span className="text-blue-400">from</span> <span className="text-emerald-400">&apos;cencori&apos;</span>;{"\n\n"}
                      <span className="text-blue-400">const</span> cencori = <span className="text-blue-400">new</span> <span className="text-yellow-400">Cencori</span>({"{"}{"\n"}
                      {"  "}apiKey: process.env.<span className="text-orange-400">CENCORI_API_KEY</span>{"\n"}
                      {"}"});{"\n\n"}
                      <span className="text-blue-400">const</span> response = <span className="text-blue-400">await</span> cencori.ai.<span className="text-yellow-400">chat</span>({"{"}{"\n"}
                      {"  "}model: <span className="text-emerald-400">&apos;gpt-4o&apos;</span>,{"\n"}
                      {"  "}messages: [{"{"} role: <span className="text-emerald-400">&apos;user&apos;</span>, content: <span className="text-emerald-400">&apos;Hello!&apos;</span> {"}"}]{"\n"}
                      {"}"});
                    </code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-16 bg-background">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
              {[
                { value: "14+", label: "AI Providers" },
                { value: "<50ms", label: "Added Latency" },
                { value: "99.9%", label: "Uptime SLA" },
                { value: "100+", label: "Models Available" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl md:text-3xl font-bold tracking-tighter mb-1">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-background relative overflow-hidden">
          <div className="max-w-screen-xl mx-auto px-4 md:px-6 relative z-10">
            <div className="relative overflow-hidden rounded-xl border border-border/30 bg-foreground/[0.02] px-6 py-12 md:px-10 text-center">
              {/* Background Effects */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-foreground/5 via-transparent to-transparent opacity-50" />
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:20px_20px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

              <div className="relative z-10 flex flex-col items-center max-w-2xl mx-auto">
                <div className="mb-4 inline-flex items-center justify-center rounded-full border border-border/40 bg-muted/30 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  <span>Free tier available</span>
                </div>

                <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3 text-foreground">
                  Ready to ship AI?
                </h2>
                <p className="text-sm text-muted-foreground mb-6 max-w-lg leading-relaxed">
                  Get started with AI Gateway in minutes. No credit card required.
                </p>

                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <Link href={siteConfig.links.getStartedUrl}>
                    <Button size="sm" className="h-8 px-4 text-xs rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all">
                      Get Started Free
                      <ArrowRightIcon className="ml-1.5 w-3 h-3" aria-hidden="true" />
                    </Button>
                  </Link>
                  <Link href="/pricing">
                    <Button variant="ghost" size="sm" className="h-8 px-4 text-xs rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
                      View Pricing
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
