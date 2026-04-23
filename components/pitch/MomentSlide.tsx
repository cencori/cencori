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
            <div className="pb-2">
                <div className="grid gap-3 md:grid-cols-[1.35fr_0.7fr] md:items-end">
                    <div>
                        <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
                            The moment
                        </p>
                        <h2 className="mt-2 max-w-5xl text-[2.25rem] font-semibold leading-[0.98] tracking-[-0.06em] text-foreground md:text-[3.65rem]">
                            We are living through the most significant infrastructure
                            shift in the history of computing.
                        </h2>
                    </div>
                    <div className="md: md: md:pl-6">
                        <PitchMeta
                            label="What changed"
                            value="The internet needed infrastructure companies. AI is an even larger platform shift, and its infrastructure layer still does not exist."
                        />
                    </div>
                </div>
            </div>

            <div className="grid flex-1 gap-2 py-2 md:grid-cols-[0.72fr_1.28fr] md:gap-3">
                <div className="flex flex-col justify-between">
                    <div className="space-y-3">
                        <p className="text-[1.02rem] leading-7 text-muted-foreground md:text-[1.12rem] md:leading-8">
                            The internet needed servers, CDNs, payment rails, and cloud
                            compute. Companies like AWS, Stripe, and Cloudflare were built
                            to serve that shift — and each became worth hundreds of
                            billions of dollars.
                        </p>
                        <p className="text-[13px] leading-6 text-muted-foreground md:text-[15px] md:leading-7">
                            AI is a larger shift. And it needs its own infrastructure layer. Not
                            just compute. Not just an API gateway. Not just billing. The
                            entire stack — unified, controlled, and accessible to every team
                            building intelligent products.
                        </p>
                    </div>

                    <div className="pt-2">
                        <p className="max-w-md text-[1.22rem] font-medium leading-[1.25] tracking-[-0.04em] text-foreground md:text-[1.65rem]">
                            That infrastructure doesn't exist yet.
                        </p>
                        <p className="mt-2 text-[1.22rem] font-medium leading-[1.25] tracking-[-0.04em] text-muted-foreground md:text-[1.65rem]">
                            Cencori is building it.
                        </p>
                    </div>
                </div>

                <div className="pl-6 md:pl-7">
                    <div className="grid gap-2 md:grid-cols-2">
                        <section>
                            <div className="flex flex-col gap-2">
                                <p className="text-[10px] font-medium text-foreground">
                                    The internet era
                                </p>
                                <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                                    AWS, Stripe, Cloudflare
                                </p>
                            </div>
                            <PitchRuleList items={internetEra} className="mt-2" />
                        </section>

                        <section>
                            <div className="flex flex-col gap-2">
                                <p className="text-[10px] font-medium text-foreground">
                                    The intelligence era
                                </p>
                                <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                                    Still being built
                                </p>
                            </div>
                            <PitchRuleList items={intelligenceEra} className="mt-2" />
                        </section>
                    </div>
                </div>
            </div>

            <div className="grid gap-2 pt-2 md:grid-cols-[1.08fr_0.92fr] md:items-end">
                <p className="text-[10px] leading-6 text-muted-foreground md:text-[15px] md:leading-7">
                    Every platform shift creates new infrastructure leaders. The AI era
                    will be no different.
                </p>
                <p className="text-[10px] leading-6 text-muted-foreground md:text-right md:text-[13px]">
                    The opportunity is not a feature or a point solution. It is the
                    missing infrastructure layer for intelligent systems.
                </p>
            </div>
        </PitchSlide>
    );
}
