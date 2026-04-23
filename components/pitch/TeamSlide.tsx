import React from "react";
import Image from "next/image";
import { PitchHeader, PitchQuote, PitchSlide, PitchTable, PitchGrid } from "./PitchPrimitives";

const founders = [
    {
        name: "Bola Roy Banjo",
        role: "CEO & Founder",
        bio: "22 years old. BSc Mechanical Engineering. Built Cencori from zero to a live, working infrastructure platform. Combines engineering depth with sharp product instinct.",
        avatar: "/roy.png",
    },
    {
        name: "Oreofe O. Daniel",
        role: "COO & Co-founder",
        bio: "Operations, business infrastructure, and execution lead. Focused on turning product velocity into a scalable operating organization.",
        avatar: "/daniel-avatar.png",
    },
];

const roadmap = [
    ["Senior Backend", "Q3 2026", "Infrastructure & Scaling"],
    ["Senior Infra", "Q3 2026", "Compute Layer Buildout"],
    ["Head of GTM", "Q4 2026", "Developer Marketing & Sales"],
];

export function TeamSlide() {
    return (
        <PitchSlide>
            <PitchHeader
                eyebrow="Team"
                title="Lean by design. Execution focused."
                subtitle="Founding team in place. Next hires clearly defined to hit Series A milestones."
            />

            <PitchGrid className="mt-12">
                <div className="grid grid-cols-2 gap-12">
                    {founders.map((founder, index) => (
                        <div key={founder.name} className="space-y-6">
                            <div className="relative h-64 w-full bg-zinc-900 overflow-hidden grayscale contrast-125">
                                <Image
                                    src={founder.avatar}
                                    alt={founder.name}
                                    fill
                                    className="object-cover"
                                    unoptimized
                                />
                            </div>
                            <div className="space-y-3">
                                <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/30">
                                    Founder 0{index + 1}
                                </p>
                                <p className="text-2xl font-medium text-white">{founder.name}</p>
                                <p className="text-xs font-bold uppercase tracking-widest text-white/40">{founder.role}</p>
                                <p className="text-base text-zinc-500 leading-relaxed font-light">
                                    {founder.bio}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex flex-col justify-between">
                    <div className="space-y-12">
                        <div className="space-y-6">
                            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/30">
                                Hiring Roadmap
                            </p>
                            <PitchTable 
                                headers={["Role", "Timing", "Ownership"]}
                                rows={roadmap}
                            />
                        </div>

                        <div className="space-y-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/30">
                                Operating Principle
                            </p>
                            <p className="text-2xl font-light text-zinc-400 leading-tight">
                                We know exactly where the team is lean and we are <span className="text-white font-medium">not pretending otherwise</span>.
                            </p>
                        </div>
                    </div>

                    <PitchQuote>
                        The capital goes directly into the talent required to build a category-defining company.
                    </PitchQuote>
                </div>
            </PitchGrid>
        </PitchSlide>
    );
}
