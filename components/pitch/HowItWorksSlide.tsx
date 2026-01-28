import React from "react";
import {
    ShieldCheckIcon,
    BoltIcon,
    ChartBarIcon,
} from "@heroicons/react/24/outline";

const steps = [
    { num: "01", title: "Integrate", description: "Add Cencori SDK to your app" },
    {
        num: "02",
        title: "Configure",
        description: "Set up providers & security rules",
    },
    { num: "03", title: "Deploy", description: "Ship with confidence" },
];

export function HowItWorksSlide() {
    return (
        <div className="h-full flex flex-col p-8 md:p-12">
            {/* Header */}
            <div className="mb-6">
                <span className="text-xs font-medium text-emerald-500 uppercase tracking-wider">
                    How It Works
                </span>
                <h2 className="text-2xl md:text-4xl font-bold mt-2">
                    From integration to production{" "}
                    <span className="text-emerald-500">in minutes.</span>
                </h2>
            </div>

            {/* Architecture Diagram */}
            <div className="flex-1 flex items-center justify-center">
                <div className="w-full max-w-4xl">
                    {/* Flow diagram */}
                    <div className="flex items-center justify-between gap-2 md:gap-4">
                        {/* Your App */}
                        <div className="flex-1 p-4 rounded-xl border border-border/50 bg-card text-center">
                            <div className="w-10 h-10 rounded-lg bg-muted mx-auto mb-2 flex items-center justify-center">
                                <span className="text-lg">🚀</span>
                            </div>
                            <h3 className="font-semibold text-sm">Your App</h3>
                            <p className="text-[10px] text-muted-foreground mt-1">
                                Next.js, React, Python, Go
                            </p>
                        </div>

                        {/* Arrow */}
                        <div className="flex flex-col items-center">
                            <div className="w-8 md:w-16 h-0.5 bg-emerald-500" />
                            <span className="text-[8px] text-muted-foreground mt-1">
                                SDK Call
                            </span>
                        </div>

                        {/* Cencori */}
                        <div className="flex-[2] p-4 rounded-xl border-2 border-emerald-500/50 bg-emerald-500/5">
                            <div className="text-center mb-3">
                                <h3 className="font-bold text-emerald-500">Cencori</h3>
                                <p className="text-[10px] text-muted-foreground">AI Gateway</p>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="p-2 rounded-lg bg-card border border-border/50 text-center">
                                    <ShieldCheckIcon className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
                                    <span className="text-[8px]">Security</span>
                                </div>
                                <div className="p-2 rounded-lg bg-card border border-border/50 text-center">
                                    <BoltIcon className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
                                    <span className="text-[8px]">Routing</span>
                                </div>
                                <div className="p-2 rounded-lg bg-card border border-border/50 text-center">
                                    <ChartBarIcon className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
                                    <span className="text-[8px]">Analytics</span>
                                </div>
                            </div>
                        </div>

                        {/* Arrow */}
                        <div className="flex flex-col items-center">
                            <div className="w-8 md:w-16 h-0.5 bg-emerald-500" />
                            <span className="text-[8px] text-muted-foreground mt-1">
                                API Call
                            </span>
                        </div>

                        {/* Providers */}
                        <div className="flex-1 p-4 rounded-xl border border-border/50 bg-card text-center">
                            <div className="w-10 h-10 rounded-lg bg-muted mx-auto mb-2 flex items-center justify-center">
                                <span className="text-lg">🤖</span>
                            </div>
                            <h3 className="font-semibold text-sm">AI Providers</h3>
                            <p className="text-[10px] text-muted-foreground mt-1">
                                OpenAI, Anthropic, Google
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Steps */}
            <div className="mt-8 grid grid-cols-3 gap-4">
                {steps.map((step, index) => (
                    <div key={index} className="text-center">
                        <div className="inline-flex items-center gap-2 mb-2">
                            <span className="text-2xl font-bold text-emerald-500/30">
                                {step.num}
                            </span>
                            <span className="font-semibold">{step.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{step.description}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
