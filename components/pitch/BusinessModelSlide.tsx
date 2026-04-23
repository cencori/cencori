import React from "react";
import { PitchHeader, PitchQuote, PitchSlide, PitchTable } from "./PitchPrimitives";

const streams = [
    ["Compute", "Usage-based (GPU)", "45-60%", "AWS-style compounding engine"],
    ["Subscription", "Tiered SaaS ($49+)", "80%+", "Access to integrated gateway"],
    ["Rev Share", "Take Rate (0.5-1.5%)", "100%", "Aligned growth as customers monetize"],
];

export function BusinessModelSlide() {
    return (
        <PitchSlide>
            <PitchHeader
                eyebrow="Business Model"
                title="Three revenue streams that compound automatically."
                subtitle="High-margin infrastructure revenue combined with usage scaling and ecosystem monetization."
            />

            <PitchTable 
                headers={["Stream", "Pricing Model", "Margin", "Strategic Value"]}
                rows={streams}
            />

            <PitchQuote>
                Customers start on subscription, scale via compute, and compound our growth as they monetize their own users through Cencori.
            </PitchQuote>
        </PitchSlide>
    );
}
