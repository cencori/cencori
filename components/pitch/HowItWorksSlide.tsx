import React from "react";
import { PitchHeader, PitchSlide, PitchGrid, PitchQuote } from "./PitchPrimitives";

export function HowItWorksSlide() {
    return (
        <PitchSlide>
            <PitchHeader
                eyebrow="How it Works"
                title="Simple integration. Complex execution."
                subtitle="Cencori sits between your application and every major AI provider."
            />

            <PitchGrid cols={3} className="mt-12">
                <div className="space-y-6">
                    <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/30">
                        Step 01
                    </p>
                    <p className="text-2xl font-medium text-white tracking-tight">
                        One API Key
                    </p>
                    <p className="text-base text-zinc-500 leading-relaxed font-light">
                        Replace fragmented provider keys with a single Cencori token.
                    </p>
                </div>
                <div className="space-y-6">
                    <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/30">
                        Step 02
                    </p>
                    <p className="text-2xl font-medium text-white tracking-tight">
                        Define Rules
                    </p>
                    <p className="text-base text-zinc-500 leading-relaxed font-light">
                        Set security policies, cost limits, and failover logic in the dashboard.
                    </p>
                </div>
                <div className="space-y-6">
                    <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/30">
                        Step 03
                    </p>
                    <p className="text-2xl font-medium text-white tracking-tight">
                        Scale & Monetize
                    </p>
                    <p className="text-base text-zinc-500 leading-relaxed font-light">
                        Automatically bill your users per token and monitor spend in real-time.
                    </p>
                </div>
            </PitchGrid>

            <div className="mt-20 border-t border-white/5 pt-16 grid grid-cols-5 items-center gap-8 opacity-40 grayscale contrast-200">
                <p className="text-sm font-bold tracking-tighter">OPENAI</p>
                <p className="text-sm font-bold tracking-tighter">ANTHROPIC</p>
                <p className="text-sm font-bold tracking-tighter">GOOGLE</p>
                <p className="text-sm font-bold tracking-tighter">COHERE</p>
                <p className="text-sm font-bold tracking-tighter">META</p>
            </div>

            <PitchQuote>
                Complex infrastructure abstracted into a world-class developer experience.
            </PitchQuote>
        </PitchSlide>
    );
}
