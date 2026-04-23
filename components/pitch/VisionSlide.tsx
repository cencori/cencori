import React from "react";
import { PitchHeader, PitchQuote, PitchSlide, PitchGrid } from "./PitchPrimitives";

const goals = [
    {
        label: "Ownership",
        title: "The Backbone of Intelligence",
        desc: "Owning the infrastructure layer of the AI economy is the single most valuable position in technology."
    },
    {
        label: "Autonomy",
        title: "Africa-Native Compute",
        desc: "Lagos, Nairobi, and Cairo training frontier models on infrastructure built from the continent."
    },
    {
        label: "Scale",
        title: "Unified Execution",
        desc: "Robotics, autonomous systems, and frontier AI sharing one single infrastructure backbone."
    }
];

export function VisionSlide() {
    return (
        <PitchSlide>
            <PitchHeader
                eyebrow="Vision"
                title="The infrastructure company of the AI economy."
                subtitle="We are not building a tool. We are building the foundation for the next decade of software."
            />

            <PitchGrid cols={3} className="mt-12">
                {goals.map(goal => (
                    <div key={goal.title} className="space-y-6">
                        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/30">
                            {goal.label}
                        </p>
                        <p className="text-2xl font-medium text-white tracking-tight">
                            {goal.title}
                        </p>
                        <p className="text-base text-zinc-500 leading-relaxed font-light">
                            {goal.desc}
                        </p>
                    </div>
                ))}
            </PitchGrid>

            <PitchQuote>
                This is how we define the future of computing.
            </PitchQuote>
        </PitchSlide>
    );
}
