import React from "react";
import {
    ArrowRightIcon,
    EnvelopeIcon,
    GlobeAltIcon,
    CalendarIcon,
} from "@heroicons/react/24/outline";

const useOfFunds = [
    {
        category: "Engineering",
        percentage: 60,
        description: "Expand team, build enterprise features",
    },
    {
        category: "Go-to-Market",
        percentage: 25,
        description: "Developer marketing, partnerships",
    },
    {
        category: "Operations",
        percentage: 15,
        description: "Infrastructure, compliance",
    },
];

const milestones = [
    "Launch enterprise tier with SOC2 compliance",
    "Expand to 10,000+ developers",
    "10+ enterprise customers",
    "Reach $100K MRR",
];

export function AskSlide() {
    return (
        <div className="h-full flex flex-col p-8 md:p-12 relative overflow-hidden">
            {/* Header */}
            <div className="relative z-10 mb-6">
                <span className="text-xs font-medium text-emerald-500 uppercase tracking-wider">
                    The Ask
                </span>
                <h2 className="text-2xl md:text-4xl font-bold mt-2">
                    Join us in building the future of{" "}
                    <span className="text-emerald-500">AI infrastructure.</span>
                </h2>
            </div>

            {/* Main Content */}
            <div className="relative z-10 flex-1 grid grid-cols-2 gap-6">
                {/* Left: The Ask */}
                <div className="space-y-4">
                    {/* Raise Amount */}
                    <div className="p-6 rounded-xl border-2 border-emerald-500/50 bg-emerald-500/5">
                        <p className="text-sm text-muted-foreground mb-2">We're raising</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl md:text-5xl font-bold text-emerald-500">
                                $3M
                            </span>
                            <span className="text-sm text-muted-foreground">
                                Pre-Seed Round
                            </span>
                        </div>
                    </div>

                    {/* Use of Funds */}
                    <div className="p-4 rounded-xl border border-border/50 bg-card">
                        <h3 className="text-sm font-medium mb-3">Use of Funds</h3>
                        <div className="space-y-3">
                            {useOfFunds.map((item, index) => (
                                <div key={index}>
                                    <div className="flex items-center justify-between text-xs mb-1">
                                        <span className="font-medium">{item.category}</span>
                                        <span className="text-emerald-500">{item.percentage}%</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-500 rounded-full"
                                            style={{ width: `${item.percentage}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                        {item.description}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right: Milestones & Contact */}
                <div className="space-y-4">
                    {/* Milestones */}
                    <div className="p-4 rounded-xl border border-border/50 bg-card">
                        <h3 className="text-sm font-medium mb-3">18-Month Milestones</h3>
                        <ul className="space-y-2">
                            {milestones.map((milestone, index) => (
                                <li key={index} className="flex items-start gap-2 text-xs">
                                    <ArrowRightIcon className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                                    <span>{milestone}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Contact */}
                    <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                        <h3 className="text-sm font-medium mb-3">Let's Talk</h3>
                        <div className="space-y-2">
                            <a
                                href="mailto:bola@cencori.com"
                                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <EnvelopeIcon className="h-3.5 w-3.5 text-emerald-500" />
                                bola@cencori.com
                            </a>
                            <a
                                href="https://cencori.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <GlobeAltIcon className="h-3.5 w-3.5 text-emerald-500" />
                                cencori.com
                            </a>
                            <a
                                href="https://cal.com/cencori"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <CalendarIcon className="h-3.5 w-3.5 text-emerald-500" />
                                Schedule a call
                            </a>
                        </div>
                    </div>

                    {/* CTA */}
                    <div className="p-4 rounded-xl bg-emerald-500 text-white text-center">
                        <p className="font-semibold">
                            Ready to invest in AI infrastructure?
                        </p>
                        <p className="text-xs text-emerald-100 mt-1">
                            Let's build the future together.
                        </p>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="relative z-10 mt-6 pt-4 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                <span>Cencori • FohnAI Inc.</span>
                <span>Confidential</span>
                <span>2026</span>
            </div>
        </div>
    );
}
