import React from "react";
import { PitchMeta, PitchNumber, PitchSlide } from "./PitchPrimitives";

export function TitleSlide() {
    return (
        <PitchSlide className="justify-between">
            <div className="pb-2">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                        <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
                            Cencori
                        </p>
                        <span className="h-3 w-px bg-white/10" />
                        <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                            Seed deck
                        </p>
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                        Intelligence infrastructure platform
                    </p>
                </div>
            </div>

            <div className="grid flex-1 gap-2 py-2 md:grid-cols-[1.45fr_0.72fr] md:gap-3">
                <div className="flex flex-col justify-between">
                    <div>
                        <h1 className="max-w-4xl text-[3rem] font-semibold leading-[0.94] tracking-[-0.06em] text-foreground md:text-[5rem]">
                            The backbone
                            <br />
                            of intelligence.
                        </h1>
                        <p className="mt-3 max-w-xl text-[15px] leading-7 text-muted-foreground">
                            Cencori is the intelligence infrastructure platform — the complete stack for building, deploying, and monetizing AI and intelligent systems.
                        </p>
                    </div>

                    <div className="max-w-3xl pt-1">
                        <p className="text-[1.4rem] font-medium leading-[1.22] tracking-[-0.04em] text-foreground md:text-[2rem]">
                            The infrastructure for the intelligence era has not been
                            built yet.
                        </p>
                        <p className="mt-2 text-[1.4rem] font-medium leading-[1.22] tracking-[-0.04em] text-muted-foreground md:text-[2rem]">
                            Cencori is building it.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col pl-6 md:pl-7">
                    <div className="space-y-2">
                        <PitchMeta
                            label="Position"
                            value="An AI infrastructure company."
                        />

                    </div>
                </div>
            </div>

            <div className="grid gap-2 pt-2 md:grid-cols-[0.75fr_0.85fr_0.95fr_1.1fr]">
                    <PitchMeta label="Round" value="Seed" />
                    <PitchNumber label="Raise" value="$3M" />
                    <PitchNumber label="Valuation" value="$18M" note="Pre-money" />
                    <PitchMeta
                        label="Presented by"
                        value="Bola Banjo, CEO & Founder"
                    />
            </div>
        </PitchSlide>
    );
}
