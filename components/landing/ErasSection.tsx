"use client";

import React from "react";
import { Reveal } from "@/components/landing/Reveal";

const eras = [
    {
        name: "Mainframe Era",
        company: "IBM",
        role: "Enterprise computing backbone",
        active: false,
    },
    {
        name: "Internet Era",
        company: "AWS",
        role: "Cloud infrastructure backbone",
        active: false,
    },
    {
        name: "Mobile Era",
        company: "Stripe + Twilio",
        role: "Mobile economy backbone",
        active: false,
    },
    {
        name: "Intelligence Era",
        company: "Cencori",
        role: "Intelligence backbone",
        active: true,
    },
];

export const ErasSection = () => {
    return (
        <section className="py-24 sm:py-32 bg-background relative overflow-hidden border-t border-border/10">
            <div className="max-w-screen-xl mx-auto px-4 md:px-6 relative z-10">
                
                {/* WHAT WE'RE BUILDING Section */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start mb-24">
                    <div className="lg:col-span-5">
                        <Reveal>
                            <span className="mb-4 inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground/60">
                                What We&apos;re Building
                            </span>
                        </Reveal>
                        <Reveal delay={0.05}>
                            <h2 className="text-3xl sm:text-[2.75rem] font-heading font-black leading-[1.05] tracking-[-0.03em] text-foreground text-balance">
                                AI infrastructure.<br />
                                <span className="font-serif italic font-normal text-muted-foreground">From model to production.</span>
                            </h2>
                        </Reveal>
                    </div>

                    <div className="lg:col-span-7 space-y-6">
                        <Reveal delay={0.1}>
                            <p className="text-base text-muted-foreground leading-[1.7]">
                                The intelligence era is here. Every company building with AI is facing the same problem: the infrastructure doesn&apos;t exist yet. There&apos;s no AWS for intelligence. No Stripe for AI billing. No unified stack for the builder going from idea to intelligent product.
                            </p>
                        </Reveal>
                        <Reveal delay={0.15}>
                            <p className="text-base text-muted-foreground leading-[1.7]">
                                Cencori is building that infrastructure. Not a tool. Not a wrapper. The complete platform — gateway, compute, memory, billing, deployment, workflow — unified under one roof, designed from the ground up for intelligent systems.
                            </p>
                        </Reveal>
                    </div>
                </div>

                {/* ERA TIMELINE SECTION */}
                <div className="flex flex-col items-center text-center mb-16 sm:mb-20">
                    <Reveal>
                        <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground/60">
                            The Paradigm Shift
                        </p>
                    </Reveal>
                    <Reveal delay={0.05}>
                        <h3 className="max-w-3xl text-2xl sm:text-4xl font-heading font-black leading-[1.1] tracking-[-0.02em] text-foreground">
                            Every era produces one infrastructure company.
                        </h3>
                    </Reveal>
                </div>

                <div className="relative max-w-5xl mx-auto mt-16">
                    {/* Architectural Dashed Line (Horizontal for Desktop) */}
                    <div className="hidden md:block absolute top-4 left-4 right-4 h-[1px] border-t border-dashed border-border/40" />
                    
                    {/* Architectural Dashed Line (Vertical for Mobile) */}
                    <div className="block md:hidden absolute top-4 bottom-4 left-4 w-[1px] border-l border-dashed border-border/40" />

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-4 relative z-10">
                        {eras.map((era, index) => (
                            <Reveal key={era.name} delay={0.1 + index * 0.08}>
                                <div className="relative flex flex-col pt-0 pl-12 pb-4 md:pt-12 md:pl-4 md:px-4 md:pb-6">
                                    {/* Timeline Node - Diamond */}
                                    <div className="absolute top-2 md:top-4 left-4 -translate-y-1/2 -translate-x-1/2 flex items-center justify-center">
                                        <div className={`size-3 rotate-45 border transition-all duration-500 ${era.active ? "bg-primary border-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.4)]" : "bg-background border-border/50"}`} />
                                    </div>

                                    <div>
                                        <div className="font-mono text-[10px] uppercase tracking-[0.2em] mb-2 md:mb-3 text-muted-foreground/45">
                                            {era.name}
                                        </div>
                                        <h4 className={`text-lg sm:text-xl font-heading font-semibold mb-2 ${era.active ? "text-foreground" : "text-foreground/80"}`}>
                                            {era.company}
                                        </h4>
                                        <p className="text-xs sm:text-sm text-muted-foreground leading-[1.6]">
                                            {era.role}
                                        </p>
                                    </div>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};
