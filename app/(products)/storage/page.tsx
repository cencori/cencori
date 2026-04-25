"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
    ArrowRightIcon,
    CircleStackIcon,
    BookOpenIcon,
    DocumentTextIcon,
    MagnifyingGlassIcon,
    CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";

import Navbar from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { CTA } from "@/components/landing/CTA";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

// The 4 core pillars of Data Storage
const pillars = [
    {
        id: "vector",
        title: "Vector Database",
        tagline: "Semantic search at scale",
        description: "High-performance vector storage for embeddings. Semantic search, similarity matching, and hybrid queries.",
        icon: CircleStackIcon,
        color: "amber",
        features: ["Billion-scale vectors", "Sub-10ms queries", "Hybrid search"],
    },
    {
        id: "knowledge",
        title: "Knowledge Base",
        tagline: "Structured AI memory",
        description: "Organize and retrieve knowledge for your AI. Automatic chunking, indexing, and retrieval.",
        icon: BookOpenIcon,
        color: "emerald",
        features: ["Auto-chunking", "Semantic indexing", "Version control"],
    },
    {
        id: "files",
        title: "File Processing",
        tagline: "PDFs, images, audio",
        description: "Extract, process, and index content from any file type. Built-in OCR, transcription, and parsing.",
        icon: DocumentTextIcon,
        color: "blue",
        features: ["PDF extraction", "Image OCR", "Audio transcription"],
    },
    {
        id: "rag",
        title: "RAG Pipeline",
        tagline: "End-to-end retrieval",
        description: "Complete retrieval-augmented generation pipeline. Ingest, chunk, embed, retrieve, and generate.",
        icon: MagnifyingGlassIcon,
        color: "purple",
        features: ["Smart chunking", "Re-ranking", "Citation tracking"],
    },
];

const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
    amber: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-500" },
    emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-500" },
    blue: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-500" },
    purple: { bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-500" },
};

export default function StoragePage() {
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
                homeUrl="/"
                actions={isAuthenticated ? authenticatedActions : unauthenticatedActions}
                isAuthenticated={isAuthenticated}
                userProfile={isAuthenticated ? userProfile : undefined}
            />

            <main>
                {/* Hero Section */}
                <section className="relative flex flex-col items-center justify-center overflow-hidden bg-background pt-32 pb-20">
                    {/* Background Effects */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/5 via-background to-background pointer-events-none" />

                    <div className="container relative z-10 px-4 md:px-6 flex flex-col items-center text-center">
                        {/* Badge */}
                        <div className="mb-8 animate-appear">
                            <div className="group inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground transition-colors hover:text-foreground">
                                <span>Coming Soon</span>
                            </div>
                        </div>

                        {/* Headline */}
                        <h1 className="mb-8 max-w-3xl text-[3rem] font-heading font-black leading-[0.95] tracking-[-0.02em] animate-appear sm:text-[4.5rem] lg:text-[5.5rem] text-foreground">
                            <span className="font-serif italic font-normal text-muted-foreground">Data Storage.</span>
                        </h1>

                        {/* Subheadline */}
                        <p className="mb-10 max-w-[38rem] text-base leading-[1.7] text-muted-foreground animate-appear [animation-delay:200ms]">
                            Vector database for AI. Built for RAG, knowledge bases, and semantic search.
                        </p>

                        {/* CTAs */}
                        <div className="mb-10 flex flex-wrap items-center justify-center gap-3 animate-appear [animation-delay:300ms]">
                            <Link href="/signup">
                                <Button size="default" className="h-8 px-4 text-xs font-medium rounded-md bg-foreground text-background hover:bg-foreground/90 transition-all">
                                    Join the Waitlist
                                </Button>
                            </Link>
                            <Link href="/docs">
                                <Button variant="outline" size="default" className="h-8 px-4 text-xs font-medium rounded-md border-foreground/20 hover:bg-foreground/5 hover:border-foreground/40 transition-all">
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
                                The data layer <span className="text-muted-foreground">for AI</span>
                            </h2>
                            <p className="text-base text-muted-foreground max-w-xl">
                                From vector storage to complete RAG pipelines, everything you need for AI memory.
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
                                { value: "1B+", label: "Vectors Supported" },
                                { value: "<10ms", label: "Query Latency" },
                                { value: "50+", label: "File Formats" },
                                { value: "99.99%", label: "Uptime SLA" },
                            ].map((stat) => (
                                <div key={stat.label} className="text-center">
                                    <div className="text-2xl md:text-3xl font-bold tracking-tighter mb-1">{stat.value}</div>
                                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <CTA isAuthenticated={isAuthenticated} />
            </main>

            <Footer />
        </div>
    );
}
