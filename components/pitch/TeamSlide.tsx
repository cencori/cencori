import React from "react";
import Image from "next/image";
import { PitchHeader, PitchMeta, PitchQuote, PitchSlide, PitchTable } from "./PitchPrimitives";

const founders = [
    {
        name: "Bola Roy Banjo",
        role: "CEO & Founder",
        bio: "22 years old. BSc Mechanical Engineering. Built Cencori from zero to a live, working infrastructure platform. Combines engineering depth with sharp product instinct.",
        note: "Built energy tech that drew interest from researchers at Harvard and MIT.",
        avatar: "/roy.png",
    },
    {
        name: "Oreofe O. Daniel",
        role: "COO & Co-founder",
        bio: "Operations, business infrastructure, and execution lead. Focused on turning product velocity into a scalable operating company.",
        note: "Owns the systems that power Cencori's operational efficiency.",
        avatar: "/daniel-avatar.png",
    },
];

const hiringRoadmap = [
    ["Senior Backend", "Q3 2026", "Infrastructure & Scaling"],
    ["Senior Infra", "Q3 2026", "Compute Layer Buildout"],
    ["Head of GTM", "Q4 2026", "Developer Marketing & Sales"],
    ["Backend Int.", "Q4 2026", "Platform Reliability"],
];

export function TeamSlide() {
    return (
        <PitchSlide>
            <PitchHeader
                eyebrow="Team"
                title="Lean by design, clear-eyed about what the next phase requires."
                subtitle="Founding team in place. Next hires clearly defined to hit Series A milestones."
            />

            <div className="grid flex-1 gap-12 md:grid-cols-[1.2fr_0.8fr]">
                {/* Founding Team Section */}
                <div className="flex flex-col justify-center space-y-10">
                    <div className="grid gap-8 md:grid-cols-2">
                        {founders.map((founder, index) => (
                            <article key={founder.name} className="space-y-4">
                                <div className="group relative h-48 w-full overflow-hidden bg-white/5">
                                    <Image
                                        src={founder.avatar}
                                        alt={founder.name}
                                        fill
                                        className="object-cover grayscale transition-all group-hover:grayscale-0"
                                        unoptimized
                                    />
                                    <div className="absolute top-4 left-4">
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50 bg-black/40 px-2 py-1 backdrop-blur-md">
                                            Founder 0{index + 1}
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-xl font-medium text-foreground">
                                        {founder.name}
                                    </h3>
                                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/80">
                                        {founder.role}
                                    </p>
                                    <p className="text-sm leading-relaxed text-muted-foreground/90">
                                        {founder.bio}
                                    </p>
                                    {founder.note && (
                                        <p className="text-xs italic text-muted-foreground/60 border-l border-white/10 pl-3 py-1">
                                            {founder.note}
                                        </p>
                                    )}
                                </div>
                            </article>
                        ))}
                    </div>
                </div>

                {/* Scaling Strategy Section */}
                <div className="flex flex-col justify-between py-4">
                    <div className="space-y-10">
                        <div className="space-y-6">
                            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/80">
                                Hiring Roadmap • Next 12 Months
                            </p>
                            <PitchTable 
                                headers={["Role", "Timing", "Ownership"]}
                                rows={hiringRoadmap}
                            />
                        </div>

                        <div className="space-y-4 bg-white/5 p-6 border-l-2 border-white/20">
                            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/80">
                                Operating Principle
                            </p>
                            <p className="text-lg font-medium text-foreground leading-snug">
                                "We know exactly where the team is lean and we are not pretending otherwise."
                            </p>
                            <p className="text-sm text-muted-foreground">
                                This raise funds the specific engineering and GTM talent required to reach $4M ARR and Series A readiness.
                            </p>
                        </div>
                    </div>

                    <PitchQuote>
                        The capital goes directly into the people and systems required to become a Series A company.
                    </PitchQuote>
                </div>
            </div>
        </PitchSlide>
    );
}
