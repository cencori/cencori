"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Reveal } from "@/components/landing/Reveal";
import { partners } from "@/config/partners";
import { Search, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export default function PartnersIndexPage() {
    const [searchQuery, setSearchQuery] = useState("");
    
    // For now, let's just use the partners from config
    const partnerList = Object.values(partners);
    
    const filteredPartners = partnerList.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const navActions = [
        { text: "Sign in", href: "/login", isButton: false },
        { text: "Get Started", href: "/signup", isButton: true, variant: "default" as const },
    ];

    return (
      <main className="pt-32 pb-24">
                <div className="mx-auto max-w-6xl px-4 md:px-6">
                    {/* Header */}
                    <div className="mb-20 flex items-center justify-between gap-12">
                    <div className="min-w-0 flex-1">
                        <Reveal>
                            <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground mb-8">
                                Partners Network
                            </p>
                        </Reveal>
                        <Reveal delay={0.05}>
                            <h1 className="text-[2.75rem] sm:text-[4rem] font-semibold tracking-[-0.04em] leading-[1.05] mb-8">
                                Find a Partner
                            </h1>
                        </Reveal>
                        <Reveal delay={0.1}>
                            <p className="text-base sm:text-lg text-muted-foreground leading-[1.7] max-w-xl mb-12">
                                Discover the tools, platforms, and teams that integrate with Cencori to help you ship AI applications faster.
                            </p>
                        </Reveal>
                        
                        <Reveal delay={0.15}>
                            <div className="flex flex-col sm:flex-row gap-4 items-center">
                                <div className="relative w-full max-w-md">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <input 
                                        type="text"
                                        placeholder="Search partners..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-foreground/[0.02] border border-border/40 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
                                    />
                                </div>
                            </div>
                        </Reveal>
                    </div>

                    {/* Cencori | your company lockup */}
                    <Reveal delay={0.2}>
                        {/* Construction guides: dashed lines along each logo's
                            edges, running past the lockup like a logo sheet. */}
                        <div className="relative hidden lg:block px-5 py-6 mr-4" aria-hidden="true">
                            <span className="pointer-events-none absolute inset-x-0 top-6 border-t border-dashed border-foreground/20" />
                            <span className="pointer-events-none absolute inset-x-0 bottom-6 border-t border-dashed border-foreground/20" />
                            <div className="flex h-5 items-center gap-6">
                                <span className="relative flex h-full items-center">
                                    <span className="pointer-events-none absolute -inset-y-6 left-0 border-l border-dashed border-foreground/20" />
                                    <span className="pointer-events-none absolute -inset-y-6 right-0 border-l border-dashed border-foreground/20" />
                                    <Logo variant="wordmark" className="h-5" />
                                </span>
                                <span className="h-10 w-px bg-foreground/30" />
                                <span className="relative flex h-full items-center">
                                    <span className="pointer-events-none absolute -inset-y-6 left-0 border-l border-dashed border-foreground/20" />
                                    <span className="pointer-events-none absolute -inset-y-6 right-0 border-l border-dashed border-foreground/20" />
                                    <span className="text-[1.75rem] leading-none font-medium tracking-tight text-foreground/40">
                                        Acme Co.
                                    </span>
                                </span>
                            </div>
                        </div>
                    </Reveal>
                    </div>

                    {/* Partners Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border/20 border border-border/20">
                        {filteredPartners.length > 0 ? (
                            filteredPartners.map((partner, i) => (
                                <Reveal key={partner.slug} delay={i * 0.05}>
                                    <Link 
                                        href={`/partners/${partner.slug}`}
                                        className="group relative bg-background p-8 hover:bg-foreground/[0.01] transition-colors h-full flex flex-col"
                                    >
                                        <div className="flex justify-between items-start mb-12">
                                            <div className={`${partner.logoWide ? "h-10 w-36 py-1.5 justify-start" : "h-10 w-10 justify-center"} text-foreground group-hover:scale-110 transition-transform duration-500 flex items-center`}>
                                                {partner.logo ? (
                                                    <partner.logo className="h-full w-full object-contain" />
                                                ) : (
                                                    <div className="h-full w-full bg-foreground/5" />
                                                )}
                                            </div>
                                            <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                                        </div>
                                        <h3 className="text-lg font-medium mb-3">{partner.name}</h3>
                                        <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                                            {partner.hero.subtitle}
                                        </p>
                                    </Link>
                                </Reveal>
                            ))
                        ) : (
                            <div className="col-span-full py-32 text-center bg-background">
                                <p className="text-sm text-muted-foreground italic">No partners found matching "{searchQuery}"</p>
                                <p className="text-xs text-muted-foreground/60 mt-2">Try searching for "Cursor" or "Claude" (once they're added)</p>
                            </div>
                        )}
                        
                    </div>

                    {/* Become a partner */}
                    <Reveal delay={0.2}>
                        <div className="relative mt-20 flex min-h-[360px] items-center justify-center overflow-hidden rounded-2xl bg-white/[0.06] px-6 py-16 text-center sm:min-h-[420px] sm:py-20">
                            <div className="relative z-10 mx-auto max-w-xl">
                                <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                                    Become a Partner.
                                </h2>
                                <p className="mt-4 text-base text-muted-foreground text-balance">
                                    Integrate your tool with Cencori and reach thousands of AI engineers.
                                </p>
                                <div className="mt-8 flex flex-row items-center justify-center gap-3">
                                    <Button asChild className="group h-10 rounded-full pr-2 pl-5 text-sm font-semibold">
                                        <Link href="/contact">
                                            Get in touch
                                            <HugeiconsIcon
                                                className="transition-transform duration-200 group-hover:translate-x-0.5"
                                                color="currentColor"
                                                icon={ArrowRight01Icon}
                                                size={14}
                                                strokeWidth={1.9}
                                            />
                                        </Link>
                                    </Button>
                                    <Button asChild className="h-10 rounded-full px-5 text-sm font-semibold" variant="outline">
                                        <Link href="/docs">Read the docs</Link>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Reveal>
                </div>
            </main>
    );
}
