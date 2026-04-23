import React from "react";
import { Reveal } from "@/components/landing/Reveal";

const items = [
    {
        title: "Hard spend caps",
        description: "Set limits that actually stop traffic when a budget is reached, so one broken workflow does not become an expensive incident.",
    },
    {
        title: "Budget alerts",
        description: "Get warned before you hit the threshold, with alerts designed for teams managing production and staging separately.",
    },
    {
        title: "End-user billing",
        description: "Allocate AI costs downstream with cleaner billing controls for products that need customer-level usage accounting.",
    },
    {
        title: "Project-level control",
        description: "Set different rules for production, staging, and internal tools so your budget policy matches how the organization actually works.",
    },
];

export const BudgetControl = () => {
    return (
        <section className="py-24 sm:py-32 bg-background">
            <div className="mx-auto max-w-6xl px-4 md:px-6">
                <Reveal>
                    <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground">
                        Controls
                    </p>
                </Reveal>
                <Reveal delay={0.05}>
                    <h2 className="max-w-4xl text-3xl sm:text-[2.75rem] font-semibold tracking-[-0.03em] leading-[1.1] mb-20">
                        Set limits before costs drift.
                        <br />
                        <span className="text-muted-foreground">Not after the spike.</span>
                    </h2>
                </Reveal>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-14">
                    {items.map((item, index) => (
                        <Reveal key={item.title} delay={index * 0.06}>
                            <div className="group">
                                <div className="h-px w-8 bg-border mb-6 group-hover:w-16 group-hover:bg-foreground/30 transition-all duration-500" />
                                <h3 className="text-[15px] font-medium mb-2.5 group-hover:translate-x-1 transition-transform duration-300">
                                    {item.title}
                                </h3>
                                <p className="text-[13px] text-muted-foreground leading-[1.7] max-w-md">
                                    {item.description}
                                </p>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
};
