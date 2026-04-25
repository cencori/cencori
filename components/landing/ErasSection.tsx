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
        <section className="py-24 sm:py-32 bg-background relative overflow-hidden">
            <div className="max-w-screen-xl mx-auto px-4 md:px-6 relative z-10">
                <div className="flex flex-col items-center text-center mb-16 sm:mb-24">
                    <Reveal>
                        <p className="mb-6 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                            The Intelligence Era
                        </p>
                    </Reveal>
                    <Reveal delay={0.1}>
                        <h2 className="max-w-4xl text-[2.5rem] sm:text-[3.5rem] md:text-[4.5rem] font-heading font-black leading-[1.05] tracking-[-0.02em] text-foreground text-balance">
                            Every era of computing created one indispensable infrastructure company.
                        </h2>
                    </Reveal>
                </div>

                <div className="relative max-w-5xl mx-auto mt-20 sm:mt-28">
                    {/* Architectural Dashed Line (Horizontal for Desktop) */}
                    <div className="hidden md:block absolute top-4 left-4 right-4 h-[1px] border-t border-dashed border-border/40" />
                    
                    {/* Architectural Dashed Line (Vertical for Mobile) */}
                    <div className="block md:hidden absolute top-4 bottom-4 left-4 w-[1px] border-l border-dashed border-border/40" />

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-4 relative z-10">
                        {eras.map((era, index) => (
                            <Reveal key={era.name} delay={0.2 + index * 0.1}>
                                <div className="relative flex flex-col pt-0 pl-12 pb-4 md:pt-12 md:pl-4 md:px-4 md:pb-6">
                                    {/* Timeline Node - Diamond */}
                                    <div className="absolute top-2 md:top-4 left-4 -translate-y-1/2 -translate-x-1/2 flex items-center justify-center">
                                        <div className={`size-3 rotate-45 border transition-all duration-500 ${era.active ? "bg-green-500 border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.4)]" : "bg-background border-border/50"}`} />
                                    </div>

                                    <div>
                                        <div className="font-mono text-[10px] uppercase tracking-[0.2em] mb-2 md:mb-3 text-muted-foreground/50">
                                            {era.name}
                                        </div>
                                        <h3 className={`text-xl font-heading font-semibold mb-2 ${era.active ? "text-foreground" : "text-foreground/80"}`}>
                                            {era.company}
                                        </h3>
                                        <p className="text-sm text-muted-foreground leading-[1.6] min-h-0 md:min-h-[3rem]">
                                            {era.role}
                                        </p>
                                    </div>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>

                <div className="mt-20 sm:mt-32 text-center">
                    <Reveal delay={0.6}>
                        <p className="font-serif italic text-lg sm:text-xl text-muted-foreground">
                            We are just getting started.
                        </p>
                    </Reveal>
                </div>
            </div>
        </section>
    );
};
