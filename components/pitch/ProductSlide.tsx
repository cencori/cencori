import React from "react";
import { PitchHeader, PitchSlide, PitchGrid, PitchQuote } from "./PitchPrimitives";

export function ProductSlide() {
    return (
        <PitchSlide>
            <PitchHeader
                eyebrow="The Product"
                title="One Platform. Every Layer."
                subtitle="Cencori replaces the fragmented AI stack with a single, unified infrastructure layer."
            />

            <PitchGrid cols={3} className="mt-12">
                <div className="space-y-6">
                    <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/30">
                        Governance
                    </p>
                    <p className="text-2xl font-medium text-white tracking-tight">
                        AI Gateway & Routing
                    </p>
                    <p className="text-base text-zinc-500 leading-relaxed">
                        Provider choice, failovers, and resilience logic across every major model.
                    </p>
                </div>
                <div className="space-y-6">
                    <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/30">
                        Monetization
                    </p>
                    <p className="text-2xl font-medium text-white tracking-tight">
                        Native Usage Billing
                    </p>
                    <p className="text-base text-zinc-500 leading-relaxed">
                        Charge users per token or request. Native Stripe integration for recurring revenue.
                    </p>
                </div>
                <div className="space-y-6">
                    <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/30">
                        Execution
                    </p>
                    <p className="text-2xl font-medium text-white tracking-tight">
                        Managed Compute
                    </p>
                    <p className="text-base text-zinc-500 leading-relaxed">
                        GPU provisioning, training, and inference infrastructure billed per usage.
                    </p>
                </div>
            </PitchGrid>

            <PitchQuote>
                A developer-first experience that abstracts away the complexity of AI infrastructure.
            </PitchQuote>
        </PitchSlide>
    );
}
