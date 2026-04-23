import React from "react";
import { PitchHeader, PitchNumber, PitchSlide, PitchTable, PitchGrid } from "./PitchPrimitives";

const segments = [
    ["Global AI Infrastructure", "$67B", "$530B", "40% CAGR"],
    ["AI Compute Spend", "$47B", "---", "217% YoY"],
    ["Developer Platforms", "$12B", "$45B", "28% CAGR"],
    ["AI Billing / Monetization", "Nascent", "$8B", "Emerging"],
];

export function MarketSlide() {
    return (
        <PitchSlide>
            <PitchHeader
                eyebrow="Market"
                title="This is not a market. It is a category being created in real time."
                subtitle="Infrastructure spend is shifting from general cloud to intelligence infrastructure."
            />

            <PitchTable 
                headers={["Segment", "2024 Size", "2030 Proj", "Growth"]}
                rows={segments}
                className="mt-4"
            />

            <PitchGrid cols={3} className="mt-12">
                <PitchNumber label="TAM" value="$200B+" note="Global AI Serviceable Market" />
                <PitchNumber label="SAM" value="$4.2B" note="Infrastructure spend in Africa" />
                <PitchNumber label="Target" value="$420M" note="Phase 1 Revenue Opportunity" />
            </PitchGrid>

            <div className="mt-auto pt-16 border-t border-white/5">
                <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/30 mb-4">
                    The Africa Hook
                </p>
                <p className="text-3xl font-light text-zinc-400 max-w-5xl leading-tight">
                    Cencori is the <span className="text-white font-medium">first intelligence infrastructure company</span> built from Africa for the world. 
                    A first-mover position in a continent-scale market everyone else is ignoring.
                </p>
            </div>
        </PitchSlide>
    );
}
