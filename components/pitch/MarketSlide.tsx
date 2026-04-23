import React from "react";
import { PitchHeader, PitchNumber, PitchSlide, PitchTable } from "./PitchPrimitives";

const segments = [
    {
        segment: "Global AI Infrastructure",
        size: "$67B",
        projected: "$530B",
        growth: "40% CAGR",
    },
    {
        segment: "AI Compute Spend",
        size: "$47B",
        projected: "---",
        growth: "217% YoY",
    },
    {
        segment: "Developer Platforms",
        size: "$12B",
        projected: "$45B",
        growth: "28% CAGR",
    },
    {
        segment: "AI Billing & Monetization",
        size: "Nascent",
        projected: "$8B",
        growth: "Emerging",
    },
];

export function MarketSlide() {
    return (
        <PitchSlide>
            <PitchHeader
                eyebrow="Market"
                title="This is not a market. It is a category being created in real time."
                subtitle="The infrastructure spend is shifting from general cloud to intelligence infrastructure."
            />

            <div className="grid flex-1 gap-8 md:grid-cols-[1.3fr_0.7fr]">
                <div className="flex flex-col justify-center">
                    <PitchTable 
                        headers={["Segment", "2024 Size", "2030 Proj", "Growth"]}
                        rows={segments.map(s => [
                            s.segment,
                            s.size,
                            s.projected,
                            <span key={s.segment} className="text-foreground font-semibold">{s.growth}</span>
                        ])}
                    />
                </div>

                <div className="flex flex-col justify-between py-6">
                    <div className="space-y-12">
                        <div className="grid gap-6">
                            <PitchNumber label="TAM" value="$200B+" />
                            <PitchNumber label="SAM (3 years)" value="$4.2B" />
                            <PitchNumber label="Initial target" value="$420M" />
                        </div>

                        <div className="space-y-4">
                            <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground/80">
                                Africa Opportunity
                            </p>
                            <p className="text-base leading-relaxed text-muted-foreground">
                                Cencori is the first intelligence infrastructure company built
                                from Africa for the world. A first-mover position in a
                                continent-scale market everyone else is ignoring.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </PitchSlide>
    );
}
