import React from "react";
import { PitchHeader, PitchQuote, PitchSlide, PitchGrid } from "./PitchPrimitives";

const pillars = [
    {
        title: "Intelligence Layer",
        desc: "Gateway, routing, and world-class model access integrated by default."
    },
    {
        title: "Economic Layer",
        desc: "Native usage-based billing, metering, and monetization for every user."
    },
    {
        title: "Execution Layer",
        desc: "Distributed compute, GPU provisioning, and managed fine-tuning."
    }
];

export function SolutionSlide() {
    return (
        <PitchSlide>
            <PitchHeader
                eyebrow="The Solution"
                title="Cencori is the complete stack for the AI economy."
                subtitle="One integration. Every infrastructure layer simplified."
            />

            <PitchGrid cols={3} className="mt-12">
                {pillars.map(pillar => (
                    <div key={pillar.title} className="space-y-6">
                        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/30">
                            {pillar.title}
                        </p>
                        <p className="text-base text-zinc-500 leading-relaxed font-light">
                            {pillar.desc}
                        </p>
                    </div>
                ))}
            </PitchGrid>

            <div className="mt-auto border-t border-white/5 pt-16">
                <p className="text-3xl font-light text-zinc-400 max-w-5xl leading-tight">
                    Teams go from <span className="text-white font-medium">zero to production</span> with billing, compute, and memory without stitching together a dozen fragmented vendors.
                </p>
            </div>

            <PitchQuote>
                From your first API call to your billionth.
            </PitchQuote>
        </PitchSlide>
    );
}
