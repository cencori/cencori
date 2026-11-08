"use client";

import React from "react";
import { Reveal } from "@/components/landing/Reveal";

interface FeatureItem {
    title: string;
    desc: string;
}

interface PartnerFeaturesProps {
    title: string;
    subtitle: string;
    items: FeatureItem[];
}

export function PartnerFeatures({ title, subtitle, items }: PartnerFeaturesProps) {
    return (
        <section className="py-24 sm:py-32">
            <div className="mx-auto max-w-6xl px-4 md:px-6">
                <Reveal>
                    <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-emerald-500 mb-4">{title}</p>
                </Reveal>
                <Reveal delay={0.05}>
                    <h2 className="text-3xl sm:text-[2.75rem] font-semibold tracking-[-0.03em] leading-[1.1] mb-6 max-w-xl">
                        AI writes the code.
                        <br />
                        <span className="text-muted-foreground">We handle the rest.</span>
                    </h2>
                </Reveal>
                <Reveal delay={0.1}>
                    <p className="text-muted-foreground leading-[1.7] max-w-lg mb-20">
                        {subtitle}
                    </p>
                </Reveal>

                <div className="space-y-0">
                    {items.map((item, i) => (
                        <Reveal key={item.title} delay={i * 0.05}>
                            <div className="group grid grid-cols-1 sm:grid-cols-12 gap-4 sm:gap-8 py-7 sm:py-9 border-b border-border/40 last:border-0 cursor-default">
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
    );
}
