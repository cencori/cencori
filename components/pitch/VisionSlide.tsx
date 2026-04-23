import React from "react";
import { PitchHeader, PitchQuote, PitchRuleList, PitchSlide } from "./PitchPrimitives";

const vision = [
    {
        title: "African research labs train frontier models on Cencori compute",
        description:
            "Not renting capacity from Virginia, but running on infrastructure built from the continent.",
    },
    {
        title: "Startups ship world-class AI products on one stack",
        description:
            "Teams in Lagos, Nairobi, Accra, and Cairo build without stitching together foreign infrastructure layers.",
    },
    {
        title: "Enterprises route billions of AI requests through Cencori",
        description:
            "Compliance, audit trails, and cost control become part of the intelligence layer by default.",
    },
    {
        title: "Software and hardware products run on the same infrastructure",
        description:
            "Robotics, mechatronics, autonomous systems, and frontier AI share one backbone.",
    },
];

export function VisionSlide() {
    return (
        <PitchSlide>
            <PitchHeader
                eyebrow="Vision"
                title="The company that owns the infrastructure layer of the AI economy owns one of the most valuable positions in technology."
            />

            <div className="grid flex-1 gap-8 md:grid-cols-2">
                <PitchRuleList items={vision.slice(0, 2)} numbered />
                <PitchRuleList items={vision.slice(2)} numbered />
            </div>

            <PitchQuote>
                We are not building a tool. We are building the backbone of
                intelligence.
            </PitchQuote>
        </PitchSlide>
    );
}
