import React from "react";
import { 
    PitchHeader, 
    PitchNumber, 
    PitchSlide, 
    PitchGrid, 
    PitchQuote 
} from "./PitchPrimitives";

export function TractionSlide() {
    return (
        <PitchSlide>
            <PitchHeader
                eyebrow="Traction"
                title="Early proof. Massive enterprise pull."
                subtitle="We are moving from general availability to deep strategic partnerships."
            />

            <PitchGrid cols={3} className="mt-12">
                <PitchNumber 
                    label="Developers" 
                    value="420+" 
                    note="Registered on waitlist / platform." 
                />
                <PitchNumber 
                    label="Requests" 
                    value="12K+" 
                    note="Routed through production gateway." 
                />
                <PitchNumber 
                    label="Integrations" 
                    value="5" 
                    note="Major AI providers fully integrated." 
                />
            </PitchGrid>

            <div className="mt-20 space-y-12 border-t border-white/5 pt-16">
                <div className="space-y-6">
                    <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/30">
                        Enterprise Validation
                    </p>
                    <p className="text-3xl md:text-5xl font-light text-zinc-400 leading-tight">
                        Deep conversations with <span className="text-white font-medium">UBA Bank</span> for infrastructure-level adoption.
                        A single pilot that will scale to millions of end-user transactions.
                    </p>
                </div>
            </div>

            <PitchQuote>
                "Nobody else is building the billing layer. That’s what fixes the ROI for our AI agents."
            </PitchQuote>
        </PitchSlide>
    );
}
