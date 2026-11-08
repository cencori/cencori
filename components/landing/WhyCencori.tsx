"use client";

import React from "react";
import { Reveal } from "@/components/landing/Reveal";
import { Layers, Flame, Target, Infinity } from "lucide-react";

const pillars = [
    {
        title: "Compounding Integration",
        description: "Start with the Gateway. Add Compute when you train models. Add Memory when you need persistence. Add Billing when you need to monetize. Each product works standalone — and works exponentially better together.",
        icon: Layers,
        color: "text-orange-400 bg-orange-500/10 border-orange-500/20"
    },
    {
        title: "Nobody Else Has the Full Stack",
        description: "Stitching together four separate vendors to build one AI product is an engineering tax. Cencori is the unified backend layer. When customers grow, Cencori grows. Zero incremental sales motion.",
        icon: Flame,
        color: "text-purple-400 bg-purple-500/10 border-purple-500/20"
    },
    {
        title: "Built for the Intelligence Era",
        description: "Designed from day one for intelligent systems — not general-purpose legacy cloud with AI features bolted on top as an afterthought.",
        icon: Target,
        color: "text-blue-400 bg-blue-500/10 border-blue-500/20"
    },
    {
        title: "From Call One to One Billion",
        description: "A highly resilient infrastructure layer that handles sub-100ms routing latency, real-time security scanning, and seamless billing metering at enterprise scale.",
        icon: Infinity,
        color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
    }
];

export const WhyCencori = () => {
    return (
        <section className="py-24 sm:py-32 bg-background relative overflow-hidden border-t border-border/10">
            <div className="max-w-screen-xl mx-auto px-4 md:px-6 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
                    
                    {/* Left Column: Header */}
                    <div className="lg:col-span-4 lg:sticky lg:top-28">
                        <Reveal>
                            <span className="mb-4 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-primary">
                                Why Cencori
                            </span>
                        </Reveal>

                        <Reveal delay={0.05}>
                            <h2 className="text-3xl sm:text-[2.75rem] font-heading font-black leading-[1.05] tracking-[-0.03em] mb-6 text-foreground">
                                Switching costs <br />
                                <span className="font-serif italic font-normal text-muted-foreground">that compound.</span>
                            </h2>
                        </Reveal>

                        <Reveal delay={0.1}>
                            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-sm">
                                As your product matures, Cencori grows with you. Stop rewriting backend code or managing raw API credentials. Build on infrastructure that lasts.
                            </p>
                        </Reveal>
                    </div>

                    {/* Right Column: 4 Pillars Grid */}
                    <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {pillars.map((pillar, index) => {
                            const Icon = pillar.icon;
                            return (
                                <Reveal key={pillar.title} delay={0.15 + index * 0.05}>
                                    <div className="group rounded-2xl border border-border/40 bg-foreground/[0.01] p-6 hover:border-foreground/20 hover:bg-foreground/[0.02] transition-all duration-300 h-full flex flex-col justify-between">
                                        <div>
                                            <div className={`p-2 rounded-lg shrink-0 h-9 w-9 flex items-center justify-center border mb-6 transition-transform duration-300 group-hover:scale-105 ${pillar.color}`}>
                                                <Icon className="size-4.5" />
                                            </div>
                                            <h3 className="text-sm font-semibold text-foreground mb-3 font-heading">
                                                {pillar.title}
                                            </h3>
                                            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                                                {pillar.description}
                                            </p>
                                        </div>
                                    </div>
                                </Reveal>
                            );
                        })}
                    </div>

                </div>
            </div>
        </section>
    );
};
