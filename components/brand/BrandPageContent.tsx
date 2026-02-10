"use client";

import { Button } from "@/components/ui/button";
import { Download, Check, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Logo } from "@/components/logo";
import { siteConfig } from "@/config/site";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function BrandPageContent() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [userProfile, setUserProfile] = useState<{ name: string | null; avatar: string | null }>({ name: null, avatar: null });

    useEffect(() => {
        const checkUser = async () => {
            const { data, error } = await supabase.auth.getSession();
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
        {
            text: "Get Started",
            href: siteConfig.links.getStartedUrl,
            isButton: true,
            variant: "default",
        },
    ];

    const authenticatedActions = [
        {
            text: "Dashboard",
            href: "/dashboard/organizations",
            isButton: true,
            variant: "default",
        },
        {
            text: userProfile.name || "User",
            href: "#",
            isButton: false,
            isAvatar: true,
            avatarSrc: userProfile.avatar,
            avatarFallback: (userProfile.name || "U").slice(0, 2).toUpperCase(),
        },
    ];

    return (
        <div className="min-h-screen bg-black text-foreground selection:bg-purple-500/30 selection:text-purple-200 font-sans">
            <Navbar
                logo={<Logo variant="mark" className="h-4" />}
                name="cencori"
                homeUrl="/"
                actions={isAuthenticated ? authenticatedActions : unauthenticatedActions}
                isAuthenticated={isAuthenticated}
                userProfile={isAuthenticated ? userProfile : undefined}
            />

            <main className="container mx-auto max-w-6xl pt-24 pb-32 md:pb-32 px-4 flex flex-col items-center justify-center relative z-10">

                {/* Announcement Badge */}
                <div className="mb-8 animate-appear flex flex-col items-center">
                    <div className="inline-flex items-center rounded-full border border-foreground/10 bg-foreground/5 px-3 py-1 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground">
                        <span className="flex h-2 w-2 rounded-full bg-purple-500 mr-2 animate-pulse" />
                        <span className="mr-2">Official Assets</span>
                    </div>
                </div>

                {/* Headline */}
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter mb-6 max-w-4xl text-center animate-appear [animation-delay:100ms] text-transparent bg-clip-text bg-gradient-to-b from-foreground to-foreground/50">
                    Brand Assets
                </h1>

                {/* Subheadline */}
                <p className="text-lg md:text-xl text-muted-foreground/80 max-w-xl text-center mb-10 animate-appear [animation-delay:200ms] leading-relaxed">
                    Download official Cencori logos and marks. Please use these according to our guidelines to maintain consistency.
                </p>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row gap-3 animate-appear [animation-delay:300ms] items-center">
                    <Link href="/cencori-brand-assets.zip" download>
                        <Button size="default" className="h-7 px-3 text-[11px] font-medium rounded-full bg-foreground text-background hover:bg-foreground/90 transition-all shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] dark:shadow-[0_0_20px_-5px_rgba(255,255,255,0.1)]">
                            <Download className="mr-2 h-3 w-3" />
                            Download Asset Kit (.zip)
                        </Button>
                    </Link>
                    <Link href="/design">
                        <Button variant="outline" size="default" className="h-7 px-3 text-[11px] font-medium rounded-full border-foreground/20 text-muted-foreground hover:text-foreground hover:bg-foreground/5 hover:border-foreground/40 transition-all">
                            View Design System
                        </Button>
                    </Link>
                </div>

                <div className="mt-20 w-full grid gap-20 px-4">
                    {/* Logomark Section */}
                    <section className="space-y-8">
                        <div className="flex flex-col items-center text-center gap-4 border-b border-white/10 pb-6">
                            <div>
                                <h2 className="text-3xl font-semibold tracking-tight text-white mb-2">Logomark</h2>
                                <p className="text-zinc-400">The standalone symbol. Use for avatars, icons, or constrained spaces.</p>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Dark Mode Variant (White Logo) */}
                            <div className="group rounded-3xl border border-white/10 bg-zinc-900/40 overflow-hidden transition-all duration-300 hover:border-purple-500/30 hover:shadow-2xl hover:shadow-purple-500/10">
                                <div className="aspect-[4/3] relative flex items-center justify-center bg-[#050505] bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px]">
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                                    <div className="relative w-32 h-32 transition-transform duration-500 group-hover:scale-110 drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                                        <Image
                                            src="/logo white.svg"
                                            alt="Cencori Logo White"
                                            fill
                                            className="object-contain"
                                        />
                                    </div>
                                    <div className="absolute bottom-4 left-4">
                                        <div className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/5 text-[10px] font-mono text-zinc-400">
                                            on-dark
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6 border-t border-white/5 bg-zinc-900/60 backdrop-blur-xl flex items-center justify-between">
                                    <div>
                                        <h3 className="font-medium text-white">White Logomark</h3>
                                        <p className="text-xs text-zinc-500 font-mono mt-1">SVG / PNG</p>
                                    </div>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white" asChild>
                                        <a href="/logo white.svg" download>
                                            <Download className="h-4 w-4" />
                                        </a>
                                    </Button>
                                </div>
                            </div>

                            {/* Light Mode Variant (Black Logo) */}
                            <div className="group rounded-3xl border border-white/10 bg-zinc-900/40 overflow-hidden transition-all duration-300 hover:border-purple-500/30 hover:shadow-2xl hover:shadow-purple-500/10">
                                <div className="aspect-[4/3] relative flex items-center justify-center bg-white relative">
                                    <div className="relative w-32 h-32 transition-transform duration-500 group-hover:scale-110 drop-shadow-xl">
                                        <Image
                                            src="/logo black.svg"
                                            alt="Cencori Logo Black"
                                            fill
                                            className="object-contain"
                                        />
                                    </div>
                                    <div className="absolute bottom-4 left-4">
                                        <div className="px-3 py-1 rounded-full bg-black/5 backdrop-blur-md border border-black/5 text-[10px] font-mono text-zinc-500">
                                            on-light
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6 border-t border-white/5 bg-zinc-900/60 backdrop-blur-xl flex items-center justify-between">
                                    <div>
                                        <h3 className="font-medium text-white">Black Logomark</h3>
                                        <p className="text-xs text-zinc-500 font-mono mt-1">SVG / PNG</p>
                                    </div>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white" asChild>
                                        <a href="/logo black.svg" download>
                                            <Download className="h-4 w-4" />
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Wordmark Section */}
                    <section className="space-y-8">
                        <div className="flex flex-col items-center text-center gap-4 border-b border-white/10 pb-6">
                            <div>
                                <h2 className="text-3xl font-semibold tracking-tight text-white mb-2">Wordmark</h2>
                                <p className="text-zinc-400">The full brand name. Use for headers, partnerships, and primary branding.</p>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Dark Mode Variant (White Wordmark) */}
                            <div className="group rounded-3xl border border-white/10 bg-zinc-900/40 overflow-hidden transition-all duration-300 hover:border-purple-500/30 hover:shadow-2xl hover:shadow-purple-500/10">
                                <div className="aspect-[2/1] relative flex items-center justify-center bg-[#050505] bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px]">
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                                    <div className="relative w-56 h-16 transition-transform duration-500 group-hover:scale-105 drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                                        <Image
                                            src="/wordmark white.svg"
                                            alt="Cencori Wordmark White"
                                            fill
                                            className="object-contain"
                                        />
                                    </div>
                                    <div className="absolute bottom-4 left-4">
                                        <div className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/5 text-[10px] font-mono text-zinc-400">
                                            on-dark
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6 border-t border-white/10 bg-zinc-900/60 backdrop-blur-xl flex items-center justify-between">
                                    <div>
                                        <h3 className="font-medium text-white">White Wordmark</h3>
                                        <p className="text-xs text-zinc-500 font-mono mt-1">SVG / PNG</p>
                                    </div>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white" asChild>
                                        <a href="/wordmark white.svg" download>
                                            <Download className="h-4 w-4" />
                                        </a>
                                    </Button>
                                </div>
                            </div>

                            {/* Light Mode Variant (Black Wordmark) */}
                            <div className="group rounded-3xl border border-white/10 bg-zinc-900/40 overflow-hidden transition-all duration-300 hover:border-purple-500/30 hover:shadow-2xl hover:shadow-purple-500/10">
                                <div className="aspect-[2/1] relative flex items-center justify-center bg-white">
                                    <div className="relative w-56 h-16 transition-transform duration-500 group-hover:scale-105 drop-shadow-xl">
                                        <Image
                                            src="/wordmark black.svg"
                                            alt="Cencori Wordmark Black"
                                            fill
                                            className="object-contain"
                                        />
                                    </div>
                                    <div className="absolute bottom-4 left-4">
                                        <div className="px-3 py-1 rounded-full bg-black/5 backdrop-blur-md border border-black/5 text-[10px] font-mono text-zinc-500">
                                            on-light
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6 border-t border-white/5 bg-zinc-900/60 backdrop-blur-xl flex items-center justify-between">
                                    <div>
                                        <h3 className="font-medium text-white">Black Wordmark</h3>
                                        <p className="text-xs text-zinc-500 font-mono mt-1">SVG / PNG</p>
                                    </div>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white" asChild>
                                        <a href="/wordmark black.svg" download>
                                            <Download className="h-4 w-4" />
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </main>

            <Footer />
        </div>
    );
}
