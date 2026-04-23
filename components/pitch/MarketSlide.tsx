import React from "react";
import { PitchHeader, PitchNumber, PitchRuleList, PitchSlide } from "./PitchPrimitives";

const segments = [
    {
        title: "Global AI infrastructure",
        description: "$67B in 2024, projected to reach $530B by 2030 at 40% CAGR.",
    },
    {
        title: "AI compute spend",
        description:
            "NVIDIA posted $47B in data center revenue in 2024, up 217% year over year.",
    },
    {
        title: "Developer platforms",
        description: "$12B today, growing to $45B by 2029.",
    },
    {
        title: "AI billing infrastructure",
        description: "$8B by 2028, with no category owner yet.",
    },
];

export function MarketSlide() {
    return (
        <PitchSlide>
            <PitchHeader
                eyebrow="Market"
                title="This is not a market. It is a category being created in real time."
            />

            <div className="grid flex-1 gap-8 md:grid-cols-[1fr_0.9fr]">
                <section>
                    <PitchRuleList items={segments} />
                </section>

                <div className="flex flex-col justify-between">
                    <div className="grid gap-5 md:grid-cols-3">
                        <PitchNumber label="TAM" value="$200B+" />
                        <PitchNumber label="SAM (3 years)" value="$4.2B" />
                        <PitchNumber label="Initial target" value="$420M" />
                    </div>

                    <div className="border-t border-white/10 pt-4">
                        <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">
                            Africa opportunity
                        </p>
                        <p className="mt-3 text-sm leading-6 text-zinc-200 md:text-[15px]">
                            Africa has 1.4 billion people, the youngest population in the
                            world, and one of the fastest-growing developer ecosystems.
                            Cencori is the first intelligence infrastructure company built
                            from Africa for the world.
                        </p>
                    </div>
                </div>
            </div>
        </PitchSlide>
    );
}
