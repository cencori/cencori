"use client";

import React from "react";
import { Reveal } from "@/components/landing/Reveal";
import { Users } from "lucide-react";
import Link from "next/link";

const visionSteps = [
    {
        time: "Today",
        title: "Frontier Foundation",
        description: "Research labs train frontier models on Cencori Compute. Startups ship world-class AI products on Cencori's full stack. Enterprises route billions of AI requests through Cencori's Gateway.",
        textColor: "text-primary"
    },
    {
        time: "3–5 Years",
        title: "Physical Scaling",
        description: "Owned GPU infrastructure. Africa data centers. Proprietary inference chip for edge deployment in robots, medical devices, and autonomous systems.",
        textColor: "text-purple-400"
    },
    {
        time: "10+ Years",
        title: "The Bell Labs of Intelligence",
        description: "A physical builder campus — the Bell Labs of the intelligence era. The place where the world's best engineers come to build the future.",
        textColor: "text-emerald-400"
    }
];

export const LongGame = () => {
    return (
        <section className="py-24 sm:py-32 bg-background relative overflow-hidden border-t border-border/10">
            <div className="max-w-screen-xl mx-auto px-4 md:px-6 relative z-10">
                
                {/* Header */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start mb-20 sm:mb-24">
                    <div className="lg:col-span-5">
                        <Reveal>
                            <span className="mb-4 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-primary">
                                The Long Game
                            </span>
                        </Reveal>
                        <Reveal delay={0.05}>
                            <h2 className="text-3xl sm:text-[2.75rem] font-heading font-black leading-[1.05] tracking-[-0.03em] text-foreground text-balance">
                                Intelligence infrastructure for every era that follows.
                            </h2>
                        </Reveal>
                    </div>

                    <div className="lg:col-span-7">
                        <Reveal delay={0.1}>
                            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                                AI might be a bubble. But intelligence — the capacity of systems to perceive, reason, decide, and act — is the direction of all technology. Whether the medium is neural networks, quantum computing, or something we can&apos;t name yet, thinking systems will always need infrastructure.
                            </p>
                        </Reveal>
                        <Reveal delay={0.15}>
                            <p className="mt-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
                                Cencori builds that infrastructure regardless of which technology powers intelligence in any given era.
                            </p>
                        </Reveal>
                    </div>
                </div>

                {/* Minimal Columns (No cards, no icons) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 sm:gap-16 pt-12 border-t border-border/40 relative">
                    {visionSteps.map((step, index) => (
                        <Reveal key={step.time} delay={0.2 + index * 0.08}>
                            <div className="space-y-4">
                                {/* Time marker */}
                                <div className="flex items-center gap-2">
                                    <span className={`font-mono text-xs uppercase tracking-[0.2em] font-bold ${step.textColor}`}>
                                        {step.time}
                                    </span>
                                    <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/30">
                                        // Phase 0{index + 1}
                                    </span>
                                </div>

                                {/* Title */}
                                <h3 className="text-lg sm:text-xl font-bold tracking-tight text-foreground font-heading">
                                    {step.title}
                                </h3>
                                
                                {/* Description */}
                                <p className="text-sm text-muted-foreground leading-[1.7]">
                                    {step.description}
                                </p>
                            </div>
                        </Reveal>
                    ))}
                </div>

                {/* Discord Community Callout */}
                <div className="mt-20 sm:mt-24 text-center border-t border-border/10 pt-12">
                    <Reveal delay={0.45}>
                        <p className="mb-4 text-xs font-mono tracking-widest uppercase text-muted-foreground/60">
                            Join our community to be a part
                        </p>
                    </Reveal>
                    <Reveal delay={0.5}>
                        <Link 
                            href="/discord" 
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground transition-all duration-300 hover:text-primary group"
                        >
                            <Users className="size-4 shrink-0 transition-transform duration-300 group-hover:scale-105" />
                            <span>Connect on Discord →</span>
                        </Link>
                    </Reveal>
                </div>

            </div>
        </section>
    );
};
