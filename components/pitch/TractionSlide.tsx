import React from "react";
import { PitchHeader, PitchMeta, PitchQuote, PitchSlide } from "./PitchPrimitives";

const metrics = [
    {
        label: "Live product",
        value: "Shipped",
        note: "Active users and billing already in market.",
    },
    {
        label: "Downloads",
        value: "2,000",
        note: "All within three months.",
    },
    {
        label: "Enterprise pull",
        value: "In talks with UBA",
        note: "In talks with the biggest bank in Africa, they control billions yearly.",
    },
    {
        label: "Distribution signal",
        value: "Anthropic",
        note: "Official partner in Africa.",
    },
    {
        label: "Integrations live",
        value: "5 providers",
        note: "OpenAI, Anthropic, Gemini, Cohere, and more.",
    },
];

export function TractionSlide() {
    return (
        <PitchSlide>
            <PitchHeader
                eyebrow="Traction"
                title="We are pre-revenue in the traditional sense, but not pre-validation."
                subtitle="Real teams found Cencori, integrated it, and started building on it with zero marketing budget."
            />

            <div className="flex flex-1 flex-col justify-between">
                <div className="grid gap-2 pt-2 md:grid-cols-5">
                    {metrics.map((metric, index) => (
                        <div
                            key={metric.label}
                            className={`py-1 ${
                                index < metrics.length - 1 ? "md: md: md:pr-4" : ""
                            }`}
                        >
                            <PitchMeta label={metric.label} value={metric.value} />
                            <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                                {metric.note}
                            </p>
                        </div>
                    ))}
                </div>

                <div className="grid gap-2 md:grid-cols-[0.9fr_1.1fr]">
                    <div className="pt-2">
                        <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                            What this tells us
                        </p>
                        <p className="mt-3 text-[10px] leading-6 text-muted-foreground md:text-[15px]">
                            We did not build this in a vacuum. Real teams found Cencori,
                            integrated it, and are using it to build real products. That signal
                            at zero marketing budget is the most important data point in this deck.
                        </p>
                    </div>

                    <PitchQuote>
                        The machine works. We just don't have the fuel yet.
                    </PitchQuote>
                </div>
            </div>
        </PitchSlide>
    );
}
