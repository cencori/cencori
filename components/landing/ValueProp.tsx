import React from "react";
import { Logo } from "@/components/logo";
import { OpenAILogo, GeminiLogo, AnthropicLogo, XAILogo } from "@/components/logos/ai-models";
import { TechnicalBorder } from "./TechnicalBorder";
import { Check } from "lucide-react";

export const ValueProp = () => {
    return (
        <section className="py-24 bg-background border-b border-border/40 overflow-hidden">
            <div className="container mx-auto px-4 md:px-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">

                    {/* Left: Content */}
                    <div className="flex flex-col gap-8">
                        <h2 className="text-3xl md:text-5xl font-bold tracking-tighter">
                            Everything you need <br />
                            <span className="text-muted-foreground">to ship AI</span>
                        </h2>
                        <p className="text-lg text-muted-foreground leading-relaxed">
                            From gateway to compute to workflows. Cencori handles infrastructure so you can focus on your product — with security, logging, and cost tracking built-in.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                            {[
                                "Audit Logs",
                                "PII Protection",
                                "Security Scanning",
                                "Cost Tracking",
                                "Performance Metrics",
                                "Multi-tenancy"
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="w-5 h-5 border border-foreground flex items-center justify-center bg-foreground text-background">
                                        <Check className="w-3 h-3" />
                                    </div>
                                    <span className="font-medium">{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: Visual */}
                    <div className="relative">
                        <TechnicalBorder className="w-full aspect-square md:aspect-video lg:aspect-square" cornerSize={24} borderWidth={2}>
                            <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center p-8">
                                {/* Abstract visualization of the "Layer" */}
                                <div className="relative w-full max-w-sm flex flex-col items-center">

                                    {/* Top Layer: App */}
                                    <div className="w-full h-16 border border-border bg-background flex items-center justify-center relative z-10 rounded-none">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-red-500 border border-red-600" />
                                            <div className="w-2 h-2 rounded-full bg-yellow-500 border border-yellow-600" />
                                            <div className="w-2 h-2 rounded-full bg-green-500 border border-green-600" />
                                            <span className="font-mono font-bold ml-2 text-sm">YOUR APP</span>
                                        </div>

                                        {/* Connection Line Down */}
                                        <div className="absolute -bottom-8 left-1/2 w-px h-8 bg-border overflow-hidden">
                                            <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500 animate-[drop_1.5s_infinite]" />
                                        </div>
                                    </div>

                                    {/* Middle Layer: Cencori (Highlighted) */}
                                    <div className="w-full h-24 mt-8 bg-zinc-950 text-foreground flex items-center justify-center">
                                        <div className="flex flex-col items-center">
                                            <img src="/cdark.png" alt="Cencori logo" className="h-20 w-auto" />
                                        </div>

                                        {/* Connection Line Up */}
                                        <div className="absolute -top-8 left-1/2 w-px h-8 bg-border overflow-hidden">
                                            <div className="absolute bottom-0 left-0 w-full h-2 bg-emerald-500 animate-[rise_1.5s_infinite_0.75s]" />
                                        </div>

                                        {/* Connection Line Down */}
                                        <div className="absolute -bottom-8 left-1/2 w-px h-8 bg-border overflow-hidden">
                                            <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500 animate-[drop_1.5s_infinite]" />
                                        </div>

                                        {/* Pulse Effect */}
                                        <div className="absolute inset-0 border border-emerald-500/50 animate-pulse" />
                                    </div>

                                    {/* Bottom Layer: AI Models */}
                                    <div className="w-full mt-8 border border-border bg-background p-4 relative z-10">
                                        <div className="grid grid-cols-4 gap-4 items-center justify-items-center opacity-80">
                                            <OpenAILogo className="h-6 w-6" />
                                            <GeminiLogo className="h-6 w-6" />
                                            <AnthropicLogo className="h-6 w-6" />
                                            <XAILogo className="h-5 w-5" />
                                        </div>

                                        {/* Connection Line Up */}
                                        <div className="absolute -top-8 left-1/2 w-px h-8 bg-border overflow-hidden">
                                            <div className="absolute bottom-0 left-0 w-full h-2 bg-emerald-500 animate-[rise_1.5s_infinite_0.75s]" />
                                        </div>
                                    </div>

                                    {/* Global Scan Line */}
                                    <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
                                        <div className="absolute top-1/2 left-0 w-full h-px bg-emerald-500/20 blur-[1px] animate-[scan_4s_ease-in-out_infinite]" />
                                    </div>
                                </div>
                            </div>
                        </TechnicalBorder>
                    </div>
                </div>
            </div>
        </section>
    );
};
