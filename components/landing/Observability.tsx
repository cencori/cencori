import React from "react";
import { ShowcaseSection } from "@/components/landing/ShowcaseSection";

const features = [
    {
        title: "Request timeline",
        description: "Follow every request as it moves through your gateway, with status, provider, latency, and filtered events in one stream.",
    },
    {
        title: "Latency breakdowns",
        description: "Compare p50 to p99 across providers and models, so bottlenecks show up before they become support tickets.",
    },
    {
        title: "Anomaly detection",
        description: "Spot sudden changes in errors, spend, or traffic with dashboards designed for real production incidents.",
    },
    {
        title: "Failover history",
        description: "See when requests moved to backup providers, what triggered the fallback, and how long recovery took.",
    },
];

export const Observability = () => {
    return (
        <ShowcaseSection
            eyebrow="Observability"
            title={
                <>
                    See every request.
                    <br />
                    <span className="text-muted-foreground">Trace every anomaly.</span>
                </>
            }
            description="Live dashboards for latency, provider health, filtered traffic, and failovers — so your team always knows what changed and why."
            items={features}
            imageLabel="Observability"
            imageHint="Replace this panel with your observability dashboard image."
        />
    );
};
