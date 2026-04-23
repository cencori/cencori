import React from "react";
import Image from "next/image";
import { PitchHeader, PitchMeta, PitchQuote, PitchSlide } from "./PitchPrimitives";

const founders = [
    {
        name: "Bola Banjo",
        role: "CEO & Co-founder",
        bio: "22 years old. BSc Mechanical Engineering. Built Cencori from zero to a live infrastructure platform with real users and shipped features.",
        note: "Previously worked on energy tech that drew interest from professors and researchers at Harvard and MIT.",
        avatar: "/roy.png",
    },
    {
        name: "Oreofe Ojurereoluwa Daniel",
        role: "COO & Co-founder",
        bio: "Leads operations, execution, and business infrastructure. Focused on turning product velocity into repeatable company-building systems.",
        note: "Owns the execution layer that turns product momentum into an investable operating company.",
        avatar: "/daniel-avatar.png",
    },
];

const needs = [
    "Two senior engineers",
    "One go-to-market lead",
    "The exact hires that take Cencori to Series A",
];

export function TeamSlide() {
    return (
        <PitchSlide>
            <PitchHeader
                eyebrow="Team"
                title="Lean by design, clear-eyed about what the next phase requires."
                subtitle="Founding team in place. Next hires clearly defined."
            />

            <div className="grid flex-1 gap-8 md:grid-cols-[1.05fr_0.95fr]">
                <div className="grid gap-6 md:grid-cols-2">
                    {founders.map((founder, index) => (
                        <article key={founder.name} className="border-t border-white/10 pt-4">
                            <div className="flex items-start gap-4">
                                <div className="h-20 w-20 overflow-hidden border border-white/10">
                                    <Image
                                        src={founder.avatar}
                                        alt={founder.name}
                                        width={80}
                                        height={80}
                                        className="h-full w-full object-cover"
                                        unoptimized
                                    />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">
                                        Founder 0{index + 1}
                                    </p>
                                    <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">
                                        {founder.name}
                                    </h3>
                                    <p className="mt-1 text-sm text-zinc-300">{founder.role}</p>
                                </div>
                            </div>

                            <p className="mt-4 text-[13px] leading-6 text-zinc-400">
                                {founder.bio}
                            </p>
                            <p className="mt-3 text-[12px] leading-5 text-zinc-500">
                                {founder.note}
                            </p>
                        </article>
                    ))}
                </div>

                <div className="flex flex-col justify-between">
                    <div className="border-t border-white/10 pt-4">
                        <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">
                            What we know we need
                        </p>
                        <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-200">
                            {needs.map((need) => (
                                <li key={need}>{need}</li>
                            ))}
                        </ul>
                    </div>

                    <div className="border-t border-white/10 pt-4">
                        <PitchMeta
                            label="Operating principle"
                            value="We are not pretending the team is complete."
                        />
                        <p className="mt-3 text-sm leading-6 text-zinc-500">
                            The capital goes directly into the people and systems required
                            to become a Series A company.
                        </p>
                    </div>

                    <PitchQuote>
                        Cencori is intelligence infrastructure from Africa, for the world.
                    </PitchQuote>
                </div>
            </div>
        </PitchSlide>
    );
}
