"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/landing/Reveal";

interface PartnerCTAProps {
    pricingCallout: {
        title: React.ReactNode;
        subtitle: string;
        cta: { text: string; href: string };
    };
    bottomCta: {
        title: string;
        subtitle: string;
        primaryCta: { text: string; href: string };
        secondaryCta: { text: string; href: string };
    };
}

export function PartnerCTA({ pricingCallout, bottomCta }: PartnerCTAProps) {
    return (
        <>
            {/* Pricing Callout */}
            <section className="py-24 sm:py-32 border-t border-border/40">
                <div className="mx-auto max-w-6xl px-4 md:px-6">
                    <Reveal>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-end">
                            <div>
                                <h2 className="text-3xl sm:text-[2.75rem] font-semibold tracking-[-0.03em] leading-[1.1] mb-6">
                                    {pricingCallout.title}
                                </h2>
                                <p className="text-muted-foreground leading-[1.7] max-w-md">
                                    {pricingCallout.subtitle}
                                </p>
                            </div>
                            <div className="flex lg:justify-end">
                                <Link href={pricingCallout.cta.href}>
                                    <Button variant="outline" size="sm" className="h-7 text-xs px-3 group">
                                        {pricingCallout.cta.text}
                                        <span className="ml-2 group-hover:translate-x-0.5 transition-transform duration-300 inline-block">&rarr;</span>
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* Bottom CTA */}
            <section className="py-28 sm:py-36 bg-foreground/[0.01] border-t border-border/40">
                <div className="mx-auto max-w-6xl px-4 md:px-6 text-center">
                    <Reveal>
                        <h2 className="text-3xl sm:text-[2.75rem] font-semibold tracking-[-0.03em] leading-[1.1] mb-5">
                            {bottomCta.title}
                        </h2>
                        <p className="text-muted-foreground text-sm leading-[1.7] mb-10 max-w-md mx-auto">
                            {bottomCta.subtitle}
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <Link href={bottomCta.primaryCta.href}>
                                <Button size="sm" className="h-7 text-xs px-3">{bottomCta.primaryCta.text}</Button>
                            </Link>
                            <Link href={bottomCta.secondaryCta.href}>
                                <Button variant="outline" size="sm" className="h-7 text-xs px-3">{bottomCta.secondaryCta.text}</Button>
                            </Link>
                        </div>
                    </Reveal>
                </div>
            </section>
        </>
    );
}
