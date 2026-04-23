import React from "react";
import { 
    PitchHeader, 
    PitchNumber, 
    PitchSlide, 
    PitchGrid, 
    PitchQuote,
    PitchTable
} from "./PitchPrimitives";

const allocation = [
    ["Engineering", "50%", "$1.5M", "Backend & Infra hires"],
    ["Compute", "20%", "$600K", "GPU Provisioning"],
    ["GTM", "20%", "$600K", "Developer Marketing"],
    ["Ops", "10%", "$300K", "Legal & Overhead"],
];

export function AskSlide() {
    return (
        <PitchSlide>
            <PitchHeader
                eyebrow="The Ask"
                title="Raising $3,000,000 to scale the backbone of intelligence."
                subtitle="Turning validated product proof into infrastructure-scale growth."
            />

            <PitchGrid cols={3} className="mt-12">
                <PitchNumber label="Round" value="$3,000,000" note="Seed Round / SAFE or Equity" />
                <PitchNumber label="Valuation" value="$18,000,000" note="Pre-money Target" />
                <PitchNumber label="Runway" value="20 Months" note="To Series A Readiness" />
            </PitchGrid>

            <div className="mt-20 border-t border-white/5 pt-16">
                <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/40 mb-8">
                    Use of Funds
                </p>
                <PitchTable 
                    headers={["Allocation", "Share", "Amount", "Primary Focus"]}
                    rows={allocation}
                />
            </div>

            <PitchQuote>
                The foundation for the next decade of intelligent software.
            </PitchQuote>
        </PitchSlide>
    );
}
