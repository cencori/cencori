import React from "react";
import { PitchHeader, PitchQuote, PitchRuleList, PitchSlide } from "./PitchPrimitives";

const proof = [
    { title: "AI gateway", description: "In production." },
    { title: "End-user billing", description: "Shipped and in use." },
    { title: "Dashboard", description: "Live." },
    { title: "Documentation", description: "Live." },
];

const developerView = [
    "One API key that routes to every major AI provider",
    "A dashboard showing every request, every cost, every user",
    "Rate plans they can configure for their own customers",
    "Billing that collects revenue automatically on their behalf",
    "Usage analytics that show exactly what their AI product costs",
];

export function ProductSlide() {
    return (
        <PitchSlide>
            <PitchHeader
                eyebrow="Product"
                title="Cencori is not a deck. It is a live, working product."
                subtitle="The gateway is in production, billing is shipped, the dashboard is live, and the documentation is live."
            />

            <div className="grid flex-1 gap-8 md:grid-cols-[0.9fr_1.1fr]">
                <div className="flex flex-col justify-between">
                    <PitchRuleList items={proof} />
                    <PitchQuote>Teams are building on the platform today.</PitchQuote>
                </div>

                <div>
                    <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">
                        What a developer sees
                    </p>
                    <PitchRuleList
                        items={developerView}
                        className="mt-3"
                    />
                </div>
            </div>
        </PitchSlide>
    );
}
