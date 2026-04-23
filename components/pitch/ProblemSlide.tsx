import React from "react";
import {
    PitchHeader,
    PitchNumber,
    PitchQuote,
    PitchSlide,
    PitchTable,
} from "./PitchPrimitives";

const problems = [
    {
        layer: "Routing",
        oldWay: "Custom logic, failovers, provider choice",
        cencoriWay: "One unified endpoint",
    },
    {
        layer: "Billing",
        oldWay: "Usage tracking + Stripe integration",
        cencoriWay: "Native: Meter & charge in minutes",
    },
    {
        layer: "Cost Ctrl",
        oldWay: "Manual tracking & budget alerts",
        cencoriWay: "Per-user spend visibility",
    },
    {
        layer: "Compute",
        oldWay: "GPUI Provisioning & infra management",
        cencoriWay: "AWS-style billed per usage",
    },
    {
        layer: "Memory",
        oldWay: "Custom vector DBs & context logic",
        cencoriWay: "Managed persistent context",
    },
];

export function ProblemSlide() {
    return (
        <PitchSlide>
            <PitchHeader
                eyebrow="The problem"
                title="Teams solve seven engineering problems before they write product code."
                subtitle="The average team spends 6 to 9 months solving infrastructure before they build product."
            />

            <div className="grid flex-1 gap-8 md:grid-cols-[1.4fr_0.6fr]">
                <div className="flex flex-col justify-center">
                    <PitchTable 
                        headers={["Infrastructure Layer", "Manual Effort", "Cencori Solution"]}
                        rows={problems.map(p => [
                            p.layer,
                            <span key={p.layer + "a"} className="text-muted-foreground/60">{p.oldWay}</span>,
                            <span key={p.layer + "b"} className="text-foreground font-semibold">✓ {p.cencoriWay}</span>
                        ])}
                    />
                </div>

                <div className="flex flex-col justify-between py-6">
                    <div className="space-y-8">
                        <PitchNumber
                            label="Runway burned"
                            value="6 to 9 months"
                            note="spent on problems that have nothing to do with their actual idea."
                        />
                        <div className="space-y-4">
                            <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground/80">
                                The Fragile Stack
                            </p>
                            <p className="text-base leading-relaxed text-muted-foreground">
                                Every single one of these is a separate tool, a separate
                                contract, and a separate engineering sprint.
                            </p>
                        </div>
                    </div>

                    <PitchQuote>
                        The result is a fragile stack of 7 vendors that breaks every
                        time one of them changes an API.
                    </PitchQuote>
                </div>
            </div>
        </PitchSlide>
    );
}
