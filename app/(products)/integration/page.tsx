"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
    ArrowRightIcon,
    CodeBracketIcon,
    PuzzlePieceIcon,
    CloudArrowUpIcon,
    CursorArrowRaysIcon,
    GlobeAltIcon,
    CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";

import Navbar from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { TypeScriptLogo, PythonLogo, GoLogo } from "@/components/icons/BrandIcons";

// The 4 ways to access Cencori
const accessPaths = [
    {
        id: "visual",
        title: "Visual Builder",
        tagline: "No code required",
        description: "Build AI agents and workflows visually in your browser. Drag-and-drop interface with real-time testing.",
        icon: CursorArrowRaysIcon,
        color: "violet",
        features: ["Drag-and-drop workflow builder", "Visual agent designer", "Real-time testing & debugging"],
    },
    {
        id: "automations",
        title: "Automation Platforms",
        tagline: "n8n, Zapier, Make",
        description: "Use Cencori as a node in your existing automation workflows. Connect to 1000+ apps instantly.",
        icon: PuzzlePieceIcon,
        color: "pink",
        features: ["n8n integration", "Zapier connector", "Make (Integromat) module"],
    },
    {
        id: "api",
        title: "REST API",
        tagline: "HTTP from anywhere",
        description: "Direct API access with your API key. Works with any language or platform that can make HTTP requests.",
        icon: GlobeAltIcon,
        color: "cyan",
        features: ["Simple HTTP endpoints", "OpenAPI spec", "Postman collection"],
    },
    {
        id: "sdks",
        title: "Official SDKs",
        tagline: "TypeScript, Python, Go",
        description: "First-class SDKs with full type safety, streaming support, and idiomatic APIs for developers.",
        icon: CodeBracketIcon,
        color: "emerald",
        features: ["TypeScript SDK", "Python SDK", "Go SDK"],
    },
];

const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
    violet: { bg: "bg-violet-500/10", border: "border-violet-500/30", text: "text-violet-500" },
    pink: { bg: "bg-pink-500/10", border: "border-pink-500/30", text: "text-pink-500" },
    cyan: { bg: "bg-cyan-500/10", border: "border-cyan-500/30", text: "text-cyan-500" },
    emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-500" },
};

export default function IntegrationPage() {
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
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-500/5 via-background to-background pointer-events-none" />

                    <div className="container relative z-10 px-4 md:px-6 flex flex-col items-center text-center">
                        {/* Badge */}
                        <div className="mb-8 animate-appear">
                            <div className="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-sm font-medium text-cyan-400">
                                <span className="flex h-2 w-2 rounded-full bg-cyan-500 mr-2" />
                                <span>Coming Soon</span>
                            </div>
                        </div>

                        {/* Headline */}
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter mb-6 max-w-4xl animate-appear [animation-delay:100ms] text-transparent bg-clip-text bg-gradient-to-b from-foreground to-foreground/50">
                            Integration
                        </h1>

                        {/* Subheadline */}
                        <p className="text-lg md:text-xl text-muted-foreground max-w-xl mb-6 animate-appear [animation-delay:200ms] leading-relaxed">
                            Connect AI everywhere. SDKs, agent frameworks, and platform connectors.
                        </p>

                        {/* CTAs */}
                        <div className="flex flex-col sm:flex-row gap-3 animate-appear [animation-delay:300ms]">
                            <Link href="/docs/sdk">
                                <Button size="default" className="h-10 px-6 text-sm rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] dark:shadow-[0_0_20px_-5px_rgba(255,255,255,0.1)]">
                                    View SDKs <ArrowRightIcon className="ml-2 h-4 w-4" aria-hidden="true" />
                                </Button>
                            </Link>
                            <Link href="/docs">
                                <Button variant="outline" size="default" className="h-10 px-6 text-sm rounded-full border-foreground/20 hover:bg-foreground/5 hover:border-foreground/40 transition-all">
                                    Documentation
                                </Button>
                            </Link>
                        </div>
                    </div>
                </section>

                {/* Ways to Connect Section */}
                <section className="py-20 bg-background">
                    <div className="container mx-auto px-4 md:px-6">
                        <div className="flex flex-col items-center text-center mb-12">
                            <h2 className="text-2xl md:text-4xl font-bold tracking-tighter mb-4 text-foreground">
                                Your way <span className="text-muted-foreground">to connect</span>
                            </h2>
                            <p className="text-base text-muted-foreground max-w-xl">
                                Whether you write code or prefer no-code tools, there&apos;s a path for you.
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
                                    {accessPaths.map((path, index) => {
                                        const colors = colorClasses[path.color];
                                        const isLastRow = index >= 2;
                                        const isRightEdge = (index + 1) % 2 === 0;
                                        return (
                                            <div
                                                key={path.id}
                                                className={cn(
                                                    "group relative flex flex-col p-6 transition-colors duration-300 hover:bg-foreground/[0.02]",
                                                    !isLastRow && "border-b border-border/40",
                                                    !isRightEdge && "md:border-r border-border/40"
                                                )}
                                            >
                                                {/* Icon */}
                                                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-4", colors.bg, colors.border, "border")}>
                                                    <path.icon className={cn("h-4 w-4", colors.text)} aria-hidden="true" />
                                                </div>

                                                {/* Content */}
                                                <h3 className="text-base font-semibold tracking-tight mb-1">{path.title}</h3>
                                                <p className={cn("text-xs font-medium mb-2", colors.text)}>{path.tagline}</p>
                                                <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                                                    {path.description}
                                                </p>

                                                {/* Feature list */}
                                                <ul className="mt-auto space-y-1.5">
                                                    {path.features.map((feature: string, i: number) => (
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

                {/* SDK Section - For Developers */}
                <section className="py-20 bg-background">
                    <div className="container mx-auto px-4 md:px-6">
                        <div className="grid lg:grid-cols-2 gap-8 items-center max-w-5xl mx-auto">
                            <div>
                                <p className="text-xs font-medium text-emerald-500 mb-2 uppercase tracking-wider">For Developers</p>
                                <h2 className="text-2xl md:text-4xl font-bold tracking-tighter mb-4 text-foreground">
                                    One API, <span className="text-muted-foreground">every language</span>
                                </h2>
                                <p className="text-base text-muted-foreground mb-6 leading-relaxed">
                                    Prefer to write code? Our SDKs give you full type safety and idiomatic APIs.
                                </p>

                                <div className="space-y-3">
                                    {[
                                        { cmd: "npm install cencori", Icon: TypeScriptLogo, size: "w-5 h-5" },
                                        { cmd: "pip install cencori", Icon: PythonLogo, size: "w-6 h-6" },
                                        { cmd: "go get github.com/cencori/cencori-go", Icon: GoLogo, size: "w-12 h-12" },
                                    ].map(({ cmd, Icon, size }, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <div className="w-8 h-8 flex items-center justify-center shrink-0">
                                                <Icon className={size} />
                                            </div>
                                            <code className="text-xs font-mono text-muted-foreground">{cmd}</code>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-6">
                                    <Link href="/docs/sdk">
                                        <Button variant="outline" size="sm" className="h-8 px-4 text-xs rounded-full">
                                            SDK Documentation <ArrowRightIcon className="ml-2 w-3 h-3" aria-hidden="true" />
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
                                        <span className="ml-2 text-[10px] text-muted-foreground">example.ts</span>
                                    </div>
                                    <pre className="p-4 text-xs font-mono overflow-x-auto">
                                        <code className="text-muted-foreground font-mono">
                                            <span className="text-blue-400">import</span> {"{"} Cencori {"}"} <span className="text-blue-400">from</span> <span className="text-emerald-400">&apos;cencori&apos;</span>;{"\n\n"}
                                            <span className="text-blue-400">const</span> cencori = <span className="text-blue-400">new</span> <span className="text-yellow-400">Cencori</span>();{"\n\n"}
                                            <span className="text-slate-500">{"// Works with any AI provider"}</span>{"\n"}
                                            <span className="text-blue-400">const</span> response = <span className="text-blue-400">await</span> cencori.ai.<span className="text-yellow-400">chat</span>({"{"}{"\n"}
                                            {"  "}model: <span className="text-emerald-400">&apos;claude-3-5-sonnet&apos;</span>,{"\n"}
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
                                { value: "3", label: "Official SDKs" },
                                { value: "10+", label: "Framework Integrations" },
                                { value: "6+", label: "Platform Connectors" },
                                { value: "100%", label: "Type Safe" },
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
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-cyan-500/5 via-transparent to-transparent opacity-50" />
                            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:20px_20px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

                            <div className="relative z-10 flex flex-col items-center max-w-2xl mx-auto">
                                <div className="mb-4 inline-flex items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-400 uppercase tracking-wider">
                                    <span>Available Now</span>
                                </div>

                                <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3 text-foreground">
                                    Start integrating today
                                </h2>
                                <p className="text-sm text-muted-foreground mb-6 max-w-lg leading-relaxed">
                                    TypeScript and Python SDKs are available now. Go SDK launching soon.
                                </p>

                                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                                    <Link href="/docs/sdk">
                                        <Button size="sm" className="h-8 px-4 text-xs rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all">
                                            View SDK Docs
                                            <ArrowRightIcon className="ml-1.5 w-3 h-3" aria-hidden="true" />
                                        </Button>
                                    </Link>
                                    <Link href={siteConfig.links.getStartedUrl}>
                                        <Button variant="ghost" size="sm" className="h-8 px-4 text-xs rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
                                            Get Started Free
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
