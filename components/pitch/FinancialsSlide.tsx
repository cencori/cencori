import React from "react";
import { PitchHeader, PitchQuote, PitchSlide } from "./PitchPrimitives";

const years = [
    {
        year: "2026",
        phase: "Foundation",
        revenue: "$222K",
        burn: "$420K",
        outcome: "~$2.4M cash remaining",
        targets: [
            "50 paying teams on subscription",
            "10 teams actively using compute",
            "5 teams generating billing volume",
        ],
    },
    {
        year: "2027",
        phase: "Traction",
        revenue: "$1.7M",
        burn: "$1.0M",
        outcome: "$700K positive net",
        targets: [
            "200 paying teams",
            "60 teams on compute",
            "30 teams with billing volume",
        ],
    },
    {
        year: "2028",
        phase: "Scale",
        revenue: "$7.4M",
        burn: "$2.3M",
        outcome: "$5.1M positive net",
        targets: [
            "600 paying teams",
            "200 teams on compute",
            "100 teams generating billing volume",
        ],
    },
];

const assumptions = [
    "Blended platform subscription: $140/month",
    "Compute spend per active team grows from $7.5K/year to $21K/year",
    "End-user billing volume per active team: $80K/year at 0.5% take rate",
    "No major compute partnership upside modeled",
];

export function FinancialsSlide() {
    return (
        <PitchSlide>
            <PitchHeader
                eyebrow="Financial projections"
                title="Conservative assumptions, three revenue streams, clear Series A trigger."
                subtitle="Starting position: pre-revenue. Seed round closes Q2 2026."
            />

            <div className="flex flex-1 flex-col justify-between">
                <div className="overflow-hidden border-t border-white/10 pt-4">
                    <table className="w-full table-fixed border-collapse">
                        <thead>
                            <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-[0.24em] text-zinc-500">
                                <th className="pb-3 pr-3 font-medium">Metric</th>
                                {years.map((year) => (
                                    <th key={year.year} className="pb-3 pr-3 font-medium">
                                        {year.year}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="align-top">
                            <tr className="border-b border-white/10">
                                <td className="py-3 pr-3 text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                                    Phase
                                </td>
                                {years.map((year) => (
                                    <td key={year.year} className="py-3 pr-3 text-sm font-medium text-white">
                                        {year.phase}
                                    </td>
                                ))}
                            </tr>
                            <tr className="border-b border-white/10">
                                <td className="py-3 pr-3 text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                                    Revenue
                                </td>
                                {years.map((year) => (
                                    <td key={year.year} className="py-3 pr-3 text-lg font-semibold tracking-[-0.03em] text-white">
                                        {year.revenue}
                                    </td>
                                ))}
                            </tr>
                            <tr className="border-b border-white/10">
                                <td className="py-3 pr-3 text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                                    Burn
                                </td>
                                {years.map((year) => (
                                    <td key={year.year} className="py-3 pr-3 text-lg font-semibold tracking-[-0.03em] text-white">
                                        {year.burn}
                                    </td>
                                ))}
                            </tr>
                            <tr className="border-b border-white/10">
                                <td className="py-3 pr-3 text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                                    Outcome
                                </td>
                                {years.map((year) => (
                                    <td key={year.year} className="py-3 pr-3 text-[13px] leading-5 text-zinc-200">
                                        {year.outcome}
                                    </td>
                                ))}
                            </tr>
                            <tr>
                                <td className="py-3 pr-3 text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                                    Targets
                                </td>
                                {years.map((year) => (
                                    <td key={year.year} className="py-3 pr-3">
                                        <ul className="space-y-1 text-[11px] leading-4 text-zinc-500">
                                            {year.targets.map((target) => (
                                                <li key={target}>{target}</li>
                                            ))}
                                        </ul>
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="grid gap-8 border-t border-white/10 pt-4 md:grid-cols-[1fr_0.9fr]">
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">
                            Key assumptions
                        </p>
                        <ul className="mt-3 space-y-1.5 text-[11px] leading-4 text-zinc-500">
                            {assumptions.map((assumption) => (
                                <li key={assumption}>{assumption}</li>
                            ))}
                        </ul>
                    </div>

                    <PitchQuote className="border-t-0 pt-0">
                        At $3-4M ARR with strong compute growth, projected around
                        mid-2028, Cencori raises a $20-30M Series A.
                    </PitchQuote>
                </div>
            </div>
        </PitchSlide>
    );
}
