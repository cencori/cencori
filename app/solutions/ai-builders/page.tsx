"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronRight, Share2, Database, Cpu, Workflow, Layers, Check, Copy } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Logo } from "@/components/logo";

export default function AIBuildersPage() {
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

    const primitives = [
        { icon: Share2, title: "Gateway", description: "Universal API for all LLMs." },
        { icon: Cpu, title: "Compute", description: "Serverless code execution for agents." },
        { icon: Workflow, title: "Workflow", description: "Orchestrate complex AI chains." },
        { icon: Database, title: "Storage", description: "Vector DB and semantic cache." },
        { icon: Layers, title: "Integration", description: "Connect to the world's APIs." },
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
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-500/5 via-background to-background pointer-events-none" />

                    <div className="container relative z-10 px-4 md:px-6 flex flex-col items-center text-center">
                        <div className="mb-8 animate-appear">
                            <Link href="/products" className="inline-flex items-center rounded-full border border-foreground/10 bg-foreground/5 px-3 py-1 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground">
                                <span className="flex h-2 w-2 rounded-full bg-purple-500 mr-2 animate-pulse" />
                                <span className="mr-2">For AI Builders</span>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </Link>
                        </div>

                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter mb-6 max-w-4xl animate-appear [animation-delay:100ms] text-transparent bg-clip-text bg-gradient-to-b from-foreground to-foreground/50">
                            The complete stack for <span className="italic">AI-native</span> products
                        </h1>

                        <p className="text-lg md:text-xl text-muted-foreground max-w-xl mb-10 animate-appear [animation-delay:200ms] leading-relaxed">
                            Don't stitch together 10 different tools. Cencori gives you Gateway, Compute, and Storage in one platform.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-3 animate-appear [animation-delay:300ms]">
                            <Link href="/login">
                                <Button size="default" className="h-10 px-6 text-sm rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all">
                                    Start Building <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </Link>
                            <Link href="/contact">
                                <Button variant="outline" size="default" className="h-10 px-6 text-sm rounded-full border-foreground/20 hover:bg-foreground/5 hover:border-foreground/40 transition-all">
                                    Talk to Sales
                                </Button>
                            </Link>
                        </div>
                    </div>
                </section>

                {/* Primitives Grid */}
                <section className="py-20 bg-background">
                    <div className="container mx-auto px-4 md:px-6">
                        <div className="flex flex-col items-center text-center mb-16">
                            <h2 className="text-2xl md:text-3xl font-bold tracking-tighter mb-4 text-foreground">
                                Five Primitives. One Platform.
                            </h2>
                            <p className="text-base text-muted-foreground max-w-xl">
                                Everything you need to build the next generation of AI apps.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
                            {primitives.map((item) => (
                                <div key={item.title} className="group p-8 border border-border/30 rounded-xl hover:border-primary/20 hover:bg-muted/10 transition-all duration-300">
                                    <div className="mb-4 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-foreground/5 text-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                        <item.icon className="h-5 w-5" />
                                    </div>
                                    <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {item.description}
                                    </p>
                                </div>
                            ))}
                            <div className="group p-8 border border-dashed border-border/40 rounded-xl flex flex-col justify-center items-center text-center">
                                <h3 className="text-sm font-medium text-muted-foreground">More coming soon</h3>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Integration Diagram Section (Abstract) */}
                <section className="py-20 bg-muted/5 border-y border-border/30">
                    <div className="container mx-auto px-4 md:px-6">
                        <div className="max-w-5xl mx-auto flex flex-col items-center">
                            <div className="text-center mb-10">
                                <h2 className="text-2xl font-bold tracking-tight mb-3">Unified Infrastructure</h2>
                                <p className="text-muted-foreground text-sm max-w-lg mx-auto">
                                    Your application connects to Cencori, and we handle the complexity of coordinating providers, vector databases, and agent runtime.
                                </p>
                            </div>

                            {/* Abstract Diagram */}
                            <div className="relative w-full max-w-3xl p-8 md:p-12 border border-border/40 rounded-2xl bg-background shadow-sm">
                                <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                                    {/* App */}
                                    <div className="flex flex-col items-center p-4 border rounded-lg bg-card min-w-[120px]">
                                        <div className="w-10 h-10 rounded bg-blue-500/10 flex items-center justify-center mb-2">
                                            <div className="w-4 h-4 bg-blue-500 rounded-sm" />
                                        </div>
                                        <span className="text-sm font-semibold">Your App</span>
                                    </div>

                                    {/* Arrow */}
                                    <div className="hidden md:flex flex-1 h-[2px] bg-border relative items-center">
                                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 border-t-2 border-r-2 border-border rotate-45" />
                                        <span className="absolute left-1/2 -translate-x-1/2 -top-6 text-xs text-muted-foreground font-mono bg-background px-2">Cencori SDK</span>
                                    </div>
                                    <div className="md:hidden w-[2px] h-12 bg-border relative"></div>

                                    {/* Cencori Platform */}
                                    <div className="flex-1 border-2 border-foreground/10 rounded-xl p-6 bg-foreground/5 w-full">
                                        <div className="text-xs font-bold text-center mb-6 uppercase tracking-widest text-muted-foreground">Cencori Platform</div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-background border border-border/50 p-3 rounded text-center text-xs font-medium">Gateway</div>
                                            <div className="bg-background border border-border/50 p-3 rounded text-center text-xs font-medium">Security</div>
                                            <div className="bg-background border border-border/50 p-3 rounded text-center text-xs font-medium">Compute</div>
                                            <div className="bg-background border border-border/50 p-3 rounded text-center text-xs font-medium">Storage</div>
                                        </div>
                                    </div>

                                    {/* Arrow */}
                                    <div className="hidden md:flex flex-1 h-[2px] bg-border relative items-center">
                                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 border-t-2 border-r-2 border-border rotate-45" />
                                    </div>
                                    <div className="md:hidden w-[2px] h-12 bg-border relative"></div>

                                    {/* Providers */}
                                    <div className="flex flex-col gap-2">
                                        <div className="px-3 py-1.5 border rounded bg-background text-xs text-muted-foreground">OpenAI</div>
                                        <div className="px-3 py-1.5 border rounded bg-background text-xs text-muted-foreground">Anthropic</div>
                                        <div className="px-3 py-1.5 border rounded bg-background text-xs text-muted-foreground">Pinecone</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* CTA Section */}
                <section className="py-24 bg-background">
                    <div className="container mx-auto px-4 md:px-6">
                        <div className="max-w-2xl mx-auto text-center">
                            <h2 className="text-3xl font-bold tracking-tighter mb-4 text-foreground">
                                Stop building infrastructure
                            </h2>
                            <p className="text-muted-foreground mb-8">
                                Focus on your product. We&apos;ll handle the plumbing.
                            </p>
                            <Link href="/login">
                                <Button size="lg" className="rounded-full px-8">
                                    Start Building Free
                                </Button>
                            </Link>
                        </div>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}
