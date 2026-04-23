import React from "react";
import { ShowcaseSection } from "@/components/landing/ShowcaseSection";

const items = [
    {
        title: "Provider-level spend",
        description: "Track where costs come from across every provider, model, and route — without stitching together multiple invoices.",
    },
    {
        title: "Per-project visibility",
        description: "See how production, staging, and internal tools each contribute to total spend, with cleaner breakdowns for operators and finance.",
    },
    {
        title: "Savings analysis",
        description: "Measure what caching, routing, and model selection are actually saving, so optimization decisions stay grounded in numbers.",
    },
    {
        title: "Usage history",
        description: "Watch spend change over time, catch spikes earlier, and understand which launches or prompts moved your costs.",
    },
];

export const CostTracking = () => {
    return (
        <ShowcaseSection
            eyebrow="Cost visibility"
            title={
                <>
                    Know what every request costs.
                    <br />
                    <span className="text-muted-foreground">Before the bill shows up.</span>
                </>
            }
            description="Real-time spend visibility across providers, models, and projects — built for teams that need fewer surprises and cleaner reporting."
            items={items}
            imageLabel="Usage"
            imageHint="Replace this panel with your cost tracking image."
            reverse
        />
    );
};
