"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
    ArrowRightIcon,
    CpuChipIcon,
    ServerStackIcon,
    GlobeAltIcon,
    BoltIcon,
    ChevronRightIcon,
    CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";

import Navbar from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

// The 4 core pillars of Compute
const pillars = [
    {
        id: "serverless",
        title: "Serverless Functions",
        tagline: "Zero infrastructure",
        description: "Deploy AI functions without managing servers. Auto-scaling, pay-per-use compute for any workload.",
        icon: BoltIcon,
        color: "violet",
        features: ["Auto-scaling", "Pay-per-invocation", "Sub-100ms cold starts"],
    },
    {
        id: "gpu",
        title: "GPU Access",
        tagline: "On-demand acceleration",
        description: "Access NVIDIA GPUs for training, fine-tuning, and high-performance inference on demand.",
        icon: CpuChipIcon,
        color: "emerald",
        features: ["NVIDIA A100/H100", "Spot & reserved pricing", "Multi-GPU clusters"],
    },
    {
        id: "edge",
        title: "Edge Deployment",
        tagline: "Global performance",
        description: "Run AI inference at the edge, close to your users, for ultra-low latency responses.",
        icon: GlobeAltIcon,
        color: "blue",
        features: ["200+ edge locations", "Sub-50ms latency", "Automatic routing"],
    },
    {
        id: "agents",
        title: "Agent Deployments",
        tagline: "Autonomous AI",
        description: "Deploy and manage AI agents with built-in orchestration, memory, and tool access.",
        icon: ServerStackIcon,
        color: "orange",
        features: ["Persistent agents", "Tool integration", "Memory management"],
    },
];

const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
    violet: { bg: "bg-violet-500/10", border: "border-violet-500/30", text: "text-violet-500" },
    emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-500" },
    blue: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-500" },
    orange: { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-500" },
};

export default function ComputePage() {
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
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-violet-500/5 via-background to-background pointer-events-none" />

                    <div className="container relative z-10 px-4 md:px-6 flex flex-col items-center text-center">
                        {/* Badge */}
                        <div className="mb-8 animate-appear">
                            <div className="inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-sm font-medium text-violet-400">
                                <span className="flex h-2 w-2 rounded-full bg-violet-500 mr-2" />
                                <span>Coming Soon</span>
                            </div>
                        </div>

                        {/* Headline */}
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter mb-6 max-w-4xl animate-appear [animation-delay:100ms] text-transparent bg-clip-text bg-gradient-to-b from-foreground to-foreground/50">
                            Compute
                        </h1>

                        {/* Subheadline */}
                        <p className="text-lg md:text-xl text-muted-foreground max-w-xl mb-6 animate-appear [animation-delay:200ms] leading-relaxed">
                            Serverless AI infrastructure. GPUs on demand. Deploy anywhere.
                        </p>

                        {/* CTAs */}
                        <div className="flex flex-col sm:flex-row gap-3 animate-appear [animation-delay:300ms]">
                            <Link href="/signup">
                                <Button size="default" className="h-10 px-6 text-sm rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] dark:shadow-[0_0_20px_-5px_rgba(255,255,255,0.1)]">
                                    Join the Waitlist <ArrowRightIcon className="ml-2 h-4 w-4" aria-hidden="true" />
                                </Button>
                            </Link>
                            <Link href="/docs">
                                <Button variant="outline" size="default" className="h-10 px-6 text-sm rounded-full border-foreground/20 hover:bg-foreground/5 hover:border-foreground/40 transition-all">
                                    Learn More
                                </Button>
                            </Link>
                        </div>
                    </div>
                </section>

                {/* 4 Pillars Section */}
                <section className="py-20 bg-background">
                    <div className="container mx-auto px-4 md:px-6">
                        <div className="flex flex-col items-center text-center mb-12">
                            <h2 className="text-2xl md:text-4xl font-bold tracking-tighter mb-4 text-foreground">
                                AI infrastructure <span className="text-muted-foreground">without limits</span>
                            </h2>
                            <p className="text-base text-muted-foreground max-w-xl">
                                From serverless functions to GPU clusters, Compute handles your AI workloads.
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
                                <div className="grid grid-cols-1 md:grid-cols-2">
                                    {pillars.map((pillar, index) => {
                                        const colors = colorClasses[pillar.color];
                                        const isLastRow = index >= 2;
                                        const isRightEdge = (index + 1) % 2 === 0;
                                        return (
                                            <div
                                                key={pillar.id}
                                                className={cn(
                                                    "group relative flex flex-col p-6 transition-colors duration-300 hover:bg-foreground/[0.02]",
                                                    !isLastRow && "border-b border-border/40",
                                                    !isRightEdge && "md:border-r border-border/40"
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

                {/* Stats Section */}
                <section className="py-16 bg-background">
                    <div className="container mx-auto px-4 md:px-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
                            {[
                                { value: "<100ms", label: "Cold Start" },
                                { value: "200+", label: "Edge Locations" },
                                { value: "A100/H100", label: "GPU Options" },
                                { value: "99.9%", label: "Uptime SLA" },
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
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-violet-500/5 via-transparent to-transparent opacity-50" />
                            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:20px_20px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

                            <div className="relative z-10 flex flex-col items-center max-w-2xl mx-auto">
                                <div className="mb-4 inline-flex items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-medium text-violet-400 uppercase tracking-wider">
                                    <span>Q3 2026</span>
                                </div>

                                <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3 text-foreground">
                                    Be first to Compute
                                </h2>
                                <p className="text-sm text-muted-foreground mb-6 max-w-lg leading-relaxed">
                                    Join the waitlist for early access to serverless AI infrastructure.
                                </p>

                                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                                    <Link href="/signup">
                                        <Button size="sm" className="h-8 px-4 text-xs rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all">
                                            Join Waitlist
                                            <ArrowRightIcon className="ml-1.5 w-3 h-3" aria-hidden="true" />
                                        </Button>
                                    </Link>
                                    <Link href="/ai-gateway">
                                        <Button variant="ghost" size="sm" className="h-8 px-4 text-xs rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
                                            Try AI Gateway Now
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
