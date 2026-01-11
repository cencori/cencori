"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronRight, Shield, Eye, DollarSign, Gauge, Bot, Code2, Copy, Check } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Logo } from "@/components/logo";
import {
    VercelLogo,
    CursorLogo,
    VSCodeLogo,
    WindsurfLogo,
    ClaudeLogo,
    NextjsLogo,
    ViteLogo,
    PythonLogo,
    ReactLogo,
    SvelteLogo,
    VueLogo
} from "@/components/icons/BrandIcons";

// Simple copy button
function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
        </button>
    );
}

export default function VibeCodersPage() {
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
        { icon: Shield, title: "Security by default", description: "PII filtering, prompt injection detection, and content moderation built-in." },
        { icon: Eye, title: "Full observability", description: "See every request, response, and token. Debug in seconds." },
        { icon: DollarSign, title: "Cost control", description: "Per-user budgets and rate limits. No surprise bills." },
        { icon: Gauge, title: "Zero overhead", description: "Edge processing adds <50ms. Your users won't notice." },
        { icon: Bot, title: "Any model, one API", description: "OpenAI, Claude, Gemini — switch with one line." },
        { icon: Code2, title: "Drop-in integration", description: "Works with Vercel AI SDK. No lock-in." },
    ];

    const prompts = [
        { title: "Bootstrap with Cencori", prompt: "Set up a Next.js app with Cencori AI Gateway. Install @cencori/ai-sdk and create a streaming chat endpoint." },
        { title: "Add security", prompt: "Add Cencori Edge middleware to protect /api/ai/* routes. Enable PII detection and prompt injection protection." },
    ];

    const editors = [
        { name: "Cursor", icon: CursorLogo, href: "/docs/integrations" },
        { name: "VS Code", icon: VSCodeLogo, href: "/docs/integrations" },
        { name: "Windsurf", icon: WindsurfLogo, href: "/docs/integrations" },
        { name: "Claude", icon: ClaudeLogo, href: "/docs/integrations" },
    ];

    const frameworks = [
        { name: "Next.js", icon: NextjsLogo },
        { name: "Vite", icon: ViteLogo },
        { name: "React", icon: ReactLogo },
        { name: "Svelte", icon: SvelteLogo },
        { name: "Vue", icon: VueLogo },
        { name: "Python", icon: PythonLogo },
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
                <section className="relative flex flex-col items-center justify-center overflow-hidden bg-background pt-32 pb-20">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-foreground/5 via-background to-background pointer-events-none" />

                    <div className="container relative z-10 px-4 md:px-6 flex flex-col items-center text-center">
                        <div className="mb-8 animate-appear">
                            <Link href="/examples" className="inline-flex items-center rounded-full border border-foreground/10 bg-foreground/5 px-3 py-1 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground">
                                <span className="flex h-2 w-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
                                <span className="mr-2">For vibe coders</span>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </Link>
                        </div>

                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter mb-6 max-w-4xl animate-appear [animation-delay:100ms] text-transparent bg-clip-text bg-gradient-to-b from-foreground to-foreground/50">
                            Your weekend prototype <span className="italic">deserves</span> production
                        </h1>

                        <p className="text-lg md:text-xl text-muted-foreground max-w-xl mb-10 animate-appear [animation-delay:200ms] leading-relaxed">
                            Stop letting backend complexity kill your momentum. Cencori handles security, observability, and cost control.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-3 animate-appear [animation-delay:300ms]">
                            <Link href="/login">
                                <Button size="default" className="h-10 px-6 text-sm rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all">
                                    Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </Link>
                            <Link href="/docs/quick-start">
                                <Button variant="outline" size="default" className="h-10 px-6 text-sm rounded-full border-foreground/20 hover:bg-foreground/5 hover:border-foreground/40 transition-all">
                                    Quickstart
                                </Button>
                            </Link>
                        </div>
                    </div>
                </section>

                {/* Framework bar */}
                <section className="py-8 border-y border-border/30">
                    <div className="container px-4 md:px-6">
                        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
                            <span className="text-sm text-muted-foreground">Works with</span>
                            {frameworks.map((framework) => (
                                <div key={framework.name} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                                    <framework.icon className="h-5 w-5" />
                                    <span className="text-sm hidden sm:inline">{framework.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Features Section */}
                <section className="py-20 bg-background">
                    <div className="container mx-auto px-4 md:px-6">
                        <div className="flex flex-col items-center text-center mb-12">
                            <h2 className="text-2xl md:text-4xl font-bold tracking-tighter mb-4 text-foreground">
                                AI writes the code. <span className="text-muted-foreground">We handle the rest.</span>
                            </h2>
                            <p className="text-base text-muted-foreground max-w-xl">
                                Everything you need to ship AI features without becoming a DevOps engineer.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
                            {features.map((feature) => (
                                <div key={feature.title} className="p-6 border border-border/30 hover:border-border/60 hover:bg-muted/20 transition-colors">
                                    <feature.icon className="h-5 w-5 text-muted-foreground mb-4" />
                                    <h3 className="text-sm font-semibold mb-2 text-foreground">{feature.title}</h3>
                                    <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Vercel AI SDK Section */}
                <section className="py-20 bg-background border-y border-border/30">
                    <div className="container mx-auto px-4 md:px-6">
                        <div className="max-w-4xl mx-auto">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                                <div>
                                    <div className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/5 px-3 py-1 text-xs font-medium text-foreground/80 mb-4">
                                        <VercelLogo className="h-3.5 w-3.5" />
                                        Works with Vercel AI SDK
                                    </div>
                                    <h2 className="text-2xl md:text-3xl font-bold tracking-tighter mb-4 text-foreground">
                                        Drop-in. <span className="text-muted-foreground">No rewrite.</span>
                                    </h2>
                                    <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                                        Already using Vercel AI SDK? Keep using <code className="text-xs bg-muted px-1.5 py-0.5 rounded">streamText()</code> and <code className="text-xs bg-muted px-1.5 py-0.5 rounded">useChat()</code> — just swap the model.
                                    </p>
                                    <ul className="space-y-2 text-xs text-muted-foreground">
                                        <li className="flex items-center gap-2">
                                            <span className="w-1 h-1 rounded-full bg-emerald-500" />
                                            One API for OpenAI, Claude, Gemini
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <span className="w-1 h-1 rounded-full bg-emerald-500" />
                                            Safety filtering on every request
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <span className="w-1 h-1 rounded-full bg-emerald-500" />
                                            Cost tracking built-in
                                        </li>
                                    </ul>
                                </div>

                                <div className="rounded-lg border border-border/40 bg-card overflow-hidden">
                                    <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-muted/30">
                                        <div className="flex gap-1.5">
                                            <span className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                                            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                                            <span className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                                        </div>
                                        <span className="text-xs text-muted-foreground ml-2 font-mono">route.ts</span>
                                    </div>
                                    <pre className="p-4 text-xs overflow-x-auto font-mono">
                                        <code className="text-foreground/90">
                                            <span className="text-purple-400">import</span> {"{"} <span className="text-yellow-300">cencori</span> {"}"} <span className="text-purple-400">from</span> <span className="text-emerald-400">&apos;@cencori/ai-sdk&apos;</span>;{"\n"}
                                            <span className="text-purple-400">import</span> {"{"} <span className="text-yellow-300">streamText</span> {"}"} <span className="text-purple-400">from</span> <span className="text-emerald-400">&apos;ai&apos;</span>;{"\n\n"}
                                            <span className="text-purple-400">const</span> result = <span className="text-blue-400">streamText</span>({"{"}{"\n"}
                                            {"  "}model: <span className="text-blue-400">cencori</span>(<span className="text-emerald-400">&apos;gpt-4o&apos;</span>),{"\n"}
                                            {"  "}messages,{"\n"}
                                            {"}"});
                                        </code>
                                    </pre>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* AI Editor Integration */}
                <section className="py-20 bg-background">
                    <div className="container mx-auto px-4 md:px-6">
                        <div className="flex flex-col items-center text-center mb-12">
                            <h2 className="text-2xl md:text-4xl font-bold tracking-tighter mb-4 text-foreground">
                                Works with your <span className="text-muted-foreground">favorite editor</span>
                            </h2>
                            <p className="text-base text-muted-foreground max-w-xl">
                                Cencori integrates with IDE extensions and MCP servers
                            </p>
                        </div>

                        <div className="flex flex-wrap justify-center gap-4 max-w-2xl mx-auto">
                            {editors.map((editor) => (
                                <Link
                                    key={editor.name}
                                    href={editor.href}
                                    className="flex flex-col items-center gap-2 p-6 border border-border/30 hover:border-border/60 hover:bg-muted/20 transition-colors"
                                >
                                    <editor.icon className="h-8 w-8" size={32} />
                                    <span className="text-xs text-muted-foreground">{editor.name}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>

                {/* AI Prompts Section */}
                <section className="py-20 bg-background border-y border-border/30">
                    <div className="container mx-auto px-4 md:px-6">
                        <div className="flex flex-col items-center text-center mb-12">
                            <h2 className="text-2xl md:text-4xl font-bold tracking-tighter mb-4 text-foreground">
                                Start with <span className="text-muted-foreground">Cencori prompts</span>
                            </h2>
                            <p className="text-base text-muted-foreground max-w-xl">
                                Copy these into your AI editor to get started
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
                            {prompts.map((item) => (
                                <div key={item.title} className="p-5 border border-border/30 hover:border-border/60 transition-colors">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                                        <CopyButton text={item.prompt} />
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed font-mono bg-muted/30 p-3 rounded">
                                        {item.prompt}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Pricing Section */}
                <section className="py-20 bg-background">
                    <div className="container mx-auto px-4 md:px-6">
                        <div className="max-w-lg mx-auto text-center">
                            <h2 className="text-2xl md:text-3xl font-bold tracking-tighter mb-4 text-foreground">
                                Pricing for builders
                            </h2>
                            <p className="text-base text-muted-foreground mb-8">
                                A generous free tier to start, fair pricing when you scale.
                            </p>
                            <Link href="/pricing">
                                <Button variant="outline" size="default" className="h-10 px-6 text-sm rounded-full border-foreground/20 hover:bg-foreground/5 hover:border-foreground/40 transition-all">
                                    View Pricing
                                </Button>
                            </Link>
                        </div>
                    </div>
                </section>

                {/* CTA Section */}
                <section className="py-20 bg-background border-t border-border/30">
                    <div className="container mx-auto px-4 md:px-6">
                        <div className="max-w-2xl mx-auto text-center">
                            <h2 className="text-2xl md:text-4xl font-bold tracking-tighter mb-4 text-foreground">
                                Ready to ship?
                            </h2>
                            <p className="text-base text-muted-foreground mb-8">
                                Your AI-built app deserves production-grade infrastructure.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                <Link href="/login">
                                    <Button size="default" className="h-10 px-6 text-sm rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all">
                                        Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                                <Link href="/contact">
                                    <Button variant="outline" size="default" className="h-10 px-6 text-sm rounded-full border-foreground/20 hover:bg-foreground/5 hover:border-foreground/40 transition-all">
                                        Talk to Us
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}
