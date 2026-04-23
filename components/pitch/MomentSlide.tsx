import React from "react";
import { PitchHeader, PitchSlide, PitchGrid, PitchQuote } from "./PitchPrimitives";

export function MomentSlide() {
    return (
        <PitchSlide>
            <PitchHeader
                eyebrow="The Moment"
                title="We are living through the most significant infrastructure shift in the history of computing."
            />

            <PitchGrid className="mt-12">
                <div className="space-y-8">
                    <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/30">
                        The Internet Era
                    </p>
                    <p className="text-3xl md:text-5xl font-light text-zinc-400 leading-tight">
                        Built on <span className="text-white font-medium">Servers, CDNs, and Payment Rails</span>. 
                        AWS, Stripe, and Cloudflare became the backbone.
                    </p>
                </div>
                <div className="space-y-8">
                    <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/30">
                        The AI Era
                    </p>
                    <p className="text-3xl md:text-5xl font-light text-zinc-400 leading-tight">
                        Requires <span className="text-white font-medium">Unified Intelligence Infrastructure</span>. 
                        Compute, Billing, and Memory in a single stack.
                    </p>
                </div>
            </PitchGrid>

            <PitchQuote>
                This infrastructure layer does not exist yet. Cencori is building it.
            </PitchQuote>
        </PitchSlide>
    );
}
