import React from "react";
import {
    LockClosedIcon,
    ExclamationTriangleIcon,
    CurrencyDollarIcon,
    DocumentTextIcon,
} from "@heroicons/react/24/outline";

const problems = [
    {
        icon: LockClosedIcon,
        title: "Provider Lock-in",
        description:
            "Switching from OpenAI to Anthropic means rewriting your entire integration layer.",
        stat: "3-4 weeks",
        statLabel: "average migration time",
    },
    {
        icon: ExclamationTriangleIcon,
        title: "Security Gaps",
        description:
            "PII leaks, prompt injection attacks, no audit trail. Most teams discover issues after launch.",
        stat: "67%",
        statLabel: "of AI apps have security vulnerabilities",
    },
    {
        icon: CurrencyDollarIcon,
        title: "Cost Surprises",
        description:
            "No visibility into AI spend until the bill arrives. Token costs spiral out of control.",
        stat: "$50K+",
        statLabel: "unexpected overages common",
    },
    {
        icon: DocumentTextIcon,
        title: "Compliance Burden",
        description:
            "SOC2, GDPR, HIPAA require months of work. Enterprise deals stall without certifications.",
        stat: "6+ months",
        statLabel: "to achieve compliance",
    },
];

export function ProblemSlide() {
    return (
        <div className="h-full flex flex-col p-8 md:p-12">
            {/* Header */}
            <div className="mb-8">
                <span className="text-xs font-medium text-amber-500 uppercase tracking-wider">
                    The Problem
                </span>
                <h2 className="text-2xl md:text-4xl font-bold mt-2">
                    Building AI is easy.
                    <br />
                    <span className="text-muted-foreground">
                        Building it for production is hard.
                    </span>
                </h2>
            </div>

            {/* Problem Grid */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {problems.map((problem, index) => (
                    <div
                        key={index}
                        className="group p-5 rounded-xl border border-border/50 bg-muted/20 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all"
                    >
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                                <problem.icon className="h-5 w-5 text-amber-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-sm md:text-base mb-1">
                                    {problem.title}
                                </h3>
                                <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                                    {problem.description}
                                </p>
                                <div className="mt-3 flex items-baseline gap-2">
                                    <span className="text-lg md:text-xl font-bold text-amber-500">
                                        {problem.stat}
                                    </span>
                                    <span className="text-[10px] md:text-xs text-muted-foreground">
                                        {problem.statLabel}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Bottom message */}
            <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                    Every AI team faces these challenges. Most solve them from scratch.
                </p>
            </div>
        </div>
    );
}
