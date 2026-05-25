"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Copy } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Logo } from "@/components/logo";
import {
    NextjsLogo,
    ViteLogo,
    VSCodeLogo,
    CursorLogo,
    ClaudeLogo,
} from "@/components/icons/BrandIcons";

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

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Navbar
                homeUrl="/"
                actions={isAuthenticated ? authenticatedActions : unauthenticatedActions}
                isAuthenticated={isAuthenticated}
                userProfile={isAuthenticated ? userProfile : undefined}
            />

            <main>
                {/* ━━━ HERO — Command-first ━━━ */}
                <section className="relative overflow-hidden bg-background pt-32 pb-20">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-500/5 via-background to-background pointer-events-none" />
                    <div className="container relative z-10 mx-auto px-4 md:px-6">
                        <div className="max-w-4xl mx-auto text-center">
                            <Reveal>
                                <div className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/5 px-4 py-1.5 mb-8">
                                    <span className="flex h-2 w-2 rounded-full bg-purple-500" />
                                    <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">For AI Builders</span>
                                </div>
                            </Reveal>
                            <Reveal delay={0.05}>
                                <h1 className="text-[2.75rem] sm:text-[3.5rem] lg:text-[4.25rem] font-semibold tracking-[-0.035em] leading-[1.05] mb-6">
                                    Ship an AI app
                                    <br />
                                    <span className="text-muted-foreground">in one command.</span>
                                </h1>
                            </Reveal>
                            <Reveal delay={0.1}>
                                <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
                                    <code className="text-sm font-mono bg-foreground/5 px-1.5 py-0.5 rounded text-foreground/80">npx create-cencori-app</code>{" "}
                                    scaffolds a production-ready AI app pre-wired to the Cencori Gateway — API keys, streaming, security, config.{" "}
                                    <span className="text-foreground/60">Zero boilerplate.</span>
                                </p>
                            </Reveal>
                            <Reveal delay={0.15}>
                                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                    <Link href="/login">
                                        <Button size="sm" className="h-8 px-4 text-xs rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all">
                                            Start Building Free <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                                        </Button>
                                    </Link>
                                    <Link href="/docs/quick-start">
                                        <Button variant="outline" size="sm" className="h-8 px-4 text-xs rounded-full border-foreground/20 hover:bg-foreground/5">
                                            Read the docs
                                        </Button>
                                    </Link>
                                </div>
                            </Reveal>
                        </div>

                        {/* Terminal block */}
                        <Reveal delay={0.2}>
                            <div className="max-w-2xl mx-auto mt-16">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-mono text-muted-foreground/50">terminal</span>
                                    <CopyButton text="npx create-cencori-app my-app" />
                                </div>
                                <pre className="text-sm font-mono leading-[1.8] text-foreground/80 bg-foreground/[0.03] border border-border/20 rounded-xl p-5 overflow-x-auto">
                                    <code>
                                        <span className="text-muted-foreground/40">1</span>{"  "}<span className="text-emerald-400">$</span> npx create-cencori-app my-app{"\n"}
                                        <span className="text-muted-foreground/40">2</span>{"  "}{"\n"}
                                        <span className="text-muted-foreground/40">3</span>{"  "}  <span className="text-violet-400">? </span>Select a template{"   "}<span className="text-muted-foreground/60">nextjs / tanstack / agent / celo-agent</span>{"\n"}
                                        <span className="text-muted-foreground/40">4</span>{"  "}  <span className="text-violet-400">? </span>Include a demo chat UI?{"  "}<span className="text-muted-foreground/60">Yes / No</span>{"\n"}
                                        <span className="text-muted-foreground/40">5</span>{"  "}  <span className="text-violet-400">? </span>Enter your API key{"    "}<span className="text-muted-foreground/60">(optional)</span>{"\n"}
                                        <span className="text-muted-foreground/40">6</span>{"  "}{"\n"}
                                        <span className="text-muted-foreground/40">7</span>{"  "}  <span className="text-emerald-500/70">✔</span> Project scaffolded{"\n"}
                                        <span className="text-muted-foreground/40">8</span>{"  "}  <span className="text-emerald-500/70">✔</span> Dependencies installed{"\n"}
                                        <span className="text-muted-foreground/40">9</span>{"  "}  <span className="text-emerald-500/70">✔</span> Ready to build
                                    </code>
                                </pre>
                            </div>
                        </Reveal>
                    </div>
                </section>

                {/* ━━━ TEMPLATES ━━━ */}
                <section className="py-24 bg-background border-y border-border/30">
                    <div className="container mx-auto px-4 md:px-6">
                        <div className="max-w-5xl mx-auto">
                            <Reveal>
                                <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground mb-3">Pick your stack</p>
                            </Reveal>
                            <Reveal delay={0.05}>
                                <h2 className="text-2xl md:text-3xl font-bold tracking-tighter mb-4">
                                    Four templates. One command.
                                </h2>
                            </Reveal>
                            <Reveal delay={0.1}>
                                <p className="text-sm text-muted-foreground max-w-lg mb-12 leading-relaxed">
                                    Choose the foundation that fits your project. Every template includes Gateway integration, environment config, and a working chat endpoint.
                                </p>
                            </Reveal>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {[
                                    { name: "Next.js", desc: "Full-stack React with App Router, Vercel AI SDK streaming, and a chat endpoint already wired up.", icon: NextjsLogo },
                                    { name: "TanStack", desc: "Lightweight React + Vite + TanStack Query with a local API server. Perfect for SPAs.", icon: ViteLogo },
                                    { name: "Cencori Agent", desc: "Node.js agent starter with Gateway, run receipts, and local debugging. No browser needed.", icon: VSCodeLogo },
                                    { name: "Celo Agent", desc: "Same as above + onchain receipt contracts on Celo Sepolia. Ship agents that prove their work.", icon: VSCodeLogo },
                                ].map((tpl, i) => (
                                    <Reveal key={tpl.name} delay={0.1 + i * 0.05}>
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

                {/* ━━━ WHAT YOU GET ━━━ */}
                <section className="py-24 bg-background">
                    <div className="container mx-auto px-4 md:px-6">
                        <div className="max-w-5xl mx-auto">
                            <Reveal>
                                <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground mb-3">What's inside</p>
                            </Reveal>
                            <Reveal delay={0.05}>
                                <h2 className="text-2xl md:text-3xl font-bold tracking-tighter mb-12">
                                    Everything you need to ship.
                                </h2>
                            </Reveal>

                            <div className="space-y-0">
                                {[
                                    { title: "Streaming API route", desc: "A working `/api/chat` endpoint using the Vercel AI SDK. Swap the model, change the prompt, deploy." },
                                    { title: "Cencori config", desc: "`cencori.config.ts` with all supported models listed. Add providers, set defaults, configure rate limits — all in one file." },
                                    { title: "Environment setup", desc: "`.env.local` pre-configured with your Cencori API key placeholder. No hunting through docs for variable names." },
                                    { title: "Security middleware", desc: "PII detection, prompt injection protection, and content moderation wired into the Gateway. Active on every request, zero config." },
                                    { title: "Optional chat UI", desc: "A clean, dark-mode chat interface if you choose. Built with `useChat()` — streaming responses out of the box." },
                                ].map((item, i) => (
                                    <Reveal key={item.title} delay={i * 0.05}>
                                        <div className="group grid grid-cols-1 sm:grid-cols-12 gap-4 sm:gap-8 py-6 sm:py-7 cursor-default border-b border-border/10 last:border-0">
                                            <div className="sm:col-span-1 text-sm text-muted-foreground/30 tabular-nums font-mono">
                                                {String(i + 1).padStart(2, "0")}
                                            </div>
                                            <h3 className="sm:col-span-4 text-sm font-medium">
                                                {item.title}
                                            </h3>
                                            <p className="sm:col-span-7 text-sm text-muted-foreground leading-relaxed">
                                                {item.desc}
                                            </p>
                                        </div>
                                    </Reveal>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* ━━━ BUILD WITH ━━━ */}
                <section className="py-20 bg-muted/5 border-y border-border/30">
                    <div className="container mx-auto px-4 md:px-6">
                        <div className="max-w-3xl mx-auto text-center">
                            <Reveal>
                                <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground mb-8">Build with your favorite tools</p>
                            </Reveal>
                            <Reveal delay={0.05}>
                                <div className="flex flex-wrap justify-center gap-10 items-center">
                                    {[
                                        { name: "Cursor", Logo: CursorLogo },
                                        { name: "VS Code", Logo: VSCodeLogo },
                                        { name: "Claude", Logo: ClaudeLogo },
                                        { name: "Next.js", Logo: NextjsLogo },
                                        { name: "Vite", Logo: ViteLogo },
                                    ].map((tool) => (
                                        <div key={tool.name} className="flex items-center gap-3 text-muted-foreground">
                                            <tool.Logo className="h-5 w-5 opacity-40" size={20} />
                                            <span className="text-sm font-medium">{tool.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </Reveal>
                            <Reveal delay={0.1}>
                                <p className="text-xs text-muted-foreground/50 mt-10">
                                    Works with your editor, your framework, your stack. No migration required.
                                </p>
                            </Reveal>
                        </div>
                    </div>
                </section>

                {/* ━━━ CTA ━━━ */}
                <section className="py-28 bg-background">
                    <div className="container mx-auto px-4 md:px-6">
                        <div className="max-w-2xl mx-auto text-center">
                            <Reveal>
                                <h2 className="text-3xl sm:text-[2.75rem] font-semibold tracking-[-0.03em] leading-[1.1] mb-4">
                                    Your AI app deserves
                                    <br />
                                    <span className="text-muted-foreground">better than boilerplate.</span>
                                </h2>
                            </Reveal>
                            <Reveal delay={0.05}>
                                <p className="text-muted-foreground text-sm mb-10 max-w-md mx-auto leading-relaxed">
                                    Scaffold a production-ready app in one command. Free to start, pay when you scale.
                                </p>
                            </Reveal>
                            <Reveal delay={0.1}>
                                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                    <Link href="/login">
                                        <Button size="sm" className="h-8 px-5 text-xs rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all">
                                            Start Building Free <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                                        </Button>
                                    </Link>
                                    <Link href="/pricing">
                                        <Button variant="outline" size="sm" className="h-8 px-5 text-xs rounded-full border-foreground/20">
                                            View Pricing
                                        </Button>
                                    </Link>
                                </div>
                            </Reveal>
                        </div>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}
