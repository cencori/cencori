import React from "react";
import { PitchSlide, PitchHeader, PitchQuote } from "./PitchPrimitives";

export function TitleSlide() {
    return (
        <PitchSlide className="justify-center">
            <header className="mb-20">
                <div className="flex items-center gap-4 mb-12">
                    <p className="text-xs font-bold uppercase tracking-[0.4em] text-white/40">
                        Cencori / Seed Round
                    </p>
                    <div className="h-px w-24 bg-white/10" />
                </div>
                <h1 className="text-7xl md:text-[10rem] font-medium tracking-tighter text-white leading-[0.85]">
                    The backbone<br />of intelligence.
                </h1>
                <p className="mt-12 max-w-3xl text-2xl md:text-3xl font-light text-zinc-400 leading-tight">
                    The infrastructure platform for building, deploying, and monetizing intelligent systems.
                </p>
            </header>

            <div className="mt-auto grid md:grid-cols-3 gap-20 border-t border-white/5 pt-16">
                <div className="space-y-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/30">
                        Presented By
                    </p>
                    <p className="text-xl font-medium text-white">Bola Banjo</p>
                    <p className="text-sm text-zinc-500 font-medium tracking-widest uppercase">CEO & Founder</p>
                </div>
                <div className="space-y-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/30">
                        Strategic Position
                    </p>
                    <p className="text-xl font-medium text-white">Intelligence Infrastructure</p>
                    <p className="text-sm text-zinc-500">First-mover in the Africa-global corridor.</p>
                </div>
                <div className="space-y-4 text-right md:text-left">
                    <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/30">
                        Date
                    </p>
                    <p className="text-xl font-medium text-white">Q2 / 2026</p>
                </div>
            </div>
        </PitchSlide>
    );
}
