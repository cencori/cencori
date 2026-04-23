import React from "react";
import { PitchHeader, PitchQuote, PitchRuleList, PitchSlide } from "./PitchPrimitives";

const streams = [
    {
        title: "Compute",
        description: "GPU compute billed per usage for training, fine-tuning, and inference.",
        points: [
            "Core revenue engine as customers scale",
            "Target gross margin: 45-60%",
            "AWS-style infrastructure compounding",
        ],
    },
    {
        title: "Platform subscription",
        description:
            "Tiered plans for gateway, memory, workflow, integrations, and billing.",
        points: ["Starter: $49/month", "Growth: $299/month", "Target gross margin: 80%+"],
    },
    {
        title: "End-user billing revenue share",
        description:
            "A percentage of the revenue our customers collect from their own users.",
        points: [
            "Take rate target: 0.5-1.5%",
            "When customers make money, we make money",
            "No direct competitor has this layer",
        ],
    },
];

export function BusinessModelSlide() {
    return (
        <PitchSlide>
            <PitchHeader
                eyebrow="Business model"
                title="Three revenue streams that compound automatically as customers grow."
            />

            <div className="grid flex-1 gap-6 md:grid-cols-3">
                {streams.map((stream, index) => (
                    <section
                        key={stream.title}
                        className={index < streams.length - 1 ? "md:pr-4 md:border-r md:border-white/10" : ""}
                    >
                        <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">
                            Stream 0{index + 1}
                        </p>
                        <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">
                            {stream.title}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-zinc-500">
                            {stream.description}
                        </p>
                        <PitchRuleList items={stream.points} className="mt-4" />
                    </section>
                ))}
            </div>

            <PitchQuote>
                Customers start on subscription, grow into compute, and then monetize
                their own users through Cencori.
            </PitchQuote>
        </PitchSlide>
    );
}
