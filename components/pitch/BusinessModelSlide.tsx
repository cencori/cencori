import React from "react";
import { PitchHeader, PitchQuote, PitchSlide, PitchTable } from "./PitchPrimitives";

const streams = [
    {
        stream: "Compute",
        model: "Usage-based (GPU)",
        margin: "45-60%",
        focus: "AWS-style compounding revenue engine",
    },
    {
        stream: "Platform Subscription",
        model: "Tiered SaaS ($49 - $299+)",
        margin: "80%+",
        focus: "Access to integrated gateway & tools",
    },
    {
        stream: "End-User Billing Share",
        model: "Rev Share (0.5 - 1.5%)",
        margin: "100%",
        focus: "Aligned growth as customers monetize",
    },
];

export function BusinessModelSlide() {
    return (
        <PitchSlide>
            <PitchHeader
                eyebrow="Business model"
                title="Three revenue streams that compound automatically as customers grow."
                subtitle="High-margin infrastructure revenue combined with usage scaling and ecosystem monetization."
            />

            <div className="flex flex-1 flex-col justify-center">
                <PitchTable 
                    headers={["Stream", "Pricing Model", "Target Margin", "Strategic Value"]}
                    rows={streams.map(s => [
                        <span key={s.stream} className="font-semibold">{s.stream}</span>,
                        s.model,
                        <span key={s.stream + "m"} className="text-foreground">{s.margin}</span>,
                        <span key={s.stream + "v"} className="text-muted-foreground/70">{s.focus}</span>
                    ])}
                />
            </div>

            <PitchQuote>
                Customers start on subscription, scale via compute, and compound our growth as they monetize their own users through Cencori.
            </PitchQuote>
        </PitchSlide>
    );
}
