import React from "react";
import { PitchHeader, PitchMeta, PitchNumber, PitchRuleList, PitchSlide } from "./PitchPrimitives";

const useOfFunds = [
    {
        title: "Engineering — 50%",
        description: "$1.5M for backend, infrastructure, and reliability hires.",
    },
    {
        title: "Infrastructure & compute — 20%",
        description: "$600K for GPU provisioning, redundancy, and server infra.",
    },
    {
        title: "Go-to-market — 20%",
        description: "$600K for developer marketing, outbound, and Africa activation.",
    },
    {
        title: "Operations & overhead — 10%",
        description: "$300K for legal, finance, tooling, and operations.",
    },
];

const milestones = [
    "$1M ARR by Month 16",
    "200 active paying teams by Month 12",
    "Compute product in public beta by Month 6",
    "Series A ready by Month 20",
];

export function AskSlide() {
    return (
        <PitchSlide>
            <PitchHeader
                eyebrow="The ask"
                title="Raising $3,000,000 to turn product proof into infrastructure scale."
            />

            <div className="grid flex-1 gap-8 md:grid-cols-[0.95fr_1.05fr]">
                <div className="flex flex-col justify-between">
                    <div className="grid gap-5 border-t border-white/10 pt-4 md:grid-cols-2">
                        <PitchNumber label="Raise" value="$3M" note="Seed round" />
                        <PitchMeta label="Instrument" value="Equity / SAFE" />
                        <PitchNumber label="Pre-money valuation" value="$18M" />
                        <PitchNumber label="Runway" value="20 months" />
                    </div>

                    <div className="border-t border-white/10 pt-4">
                        <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">
                            Contact
                        </p>
                        <div className="mt-3 space-y-2 text-sm text-zinc-200">
                            <p>bola@cencori.com</p>
                            <p>cencori.com</p>
                        </div>
                    </div>
                </div>

                <div className="grid gap-8 md:grid-cols-2">
                    <section>
                        <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">
                            Use of funds
                        </p>
                        <PitchRuleList items={useOfFunds} className="mt-3" />
                    </section>

                    <section>
                        <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">
                            Milestones this unlocks
                        </p>
                        <PitchRuleList items={milestones} className="mt-3" />
                    </section>
                </div>
            </div>
        </PitchSlide>
    );
}
