"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronRight, Share2, Database, Cpu, Workflow, Layers, Check, Copy } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Logo } from "@/components/logo";
import { NextjsLogo, ViteLogo, ReactLogo } from "@/components/icons/BrandIcons";

function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            ([e]) => { if (e.isIntersecting) setVisible(true); },
            { threshold: 0.12 }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, []);
    return (
        <div
            ref={ref}
            className={className}
            style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(24px)",
                transition: `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
            }}
        >
            {children}
        </div>
    );
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
        </button>
    );
}

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
        { icon: Database, title: "Memory", description: "Vector DB and semantic cache." },
        { icon: Layers, title: "Integration", description: "Connect to the world's APIs." },
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
                            Don't stitch together 10 different tools. Cencori gives you Gateway, Compute, and Memory in one platform.
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
                                            <div className="bg-background border border-border/50 p-3 rounded text-center text-xs font-medium">Memory</div>
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

                {/* Scaffold Section */}
                <section className="py-20 bg-background border-y border-border/30">
                    <div className="container mx-auto px-4 md:px-6">
                        <div className="max-w-5xl mx-auto">
                            <Reveal>
                                <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground mb-4">Start from scratch</p>
                            </Reveal>
                            <Reveal delay={0.05}>
                                <h2 className="text-2xl md:text-3xl font-bold tracking-tighter mb-4">
                                    Ship in seconds with <code className="text-sm font-mono bg-foreground/5 px-2 py-0.5 rounded">create-cencori-app</code>
                                </h2>
                            </Reveal>
                            <Reveal delay={0.1}>
                                <p className="text-muted-foreground text-sm max-w-xl mb-12 leading-relaxed">
                                    Bootstrap a production-ready Cencori app with one command. Pick your stack — we wire up the Gateway, API keys, streaming, and config.
                                </p>
                            </Reveal>

                            {/* Command block */}
                            <Reveal delay={0.15}>
                                <div className="mb-14">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs font-mono text-muted-foreground/50">terminal</span>
                                        <CopyButton text="npx create-cencori-app my-app" />
                                    </div>
                                    <pre className="text-sm sm:text-sm font-mono leading-[1.8] text-foreground/80 bg-foreground/[0.03] border border-border/20 rounded-xl p-5 overflow-x-auto">
                                        <code>
                                            <span className="text-muted-foreground/40">1</span>{"  "}<span className="text-emerald-400">$</span> npx create-cencori-app my-app{"\n"}
                                            <span className="text-muted-foreground/40">2</span>{"  "}{"\n"}
                                            <span className="text-muted-foreground/40">3</span>{"  "}  <span className="text-violet-400">? </span>Select a template{"  "}<span className="text-muted-foreground/60">nextjs / tanstack / agent / celo-agent</span>{"\n"}
                                            <span className="text-muted-foreground/40">4</span>{"  "}  <span className="text-violet-400">? </span>Include a demo chat UI?{"  "}<span className="text-muted-foreground/60">Yes / No</span>{"\n"}
                                            <span className="text-muted-foreground/40">5</span>{"  "}  <span className="text-violet-400">? </span>Enter your API key{"  "}<span className="text-muted-foreground/60">(optional)</span>{"\n"}
                                            <span className="text-muted-foreground/40">6</span>{"  "}{"\n"}
                                            <span className="text-muted-foreground/40">7</span>{"  "}  <span className="text-emerald-500/70">✔</span> Project scaffolded{"\n"}
                                            <span className="text-muted-foreground/40">8</span>{"  "}  <span className="text-emerald-500/70">✔</span> Dependencies installed{"\n"}
                                            <span className="text-muted-foreground/40">9</span>{"  "}  <span className="text-emerald-500/70">✔</span> Ready to build
                                        </code>
                                    </pre>
                                </div>
                            </Reveal>

                            {/* Template cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {[
                                    { name: "Next.js", desc: "Full-stack React with App Router, Vercel AI SDK streaming, and a chat endpoint already wired up.", icon: NextjsLogo },
                                    { name: "TanStack", desc: "Lightweight React + Vite + TanStack Query with a local API server. Perfect for SPAs.", icon: ViteLogo },
                                    { name: "Cencori Agent", desc: "Node.js agent starter with Gateway, run receipts, and local debugging. No browser needed.", icon: ReactLogo },
                                    { name: "Celo Agent", desc: "Same as above + onchain receipt contracts on Celo Sepolia. Ship agents that prove their work.", icon: ReactLogo },
                                ].map((tpl, i) => (
                                    <Reveal key={tpl.name} delay={i * 0.05}>
                                        <div className="group p-6 border border-border/30 rounded-xl hover:border-primary/20 hover:bg-muted/10 transition-all duration-300">
                                            <div className="flex items-center gap-3 mb-2">
                                                <tpl.icon className="h-4 w-4 text-muted-foreground opacity-50" />
                                                <span className="text-sm font-semibold">{tpl.name}</span>
                                            </div>
                                            <p className="text-sm text-muted-foreground leading-relaxed">{tpl.desc}</p>
                                        </div>
                                    </Reveal>
                                ))}
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
