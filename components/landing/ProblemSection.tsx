"use client";

import React from "react";
import { Reveal } from "@/components/landing/Reveal";
import { ArrowRight, AlertTriangle, CheckCircle2 } from "lucide-react";

const problems = [
    { id: "routing", label: "Routing", description: "Which model, which provider, which fallback?" },
    { id: "rate-limiting", label: "Rate limiting", description: "How do you prevent abuse?" },
    { id: "cost-control", label: "Cost control", description: "Who spent what, and how much?" },
    { id: "billing", label: "Billing", description: "How do you charge your users?" },
    { id: "compute", label: "Compute", description: "Where does training and inference run?" },
    { id: "memory", label: "Memory", description: "How does your product remember?" },
    { id: "deployment", label: "Deployment", description: "How does it get to production?" },
];

export const ProblemSection = () => {
    return (
        <section className="py-24 sm:py-32 bg-background relative overflow-hidden border-t border-border/10">
            <div className="max-w-screen-xl mx-auto px-4 md:px-6 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
                    
                    {/* Left Column: Heading and 7 Problems List */}
                    <div className="lg:col-span-6 flex flex-col justify-center">
                        <Reveal>
                            <span className="mb-4 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.25em] text-red-500/80">
                                <AlertTriangle className="size-3" />
                                <span>The Infrastructure Tax</span>
                            </span>
                        </Reveal>

                        <Reveal delay={0.05}>
                            <h2 className="text-3xl sm:text-[2.75rem] font-heading font-black leading-[1.05] tracking-[-0.03em] mb-6 text-foreground text-balance">
                                Shipping an AI product shouldn&apos;t take nine months.
                            </h2>
                        </Reveal>

                        <Reveal delay={0.1}>
                            <p className="text-base text-muted-foreground leading-relaxed mb-8 max-w-xl">
                                Before you write a single line of product code, you are forced to solve seven separate infrastructure problems:
                            </p>
                        </Reveal>

                        {/* List of 7 Problems */}
                        <div className="space-y-4 max-w-lg mb-8">
                            {problems.map((problem, index) => (
                                <Reveal key={problem.id} delay={0.15 + index * 0.05}>
                                    <div className="flex items-start gap-3 group">
                                        <div className="size-5 rounded-full border border-border/40 bg-foreground/[0.02] flex items-center justify-center text-[10px] font-mono text-muted-foreground shrink-0 mt-0.5 group-hover:border-foreground/40 group-hover:text-foreground transition-all duration-300">
                                            {index + 1}
                                        </div>
                                        <div>
                                            <span className="font-semibold text-sm text-foreground/90 transition-colors group-hover:text-foreground mr-1.5">
                                                {problem.label}
                                            </span>
                                            <span className="text-sm text-muted-foreground">
                                                — {problem.description}
                                            </span>
                                        </div>
                                    </div>
                                </Reveal>
                            ))}
                        </div>
                    </div>

                    {/* Right Column: Frustration Callout & YouTube Player */}
                    <div className="lg:col-span-6 space-y-8">
                        <Reveal delay={0.3}>
                            <div className="rounded-2xl border border-border/40 bg-foreground/[0.01] p-6 sm:p-8 relative backdrop-blur-sm">
                                <p className="text-base text-muted-foreground leading-relaxed mb-6">
                                    Every problem is a separate tool. A separate contract. A separate engineering sprint. The average team burns <strong className="text-foreground font-semibold">6–9 months of runway</strong> on infrastructure before they build product.
                                </p>
                                
                                <div className="p-4 rounded-xl border border-green-500/10 bg-green-500/[0.02] flex items-center gap-3">
                                    <CheckCircle2 className="size-5 text-green-500 shrink-0" />
                                    <p className="text-sm text-green-400 font-medium">
                                        Cencori solves all of it. In one platform. With one API key.
                                    </p>
                                </div>
                            </div>
                        </Reveal>

                        {/* YouTube Player Container */}
                        <Reveal delay={0.4}>
                            <div className="relative rounded-2xl border border-border bg-card overflow-hidden shadow-2xl aspect-video group">
                                {/* YouTube iframe */}
                                <iframe
                                    src="https://www.youtube.com/embed/Hlw374ZmF5A?si=XqMNS5AwB6EHm7Ic"
                                    title="Cencori Demo Video"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    allowFullScreen
                                    className="absolute inset-0 w-full h-full border-0 z-10"
                                />
                                
                                {/* Overlay glow */}
                                <div className="absolute inset-0 bg-gradient-to-t from-background/30 to-transparent pointer-events-none z-20 opacity-40 group-hover:opacity-20 transition-opacity duration-300" />
                            </div>
                        </Reveal>
                    </div>

                </div>
            </div>
        </section>
    );
};
