"use client";

import React, { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Reveal } from "@/components/landing/Reveal";

interface PromptItem {
    title: string;
    prompt: string;
}

interface PartnerPromptsProps {
    title: string;
    subtitle: string;
    items: PromptItem[];
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            onClick={() => {
                navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
        </button>
    );
}

export function PartnerPrompts({ title, subtitle, items }: PartnerPromptsProps) {
    return (
        <section className="py-24 sm:py-32">
            <div className="mx-auto max-w-6xl px-4 md:px-6">
                <Reveal>
                    <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground mb-4">Get started</p>
                </Reveal>
                <Reveal delay={0.05}>
                    <h2 className="text-3xl sm:text-[2.75rem] font-semibold tracking-[-0.03em] leading-[1.1] mb-6 max-w-lg">
                        {title}
                    </h2>
                </Reveal>
                <Reveal delay={0.1}>
                    <p className="text-muted-foreground leading-[1.7] max-w-lg mb-16">
                        {subtitle}
                    </p>
                </Reveal>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
                    {items.map((item, i) => (
                        <Reveal key={item.title} delay={i * 0.1}>
                            <div className="group">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-baseline gap-4">
                                        <span className="text-sm text-muted-foreground/30 tabular-nums font-mono">
                                            {String(i + 1).padStart(2, "0")}
                                        </span>
                                        <h3 className="text-base font-medium">{item.title}</h3>
                                    </div>
                                    <CopyButton text={item.prompt} />
                                </div>
                                <p className="text-[13px] font-mono text-muted-foreground leading-[1.8] bg-foreground/[0.03] rounded-lg p-5 group-hover:bg-foreground/[0.05] transition-colors duration-500 border border-border/20">
                                    {item.prompt}
                                </p>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
}
