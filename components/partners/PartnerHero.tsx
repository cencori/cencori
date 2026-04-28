"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/landing/Reveal";

interface PartnerHeroProps {
    name: string;
    title: React.ReactNode;
    subtitle: string;
    cta: { text: string; href: string };
    secondaryCta?: { text: string; href: string };
}

export function PartnerHero({ name, title, subtitle, cta, secondaryCta }: PartnerHeroProps) {
    return (
        <section className="pb-24 sm:pb-32">
            <div className="mx-auto max-w-6xl px-4 md:px-6">
                <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground mb-8 animate-appear">
                    For {name}
                </p>
                <h1 className="text-[2.75rem] sm:text-[3.5rem] lg:text-[4.25rem] font-semibold tracking-[-0.035em] leading-[1.05] mb-8 max-w-3xl animate-appear [animation-delay:100ms]">
                    {title}
                </h1>
                <p className="text-base sm:text-lg text-muted-foreground leading-[1.7] max-w-[28rem] mb-12 animate-appear [animation-delay:200ms]">
                    {subtitle}
                </p>
                <div className="flex gap-4 animate-appear [animation-delay:300ms]">
                    <Link href={cta.href}>
                        <Button size="sm" className="h-7 text-xs px-3">{cta.text}</Button>
                    </Link>
                    {secondaryCta && (
                        <Link href={secondaryCta.href}>
                            <Button variant="outline" size="sm" className="h-7 text-xs px-3">{secondaryCta.text}</Button>
                        </Link>
                    )}
                </div>
            </div>
        </section>
    );
}
