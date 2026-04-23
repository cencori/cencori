import React from "react";
import { PitchHeader, PitchQuote, PitchSlide, PitchTable } from "./PitchPrimitives";

const years = [
    {
        year: "2026",
        phase: "Foundation",
        revenue: "$222K",
        burn: "$420K",
        outcome: "~$2.4M cash left",
        targets: ["50 paying teams", "10 teams on compute", "5 teams on billing"],
    },
    {
        year: "2027",
        phase: "Traction",
        revenue: "$1.7M",
        burn: "$1.0M",
        outcome: "+$700K Net",
        targets: ["200 paying teams", "60 teams on compute", "30 teams on billing"],
    },
    {
        year: "2028",
        phase: "Scale",
        revenue: "$7.4M",
        burn: "$2.3M",
        outcome: "+$5.1M Net",
        targets: ["600 paying teams", "200 teams on compute", "100 teams on billing"],
    },
];

const assumptions = [
    "Blended platform subscription: $140/month",
    "Compute spend per active team grows from $7.5K/year to $21K/year",
    "End-user billing volume per active team: $80K/year at 0.5% take rate",
    "No major compute partnership upside modeled",
];

export function FinancialsSlide() {
    const headers = ["Metric", ...years.map(y => y.year)];
    
    const rows = [
        ["Phase", ...years.map(y => y.phase)],
        ["Revenue", ...years.map(y => <span key={y.year} className="text-foreground font-semibold">{y.revenue}</span>)],
        ["Burn", ...years.map(y => y.burn)],
        ["Outcome", ...years.map(y => <span key={y.year} className="text-foreground italic">{y.outcome}</span>)],
        ["Targets", ...years.map(y => (
            <ul key={y.year} className="space-y-1 text-xs opacity-70">
                {y.targets.map(t => <li key={t}>• {t}</li>)}
            </ul>
        ))],
    ];

    return (
        <PitchSlide>
            <PitchHeader
                eyebrow="Financial projections"
                title="Conservative assumptions, three revenue streams, clear Series A trigger."
                subtitle="Starting position: pre-revenue. Seed round closes Q2 2026."
            />

            <div className="flex flex-1 flex-col justify-between">
                <div className="pt-2">
                    <PitchTable 
                        headers={headers}
                        rows={rows}
                    />
                </div>

                <div className="grid gap-8 pt-6 md:grid-cols-[1fr_1.2fr]">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/80">
                            Key assumptions
                        </p>
                        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                            {assumptions.map((assumption) => (
                                <li key={assumption} className="flex gap-2">
                                    <span className="text-foreground/40">•</span>
                                    {assumption}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="flex flex-col justify-end">
                        <PitchQuote>
                            At $3-4M ARR with strong compute revenue growth — projected mid-Year 3 — Cencori raises a Series A to accelerate compute infrastructure buildout, Africa expansion, and the hardware roadmap. Series A target: $20-30M.
                        </PitchQuote>
                    </div>
                </div>
            </div>
        </PitchSlide>
    );
}
