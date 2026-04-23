import React from "react";
import { PitchHeader, PitchQuote, PitchSlide, PitchTable, PitchGrid } from "./PitchPrimitives";

const rows = [
    ["Phase", "Foundation", "Traction", "Scale"],
    ["Revenue", "$222K", "$1.7M", "$7.4M"],
    ["Net Burn", "($420K)", "($1.0M)", "($2.3M)"],
    ["Outcome", "Seed Funded", "+ $700K Net", "+ $5.1M Net"],
];

const assumptions = [
    "Blended platform subscription: $140/month",
    "Compute spend per active team scaling to $21K/year",
    "End-user billing volume per active team: $80K/year",
    "Seed round closes Q2 2026",
];

export function FinancialsSlide() {
    return (
        <PitchSlide>
            <PitchHeader
                eyebrow="Financials"
                title="Conservative projections. Clear path to profitability."
                subtitle="Starting position: MVP validated. Seed round fuels scaling."
            />

            <PitchTable 
                headers={["Metric", "2026", "2027", "2028"]}
                rows={rows}
            />

            <PitchGrid cols={2} className="mt-12">
                <div className="space-y-6">
                    <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/30">
                        Key Assumptions
                    </p>
                    <ul className="space-y-4 text-lg text-zinc-400 font-light">
                        {assumptions.map(a => <li key={a}>{a}</li>)}
                    </ul>
                </div>
                <div className="flex flex-col justify-end">
                    <PitchQuote>
                        Series A target: $20-30M at $3-4M ARR in Year 3.
                    </PitchQuote>
                </div>
            </PitchGrid>
        </PitchSlide>
    );
}
