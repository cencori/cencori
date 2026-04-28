"use client";

import React, { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Reveal } from "@/components/landing/Reveal";
import { VercelLogo } from "@/components/icons/BrandIcons";

interface PartnerCodeSectionProps {
    title: string;
    subtitle: React.ReactNode;
    code: string;
    fileName: string;
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

export function PartnerCodeSection({ title, subtitle, code, fileName }: PartnerCodeSectionProps) {
    return (
        <section className="py-24 sm:py-32 bg-foreground/[0.01] border-y border-border/40">
            <div className="mx-auto max-w-6xl px-4 md:px-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
                    <div>
                        <Reveal>
                            <div className="flex items-center gap-3 mb-8">
                                <VercelLogo className="h-4 w-4 text-foreground" />
                                <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                    Vercel AI SDK
                                </span>
                            </div>
                        </Reveal>
                        <Reveal delay={0.05}>
                            <h2 className="text-3xl sm:text-[2.75rem] font-semibold tracking-[-0.03em] leading-[1.1] mb-6">
                                {title}
                                <br />
                                <span className="text-muted-foreground">{subtitle}</span>
                            </h2>
                        </Reveal>
                        <Reveal delay={0.1}>
                            <p className="text-muted-foreground leading-[1.7] max-w-md mb-10">
                                Already using Vercel AI SDK? Keep using{" "}
                                <code className="text-[13px] text-foreground/70 font-mono">streamText()</code> and{" "}
                                <code className="text-[13px] text-foreground/70 font-mono">useChat()</code> — just swap the model.
                            </p>
                        </Reveal>
                        <Reveal delay={0.15}>
                            <div className="space-y-3 text-sm text-muted-foreground">
                                <p className="group cursor-default hover:text-foreground transition-colors duration-300">
                                    <span className="text-emerald-500/60 mr-3">&#x2713;</span>
                                    One API for OpenAI, Claude, Gemini
                                </p>
                                <p className="group cursor-default hover:text-foreground transition-colors duration-300">
                                    <span className="text-emerald-500/60 mr-3">&#x2713;</span>
                                    Safety filtering on every request
                                </p>
                                <p className="group cursor-default hover:text-foreground transition-colors duration-300">
                                    <span className="text-emerald-500/60 mr-3">&#x2713;</span>
                                    Cost tracking built-in
                                </p>
                            </div>
                        </Reveal>
                    </div>

                    {/* Code block */}
                    <Reveal delay={0.1}>
                        <div className="relative group">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[11px] font-mono text-muted-foreground/50">{fileName}</span>
                                <CopyButton text={code} />
                            </div>
                            <div className="bg-foreground/[0.02] rounded-xl p-6 sm:p-8 border border-border/40 overflow-hidden">
                                <pre className="text-[13px] sm:text-sm font-mono leading-[1.8] text-foreground/80 overflow-x-auto custom-scrollbar">
                                    <code>
                                        {code.split('\n').map((line, i) => (
                                            <div key={i} className="flex gap-4">
                                                <span className="text-muted-foreground/30 select-none w-4 text-right">{i + 1}</span>
                                                <span>{line}</span>
                                            </div>
                                        ))}
                                    </code>
                                </pre>
                            </div>
                        </div>
                    </Reveal>
                </div>
            </div>
        </section>
    );
}
