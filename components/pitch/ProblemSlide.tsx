import React from "react";
import {
    PitchHeader,
    PitchNumber,
    PitchQuote,
    PitchRuleList,
    PitchSlide,
} from "./PitchPrimitives";

const problems = [
    {
        title: "Routing",
        description: "Provider choice, failovers, retries, and resilience logic.",
    },
    {
        title: "Rate limiting",
        description: "Protection against abuse, spikes, and runaway usage.",
    },
    {
        title: "Cost control",
        description: "Per-user spend visibility and budget enforcement.",
    },
    {
        title: "Billing",
        description: "Charging customers for AI usage without custom plumbing.",
    },
    {
        title: "Compute",
        description: "Training, fine-tuning, and inference infrastructure.",
    },
    {
        title: "Memory",
        description: "Persistent context across sessions and workflows.",
    },
    {
        title: "Deployment",
        description: "Getting the full product stack into production safely.",
    },
];

export function ProblemSlide() {
    const left = problems.slice(0, 4);
    const right = problems.slice(4);

    return (
        <PitchSlide>
            <PitchHeader
                eyebrow="The problem"
                title="Teams solve seven infrastructure problems before they write real product code."
            />

            <div className="grid flex-1 gap-8 md:grid-cols-[1.15fr_0.85fr]">
                <div className="grid gap-6 md:grid-cols-2">
                    <PitchRuleList items={left} numbered />
                    <PitchRuleList items={right} numbered className="md:border-t-0" />
                </div>

                <div className="flex flex-col justify-between border-t border-white/10 pt-3">
                    <div>
                        <PitchNumber
                            label="Runway burned"
                            value="6 to 9"
                            note="months spent on infrastructure before the product."
                        />
                        <div className="mt-6 border-t border-white/10 pt-4">
                            <p className="text-sm leading-6 text-zinc-500">
                                Every layer is usually a separate tool, separate contract,
                                separate integration, and separate engineering sprint.
                            </p>
                        </div>
                    </div>

                    <PitchQuote>
                        The result is a fragile stack of seven vendors that breaks every
                        time one of them changes an API.
                    </PitchQuote>
                </div>
            </div>
        </PitchSlide>
    );
}
