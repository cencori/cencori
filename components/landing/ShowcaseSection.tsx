import React from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/landing/Reveal";

interface ShowcaseItem {
    title: string;
    description: string;
}

interface ShowcaseSectionProps {
    eyebrow: string;
    title: React.ReactNode;
    description: string;
    items: ShowcaseItem[];
    imageLabel: string;
    imageHint: string;
    reverse?: boolean;
    accentEyebrow?: boolean;
    className?: string;
}

export function ShowcaseSection({
    eyebrow,
    title,
    description,
    items,
    imageLabel,
    imageHint,
    reverse = false,
    accentEyebrow = false,
    className,
}: ShowcaseSectionProps) {
    return (
        <section className={cn("py-24 sm:py-32 bg-background", className)}>
            <div className="mx-auto max-w-6xl px-4 md:px-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
                    <div className={cn(reverse && "lg:order-2")}>
                        <Reveal>
                            <p
                                className={cn(
                                    "mb-4 text-[11px] font-medium uppercase tracking-[0.25em]",
                                    accentEyebrow ? "text-emerald-500" : "text-muted-foreground/60"
                                )}
                            >
                                {eyebrow}
                            </p>
                        </Reveal>
                        <Reveal delay={0.05}>
                            <h2 className="max-w-xl text-3xl sm:text-[2.75rem] font-semibold tracking-[-0.03em] leading-[1.1] mb-6 text-balance">
                                {title}
                            </h2>
                        </Reveal>
                        <Reveal delay={0.1}>
                            <p className="max-w-md text-muted-foreground leading-[1.7]">
                                {description}
                            </p>
                        </Reveal>
                    </div>

                    <div className={cn("space-y-10 sm:space-y-12", reverse && "lg:order-1")}>
                        {items.map((item, index) => (
                            <Reveal key={item.title} delay={index * 0.08}>
                                <div>
                                    <h3 className="text-lg font-medium mb-2">{item.title}</h3>
                                    <p className="text-sm text-muted-foreground leading-[1.7]">
                                        {item.description}
                                    </p>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>

                <Reveal delay={0.15} className="mt-16 sm:mt-20">
                    <div className="overflow-hidden rounded-xl border border-border/40 bg-foreground/[0.02]">
                        <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
                            <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">
                                {imageLabel}
                            </span>
                            <span className="text-[10px] text-muted-foreground/50">
                                Image slot
                            </span>
                        </div>
                        <div className="aspect-[16/10] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.04),_transparent_55%)] flex items-center justify-center px-6 text-center">
                            <p className="max-w-xs text-[11px] uppercase tracking-[0.25em] text-muted-foreground/50">
                                {imageHint}
                            </p>
                        </div>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}
