"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
    ArrowRightIcon,
    Squares2X2Icon,
    ArrowsRightLeftIcon,
    ClockIcon,
    UserGroupIcon,
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

// The 4 core pillars of Workflow
const pillars = [
    {
        id: "builder",
        title: "Visual Builder",
        tagline: "n8n for AI",
        description: "Drag-and-drop interface to build complex AI pipelines. No code required for common workflows.",
        icon: Squares2X2Icon,
        color: "pink",
        features: ["Drag-and-drop nodes", "100+ templates", "Real-time preview"],
    },
    {
        id: "orchestration",
        title: "Agent Orchestration",
        tagline: "Multi-agent workflows",
        description: "Coordinate multiple AI agents working together. Chain prompts, tools, and decisions.",
        icon: ArrowsRightLeftIcon,
        color: "emerald",
        features: ["Agent chaining", "Parallel execution", "Conditional branching"],
    },
    {
        id: "triggers",
        title: "Triggers & Webhooks",
        tagline: "Event-driven AI",
        description: "Trigger workflows from webhooks, schedules, or external events. Connect to any system.",
        icon: ClockIcon,
        color: "blue",
        features: ["Cron scheduling", "Webhook endpoints", "Event listeners"],
    },
    {
        id: "human",
        title: "Human-in-the-Loop",
        tagline: "AI + human collaboration",
        description: "Add approval steps, reviews, and human input to your AI workflows when needed.",
        icon: UserGroupIcon,
        color: "orange",
        features: ["Approval gates", "Review queues", "Escalation rules"],
    },
];

const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
    pink: { bg: "bg-pink-500/10", border: "border-pink-500/30", text: "text-pink-500" },
    emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-500" },
    blue: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-500" },
    orange: { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-500" },
};

export default function WorkflowPage() {
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
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-pink-500/5 via-background to-background pointer-events-none" />

                    <div className="container relative z-10 px-4 md:px-6 flex flex-col items-center text-center">
                        {/* Badge */}
                        <div className="mb-8 animate-appear">
                            <div className="inline-flex items-center rounded-full border border-pink-500/30 bg-pink-500/10 px-3 py-1 text-sm font-medium text-pink-400">
                                <span className="flex h-2 w-2 rounded-full bg-pink-500 mr-2" />
                                <span>Coming Soon</span>
                            </div>
                        </div>

                        {/* Headline */}
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter mb-6 max-w-4xl animate-appear [animation-delay:100ms] text-transparent bg-clip-text bg-gradient-to-b from-foreground to-foreground/50">
                            Workflow
                        </h1>

                        {/* Subheadline */}
                        <p className="text-lg md:text-xl text-muted-foreground max-w-xl mb-6 animate-appear [animation-delay:200ms] leading-relaxed">
                            Visual AI pipeline builder. Orchestrate agents. Automate everything.
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
                                Build AI pipelines <span className="text-muted-foreground">visually</span>
                            </h2>
                            <p className="text-base text-muted-foreground max-w-xl">
                                From simple automations to complex multi-agent workflows, all in one canvas.
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
                                { value: "100+", label: "Templates" },
                                { value: "50+", label: "Integrations" },
                                { value: "<1s", label: "Trigger Latency" },
                                { value: "∞", label: "Workflow Steps" },
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
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-pink-500/5 via-transparent to-transparent opacity-50" />
                            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:20px_20px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

                            <div className="relative z-10 flex flex-col items-center max-w-2xl mx-auto">
                                <div className="mb-4 inline-flex items-center justify-center rounded-full border border-pink-500/30 bg-pink-500/10 px-2.5 py-0.5 text-[10px] font-medium text-pink-400 uppercase tracking-wider">
                                    <span>Q4 2026</span>
                                </div>

                                <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3 text-foreground">
                                    Automate your AI workflows
                                </h2>
                                <p className="text-sm text-muted-foreground mb-6 max-w-lg leading-relaxed">
                                    Join the waitlist to be first to build visual AI pipelines.
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
