"use client";

import React from "react";
import { Reveal } from "@/components/landing/Reveal";
import { IsoStack } from "@/components/landing/IsoStack";
import { GatewayGraphic } from "@/components/landing/GatewayGraphic";
import { MemoryGraphic } from "@/components/landing/MemoryGraphic";
import { Cpu, Network, Database, Workflow, CreditCard } from "lucide-react";

const layers = [
    {
        name: "Compute",
        description: "The foundation. Access on-demand GPUs for fine-tuning and hosting custom models without leaving your environment.",
        icon: Cpu,
        gradient: "from-foreground/10 to-foreground/0",
        color: "text-foreground"
    },
    {
        name: "AI Gateway",
        description: "Universal routing to OpenAI, Anthropic, Gemini, or custom models with built-in fallbacks, caching, and rate limiting.",
        icon: Network,
        gradient: "from-orange-500/20 to-red-500/0",
        color: "text-orange-500"
    },
    {
        name: "Persistent Memory",
        description: "Native RAG and vector storage so your intelligent systems remember users, documents, and context across sessions.",
        icon: Database,
        gradient: "from-purple-500/20 to-fuchsia-500/0",
        color: "text-purple-500"
    },
    {
        name: "Agentic Workflows",
        description: "Multi-step reasoning and tool-calling orchestration to build agents that actually execute tasks autonomously.",
        icon: Workflow,
        gradient: "from-blue-500/20 to-cyan-500/0",
        color: "text-blue-500"
    },
    {
        name: "Deployment",
        description: "Enterprise-grade hosting. Deploy massive custom models to dedicated serverless endpoints and host your full-stack AI applications on a global edge network.",
        icon: Workflow, // Not used in the UI anymore, but keeping for structural consistency
        gradient: "from-yellow-500/20 to-amber-500/0",
        color: "text-yellow-500"
    },
    {
        name: "Monetization Layer",
        description: "Built-in end-user billing. Meter usage, set margins, and charge your customers automatically via Stripe.",
        icon: CreditCard,
        gradient: "from-green-500/20 to-emerald-500/0",
        color: "text-green-500"
    }
];

export const FullStack = () => {
    return (
        <section className="py-24 sm:py-32 bg-background relative overflow-hidden">
            <div className="max-w-screen-xl mx-auto px-4 md:px-6 relative z-10">
                <div className="flex flex-col items-center text-center mb-16 sm:mb-24">
                    <Reveal delay={0.1}>
                        <h2 className="max-w-4xl text-[2.5rem] sm:text-[3.5rem] md:text-[4.5rem] font-heading font-black leading-[1.05] tracking-[-0.02em] text-foreground text-balance">
                            You bring the vision.<br />
                            <span className="font-serif italic font-normal text-muted-foreground">We provide the infrastructure.</span>
                        </h2>
                    </Reveal>
                    <Reveal delay={0.2}>
                        <p className="mt-8 text-base text-muted-foreground max-w-2xl leading-[1.7]">
                            Don't stitch together six different vendors to build one AI product. Cencori is the only platform that provides the complete stack—from raw compute to end-user billing.
                        </p>
                    </Reveal>
                </div>

                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-16 relative">
                    {layers.map((layer, index) => (
                        <Reveal key={layer.name} delay={0.2 + index * 0.1}>
                            <div className="group relative flex flex-col items-start gap-4 transition-all duration-500 hover:translate-x-3">
                                <div className="flex items-center gap-4 w-full">
                                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50 transition-colors duration-500 group-hover:text-muted-foreground">
                                        Layer 0{index + 1}
                                    </span>
                                    <div className="h-[1px] flex-1 bg-border/20 transition-colors duration-500 group-hover:bg-border/60" />
                                </div>

                                {/* Infrastructure Graphics - Hidden for now */}
                                {/* {index === 0 && (
                                    <div className="w-full mt-2 mb-1 flex justify-center opacity-80 group-hover:opacity-100 transition-opacity duration-500">
                                        <IsoStack />
                                    </div>
                                )}

                                {index === 1 && (
                                    <div className="w-full mt-2 mb-1 flex justify-center opacity-80 group-hover:opacity-100 transition-opacity duration-500">
                                        <GatewayGraphic />
                                    </div>
                                )}

                                {index === 2 && (
                                    <div className="w-full mt-2 mb-1 flex justify-center opacity-80 group-hover:opacity-100 transition-opacity duration-500">
                                        <MemoryGraphic />
                                    </div>
                                )} */}
                                
                                <div className="mt-2">
                                    <h3 className="text-xl sm:text-2xl font-heading font-semibold text-foreground/70 transition-colors duration-500 group-hover:text-foreground mb-3">
                                        {layer.name}
                                    </h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed transition-colors duration-500 group-hover:text-foreground/80">
                                        {layer.description}
                                    </p>
                                </div>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
};
