import React from "react";
import {
    PitchHeader,
    PitchNumber,
    PitchQuote,
    PitchSlide,
    PitchTable,
} from "./PitchPrimitives";

const problems = [
    ["Routing", "2-3 Weeks", "Manual failovers, provider choice"],
    ["Billing", "4-6 Weeks", "Direct Stripe integration, usage tracking"],
    ["Compute", "4-8 Weeks", "GPU provisioning, server management"],
    ["Memory", "2-4 Weeks", "Vector DBs, custom context logic"],
];

export function ProblemSlide() {
    return (
        <PitchSlide>
            <PitchHeader
                eyebrow="The Problem"
                title="Teams solve infrastructure problems before they write real code."
                subtitle="The average team burns 6 to 9 months building the foundation instead of the product."
            />

            <div className="grid flex-1 gap-20 md:grid-cols-[1fr_0.4fr]">
                <div className="flex flex-col justify-center">
                    <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/30 mb-8">
                        The Infrastructure Tax
                    </p>
                    <PitchTable 
                        headers={["Layer", "Manual Effort", "Hidden Complexity"]}
                        rows={problems}
                    />
                </div>

                <div className="flex flex-col justify-center space-y-12">
                    <PitchNumber
                        label="Runway Burned"
                        value="6–9"
                        note="Months spent on non-product engineering."
                    />
                    <PitchNumber
                        label="Fragility"
                        value="7"
                        note="Disconnected vendors in a typical AI stack."
                    />
                </div>
            </div>

            <PitchQuote>
                A fragile stack of seven vendors that breaks every time one of them changes an API.
            </PitchQuote>
        </PitchSlide>
    );
}
