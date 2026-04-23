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
        note: "Conversation underway with the biggest bank in Africa.",
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
                <div className="grid gap-4 border-t border-white/10 pt-4 md:grid-cols-5">
                    {metrics.map((metric, index) => (
                        <div
                            key={metric.label}
                            className={`py-1 ${
                                index < metrics.length - 1 ? "md:border-r md:border-white/10 md:pr-4" : ""
                            }`}
                        >
                            <PitchMeta label={metric.label} value={metric.value} />
                            <p className="mt-2 text-[11px] leading-4 text-zinc-500">
                                {metric.note}
                            </p>
                        </div>
                    ))}
                </div>

                <div className="grid gap-8 md:grid-cols-[0.9fr_1.1fr]">
                    <div className="border-t border-white/10 pt-4">
                        <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">
                            What this tells us
                        </p>
                        <p className="mt-3 text-sm leading-6 text-zinc-200 md:text-[15px]">
                            We did not build this in a vacuum. The signal from real usage,
                            at zero marketing spend, is the most important validation point
                            in the deck.
                        </p>
                    </div>

                    <PitchQuote>
                        The machine works. We just do not have the fuel yet.
                    </PitchQuote>
                </div>
            </div>
        </PitchSlide>
    );
}
