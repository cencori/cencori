import React from "react";
import { PitchHeader, PitchQuote, PitchRuleList, PitchSlide } from "./PitchPrimitives";

const features = [
    {
        title: "AI gateway",
        description:
            "One unified endpoint across OpenAI, Anthropic, Gemini, Cohere, and more with routing, security, observability, and rate limiting built in.",
    },
    {
        title: "Compute",
        description:
            "GPU-backed compute for training, fine-tuning, and inference, software-defined today with proprietary hardware on the roadmap.",
    },
    {
        title: "End-user billing",
        description:
            "Meter, limit, and charge end users for AI usage with markup, flat fees, Stripe Connect, and automated invoicing.",
    },
    {
        title: "Memory",
        description:
            "Persistent memory so AI products retain context, improve retention, and get smarter over time.",
    },
    {
        title: "Workflow & orchestration",
        description:
            "Agentic workflow coordination, multi-step reasoning, and tool execution without building orchestration from scratch.",
    },
    {
        title: "Integrations",
        description:
            "Native integrations with the tools teams already use so Cencori fits the stack instead of forcing a rebuild.",
    },
];

export function SolutionSlide() {
    return (
        <PitchSlide>
            <PitchHeader
                eyebrow="The solution"
                title="Cencori is the complete intelligence infrastructure platform."
                subtitle="One platform. Every layer. From model to production."
            />

            <div className="grid flex-1 gap-2 md:grid-cols-[1.05fr_0.95fr]">
                <div className="grid gap-3 md:grid-cols-2">
                    <PitchRuleList items={features.slice(0, 3)} numbered />
                    <PitchRuleList items={features.slice(3)} numbered className="md:" />
                </div>

                <div className="flex flex-col justify-between pt-1">
                    <div className="space-y-2">
                        <p className="text-[10px] leading-6 text-muted-foreground">
                            A team can go from zero to a production-grade AI product with
                            billing, compute, memory, and deployment without stitching
                            together ten vendors.
                        </p>
                    </div>
                    <PitchQuote>From your first API call to your billionth.</PitchQuote>
                </div>
            </div>
        </PitchSlide>
    );
}
