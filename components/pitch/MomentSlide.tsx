import React from "react";
import { PitchMeta, PitchRuleList, PitchSlide } from "./PitchPrimitives";

const internetEra = [
    "Servers",
    "CDNs",
    "Payment rails",
    "Cloud compute",
];

const intelligenceEra = [
    "Gateway",
    "Billing",
    "Compute",
    "Memory",
];

export function MomentSlide() {
    return (
        <PitchSlide className="justify-between">
            <div className="border-b border-white/10 pb-5">
                <div className="grid gap-5 md:grid-cols-[1.35fr_0.7fr] md:items-end">
                    <div>
                        <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-zinc-500">
                            The moment
                        </p>
                        <h2 className="mt-2 max-w-5xl text-[2.25rem] font-semibold leading-[0.98] tracking-[-0.06em] text-white md:text-[3.65rem]">
                            We are living through the most significant infrastructure
                            shift in the history of computing.
                        </h2>
                    </div>
                    <div className="md:border-l md:border-white/10 md:pl-6">
                        <PitchMeta
                            label="What changed"
                            value="The internet needed infrastructure companies. AI is an even larger platform shift, and its infrastructure layer still does not exist."
                        />
                    </div>
                </div>
            </div>

            <div className="grid flex-1 gap-8 py-7 md:grid-cols-[0.72fr_1.28fr] md:gap-10">
                <div className="flex flex-col justify-between">
                    <div className="space-y-5">
                        <p className="text-[1.02rem] leading-7 text-zinc-200 md:text-[1.12rem] md:leading-8">
                            The internet needed servers, CDNs, payment rails, and cloud
                            compute. Companies like AWS, Stripe, and Cloudflare were built
                            to serve that shift.
                        </p>
                        <p className="text-[13px] leading-6 text-zinc-500 md:text-[15px] md:leading-7">
                            AI needs its own infrastructure layer. Not just compute. Not
                            just an API gateway. Not just billing. The entire stack,
                            unified, controlled, and accessible to every team building
                            intelligent products.
                        </p>
                    </div>

                    <div className="border-t border-white/10 pt-5">
                        <p className="max-w-md text-[1.22rem] font-medium leading-[1.25] tracking-[-0.04em] text-white md:text-[1.65rem]">
                            That infrastructure does not exist yet.
                        </p>
                        <p className="mt-2 text-[1.22rem] font-medium leading-[1.25] tracking-[-0.04em] text-zinc-400 md:text-[1.65rem]">
                            Cencori is building it.
                        </p>
                    </div>
                </div>

                <div className="border-l border-white/10 pl-6 md:pl-7">
                    <div className="grid gap-8 md:grid-cols-2">
                        <section>
                            <div className="flex flex-col gap-2">
                                <p className="text-sm font-medium text-white">
                                    The internet era
                                </p>
                                <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">
                                    AWS, Stripe, Cloudflare
                                </p>
                            </div>
                            <PitchRuleList items={internetEra} className="mt-4" />
                        </section>

                        <section>
                            <div className="flex flex-col gap-2">
                                <p className="text-sm font-medium text-white">
                                    The intelligence era
                                </p>
                                <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">
                                    Still being built
                                </p>
                            </div>
                            <PitchRuleList items={intelligenceEra} className="mt-4" />
                        </section>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 border-t border-white/10 pt-4 md:grid-cols-[1.08fr_0.92fr] md:items-end">
                <p className="text-sm leading-6 text-zinc-300 md:text-[15px] md:leading-7">
                    Every platform shift creates new infrastructure leaders. The AI era
                    will be no different.
                </p>
                <p className="text-sm leading-6 text-zinc-500 md:text-right md:text-[13px]">
                    The opportunity is not a feature or a point solution. It is the
                    missing infrastructure layer for intelligent systems.
                </p>
            </div>
        </PitchSlide>
    );
}
