import React from "react";
import { PitchHeader, PitchQuote, PitchSlide, PitchGrid, PitchNumber } from "./PitchPrimitives";

export function ClosingSlide() {
    return (
        <PitchSlide>
            <PitchHeader
                eyebrow="The Future"
                title="Every era of computing creates one infrastructure company that becomes indispensable."
            />

            <PitchGrid cols={3} className="mt-12">
                <PitchNumber label="Mainframe Era" value="IBM" />
                <PitchNumber label="Internet Era" value="AWS" />
                <PitchNumber label="Mobile Era" value="Stripe" />
            </PitchGrid>

            <div className="mt-auto">
                <PitchQuote>
                    The intelligence era belongs to Cencori.
                </PitchQuote>
                
                <div className="mt-20 grid md:grid-cols-2 gap-12 border-t border-white/5 pt-16">
                    <div className="space-y-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/30">
                            The Vision
                        </p>
                        <p className="text-2xl font-light text-zinc-400 leading-tight">
                            We are building the backbone for the next generation of intelligent systems, from robotics to frontier models.
                        </p>
                    </div>
                    <div className="flex flex-col justify-end space-y-2">
                        <p className="text-xl font-medium text-white">bola@cencori.com</p>
                        <p className="text-base text-zinc-500">cencori.com</p>
                    </div>
                </div>
            </div>
        </PitchSlide>
    );
}
