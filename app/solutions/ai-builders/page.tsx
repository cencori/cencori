"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Copy, DollarSign, CreditCard, Users, BarChart3 } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Logo } from "@/components/logo";
import {
    NextjsLogo,
    ViteLogo,
    VSCodeLogo,
    CursorLogo,
    ClaudeLogo,
    VercelLogo,
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
        <div className="min-h-screen bg-background text-foreground selection:bg-foreground selection:text-background">
            <Navbar
                homeUrl="/"
                actions={isAuthenticated ? authenticatedActions : unauthenticatedActions}
                isAuthenticated={isAuthenticated}
                userProfile={isAuthenticated ? userProfile : undefined}
            />

            <main>
                {/* ━━━ HERO ━━━ */}
                <section className="bg-background border-b border-border/30 pt-28 sm:pt-36 pb-0">
                    <div className="mx-auto max-w-6xl border-t border-x border-border/30 relative px-6 sm:px-12 py-20 sm:py-28">
                        <div className="absolute -top-1.5 -left-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
                        <div className="absolute -top-1.5 -right-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
                        <div className="absolute -bottom-1.5 -left-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
                        <div className="absolute -bottom-1.5 -right-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>

                        <div className="max-w-3xl">
                            <Reveal>
                                <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground mb-8">
                                    For AI Builders
                                </p>
                            </Reveal>
                            <Reveal delay={0.05}>
                                <h1 className="text-[2.75rem] sm:text-[3.5rem] lg:text-[4.25rem] font-semibold tracking-[-0.035em] leading-[1.05] mb-6 max-w-3xl">
                                    Ship an AI app
                                    <br />
                                    <span className="text-muted-foreground">in one command.</span>
                                </h1>
                            </Reveal>
                            <Reveal delay={0.1}>
                                <p className="text-base sm:text-lg text-muted-foreground max-w-xl mb-10 leading-[1.7]">
                                    <code className="text-[13px] font-mono bg-foreground/5 px-1.5 py-0.5 rounded text-foreground/80">npx create-cencori-app</code>{" "}
                                    scaffolds a production-ready AI app pre-wired to the Cencori Gateway — API keys, streaming, security, config.{" "}
                                    <span className="text-muted-foreground/60">Zero boilerplate.</span>
                                </p>
                            </Reveal>
                            <Reveal delay={0.15}>
                                <div className="flex gap-3">
                                    <Link href="/login">
                                        <Button size="sm" className="h-7 text-xs px-3 bg-foreground text-background hover:bg-foreground/90">
                                            Start Building Free <ArrowRight className="ml-1.5 h-3 w-3" />
                                        </Button>
                                    </Link>
                                    <Link href="/docs/quick-start">
                                        <Button variant="outline" size="sm" className="h-7 text-xs px-3">
                                            Quickstart
                                        </Button>
                                    </Link>
                                </div>
                            </Reveal>
                        </div>

                        {/* Terminal block */}
                        <Reveal delay={0.2}>
                            <div className="mt-20 max-w-2xl">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[11px] font-mono text-muted-foreground/50">terminal</span>
                                    <CopyButton text="npx create-cencori-app my-app" />
                                </div>
                                <pre className="text-[13px] font-mono leading-[1.8] text-foreground/80 bg-foreground/[0.03] border border-border/20 rounded-lg p-5 overflow-x-auto">
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
                <section className="bg-background border-b border-border/30">
                    <div className="mx-auto max-w-6xl border-x border-border/30 relative px-6 sm:px-12 py-24 sm:py-32">
                        <div className="absolute -top-1.5 -left-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
                        <div className="absolute -top-1.5 -right-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
                        <div className="absolute -bottom-1.5 -left-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
                        <div className="absolute -bottom-1.5 -right-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>

                        <Reveal>
                            <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground mb-4">Pick your stack</p>
                        </Reveal>
                        <Reveal delay={0.05}>
                            <h2 className="text-3xl sm:text-[2.75rem] font-semibold tracking-[-0.03em] leading-[1.1] mb-6 max-w-xl">
                                Four templates.
                                <br />
                                <span className="text-muted-foreground">One command.</span>
                            </h2>
                        </Reveal>
                        <Reveal delay={0.1}>
                            <p className="text-muted-foreground text-sm leading-[1.7] max-w-lg mb-16">
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
                                    <div className="group p-6 border border-border/20 rounded-lg cursor-default hover:border-border/50 transition-colors duration-500">
                                        <div className="flex items-center gap-3 mb-3">
                                            <tpl.icon className="h-4 w-4 text-muted-foreground opacity-50" />
                                            <span className="text-sm font-medium">{tpl.name}</span>
                                        </div>
                                        <p className="text-[13px] text-muted-foreground leading-[1.7]">{tpl.desc}</p>
                                    </div>
                                </Reveal>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ━━━ WHAT YOU GET ━━━ */}
                <section className="bg-background border-b border-border/30">
                    <div className="mx-auto max-w-6xl border-x border-border/30 relative px-6 sm:px-12 py-24 sm:py-32">
                        <div className="absolute -top-1.5 -left-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
                        <div className="absolute -top-1.5 -right-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
                        <div className="absolute -bottom-1.5 -left-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
                        <div className="absolute -bottom-1.5 -right-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>

                        <Reveal>
                            <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground mb-4">What's inside</p>
                        </Reveal>
                        <Reveal delay={0.05}>
                            <h2 className="text-3xl sm:text-[2.75rem] font-semibold tracking-[-0.03em] leading-[1.1] mb-6 max-w-xl">
                                Everything you need
                                <br />
                                <span className="text-muted-foreground">to ship.</span>
                            </h2>
                        </Reveal>
                        <Reveal delay={0.1}>
                            <p className="text-muted-foreground text-sm leading-[1.7] max-w-lg mb-20">
                                No hunting through docs. No copy-pasting config from blog posts. Every file you need, pre-wired and ready to go.
                            </p>
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
                                    <div className="group grid grid-cols-1 sm:grid-cols-12 gap-4 sm:gap-8 py-7 sm:py-9 cursor-default border-b border-border/10 last:border-0">
                                        <div className="sm:col-span-1 text-sm text-muted-foreground/30 tabular-nums font-mono">
                                            {String(i + 1).padStart(2, "0")}
                                        </div>
                                        <h3 className="sm:col-span-4 text-base font-medium group-hover:text-emerald-500 transition-colors duration-300">
                                            {item.title}
                                        </h3>
                                        <p className="sm:col-span-7 text-sm text-muted-foreground leading-[1.7]">
                                            {item.desc}
                                        </p>
                                    </div>
                                </Reveal>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ━━━ INTEGRATE ━━━ */}
                <section className="bg-background border-b border-border/30">
                    <div className="mx-auto max-w-6xl border-x border-border/30 relative px-6 sm:px-12 py-24 sm:py-32">
                        <div className="absolute -top-1.5 -left-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
                        <div className="absolute -top-1.5 -right-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
                        <div className="absolute -bottom-1.5 -left-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
                        <div className="absolute -bottom-1.5 -right-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
                            <div>
                                <Reveal>
                                    <div className="flex items-center gap-3 mb-8">
                                        <VercelLogo className="h-4 w-4 text-foreground" />
                                        <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                            Vercel AI SDK
                                        </span>
                                    </div>
                                </Reveal>
                                <Reveal delay={0.05}>
                                    <h2 className="text-3xl sm:text-[2.75rem] font-semibold tracking-[-0.03em] leading-[1.1] mb-6">
                                        Already have an app?
                                        <br />
                                        <span className="text-muted-foreground">Drop Cencori in.</span>
                                    </h2>
                                </Reveal>
                                <Reveal delay={0.1}>
                                    <p className="text-muted-foreground leading-[1.7] max-w-md mb-10">
                                        Using the Vercel AI SDK? Keep{" "}
                                        <code className="text-[13px] text-foreground/70 font-mono">streamText()</code> and{" "}
                                        <code className="text-[13px] text-foreground/70 font-mono">useChat()</code> — just swap the model to Cencori.
                                    </p>
                                </Reveal>
                                <Reveal delay={0.15}>
                                    <div className="space-y-3 text-sm text-muted-foreground">
                                        <p className="group cursor-default">
                                            <span className="text-emerald-500/60 mr-3">&#x2713;</span>
                                            One API for OpenAI, Claude, Gemini
                                        </p>
                                        <p className="group cursor-default">
                                            <span className="text-emerald-500/60 mr-3">&#x2713;</span>
                                            Safety filtering on every request
                                        </p>
                                        <p className="group cursor-default">
                                            <span className="text-emerald-500/60 mr-3">&#x2713;</span>
                                            Cost tracking built-in
                                        </p>
                                    </div>
                                </Reveal>
                            </div>

                            {/* Code block */}
                            <Reveal delay={0.1}>
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-[11px] font-mono text-muted-foreground/50">route.ts</span>
                                        <CopyButton text={[
                                            "import { cencori } from 'cencori';",
                                            "import { streamText } from 'ai';",
                                            "",
                                            "const result = streamText({",
                                            "  model: cencori('gpt-4o'),",
                                            "  messages,",
                                            "});",
                                        ].join('\n')} />
                                    </div>
                                    <pre className="text-[13px] font-mono leading-[1.8] text-foreground/80 bg-foreground/[0.03] border border-border/20 rounded-lg p-5 overflow-x-auto">
                                        <code>
                                            <span className="text-muted-foreground/40">1</span>{"  "}<span className="text-violet-400">import</span> {"{ "}<span className="text-foreground">cencori</span>{" }"} <span className="text-violet-400">from</span> <span className="text-emerald-400">&apos;cencori&apos;</span>;{"\n"}
                                            <span className="text-muted-foreground/40">2</span>{"  "}<span className="text-violet-400">import</span> {"{ "}<span className="text-foreground">streamText</span>{" }"} <span className="text-violet-400">from</span> <span className="text-emerald-400">&apos;ai&apos;</span>;{"\n"}
                                            <span className="text-muted-foreground/40">3</span>{"\n"}
                                            <span className="text-muted-foreground/40">4</span>{"  "}<span className="text-violet-400">const</span> result = <span className="text-blue-400">streamText</span>({"{"}{"\n"}
                                            <span className="text-muted-foreground/40">5</span>{"    "}model: <span className="text-blue-400">cencori</span>(<span className="text-emerald-400">&apos;gpt-4o&apos;</span>),{"\n"}
                                            <span className="text-muted-foreground/40">6</span>{"    "}messages,{"\n"}
                                            <span className="text-muted-foreground/40">7</span>{"  "}{"}"});
                                        </code>
                                    </pre>
                                </div>
                            </Reveal>
                        </div>
                    </div>
                </section>

                {/* ━━━ BUILD WITH ━━━ */}
                <section className="bg-background border-b border-border/30">
                    <div className="mx-auto max-w-6xl border-x border-border/30 relative px-6 sm:px-12 py-24 sm:py-32">
                        <div className="absolute -top-1.5 -left-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
                        <div className="absolute -top-1.5 -right-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
                        <div className="absolute -bottom-1.5 -left-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
                        <div className="absolute -bottom-1.5 -right-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>

                        <div className="max-w-2xl mx-auto text-center">
                            <Reveal>
                                <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground mb-12">Build with your favorite tools</p>
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
                                        <div key={tool.name} className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors duration-300 cursor-default">
                                            <tool.Logo className="h-5 w-5 opacity-40 group-hover:opacity-90 transition-opacity duration-300" size={20} />
                                            <span className="text-[15px] font-medium">{tool.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </Reveal>
                            <Reveal delay={0.1}>
                                <p className="text-xs text-muted-foreground/50 mt-12 leading-relaxed">
                                    Works with your editor, your framework, your stack. No migration required.
                                </p>
                            </Reveal>
                        </div>
                    </div>
                </section>

                {/* ━━━ BILL YOUR USERS ━━━ */}
                <section className="bg-background border-b border-border/30">
                    <div className="mx-auto max-w-6xl border-x border-border/30 relative px-6 sm:px-12 py-24 sm:py-32">
                        <div className="absolute -top-1.5 -left-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
                        <div className="absolute -top-1.5 -right-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
                        <div className="absolute -bottom-1.5 -left-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
                        <div className="absolute -bottom-1.5 -right-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>

                        <Reveal>
                            <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground mb-4">Monetize your AI</p>
                        </Reveal>
                        <Reveal delay={0.05}>
                            <h2 className="text-3xl sm:text-[2.75rem] font-semibold tracking-[-0.03em] leading-[1.1] mb-6 max-w-xl">
                                Bill your users
                                <br />
                                <span className="text-muted-foreground">for every token.</span>
                            </h2>
                        </Reveal>
                        <Reveal delay={0.1}>
                            <p className="text-muted-foreground text-sm leading-[1.7] max-w-lg mb-16">
                                Cencori handles metering, rate limits, and Stripe Connect payouts. You set the markup — we do the rest.
                            </p>
                        </Reveal>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            {[
                                { icon: DollarSign, title: "Markup pricing", desc: "Set your margin on every model. Charge $0.01 for a request that costs you $0.002. The markup is automatic." },
                                { icon: CreditCard, title: "Stripe Connect", desc: "Users pay you via Stripe. Cencori handles the metering and invoicing. No PCI paperwork, no billing code." },
                                { icon: Users, title: "Per-user budgets", desc: "Set rate limits and spending caps per user. Prevent one customer from blowing through your entire margin." },
                                { icon: BarChart3, title: "Usage analytics", desc: "See exactly how much each user is consuming, in real time. Drill down by model, endpoint, and day." },
                            ].map((item, i) => (
                                <Reveal key={item.title} delay={i * 0.05}>
                                    <div className="group p-6 border border-border/20 rounded-lg cursor-default hover:border-border/50 transition-colors duration-500">
                                        <div className="mb-4 inline-flex items-center justify-center w-8 h-8 rounded-lg bg-foreground/5 text-foreground group-hover:text-emerald-500 transition-colors">
                                            <item.icon className="h-4 w-4" />
                                        </div>
                                        <h3 className="text-sm font-medium mb-2">{item.title}</h3>
                                        <p className="text-[13px] text-muted-foreground leading-[1.7]">{item.desc}</p>
                                    </div>
                                </Reveal>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ━━━ CTA ━━━ */}
                <section className="bg-background">
                    <div className="mx-auto max-w-6xl border-x border-border/30 relative px-6 sm:px-12 py-28 sm:py-36 text-center">
                        <div className="absolute -top-1.5 -left-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
                        <div className="absolute -top-1.5 -right-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
                        <div className="absolute -bottom-1.5 -left-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>
                        <div className="absolute -bottom-1.5 -right-1.5 flex h-3 w-3 items-center justify-center text-muted-foreground/40 font-mono text-[10px] select-none pointer-events-none">+</div>

                        <Reveal>
                            <h2 className="text-3xl sm:text-[2.75rem] font-semibold tracking-[-0.03em] leading-[1.1] mb-5">
                                Your AI app deserves
                                <br />
                                <span className="text-muted-foreground">better than boilerplate.</span>
                            </h2>
                        </Reveal>
                        <Reveal delay={0.05}>
                            <p className="text-muted-foreground text-sm leading-[1.7] mb-10 max-w-md mx-auto">
                                Scaffold a production-ready app in one command. Free to start, pay when you scale.
                            </p>
                        </Reveal>
                        <Reveal delay={0.1}>
                            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                <Link href="/login">
                                    <Button size="sm" className="h-7 text-xs px-3 bg-foreground text-background hover:bg-foreground/90">
                                        Start Building Free <ArrowRight className="ml-1.5 h-3 w-3" />
                                    </Button>
                                </Link>
                                <Link href="/pricing">
                                    <Button variant="outline" size="sm" className="h-7 text-xs px-3">
                                        View Pricing
                                    </Button>
                                </Link>
                            </div>
                        </Reveal>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}
