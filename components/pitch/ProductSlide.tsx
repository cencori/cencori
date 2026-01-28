import React from "react";
import {
    ComputerDesktopIcon,
    CommandLineIcon,
    ShieldCheckIcon,
    ChartBarIcon,
} from "@heroicons/react/24/outline";

const productFeatures = [
    {
        icon: ComputerDesktopIcon,
        title: "Dashboard",
        description: "Real-time analytics, request logs, and cost tracking",
        preview: (
            <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                        Total Requests
                    </span>
                    <span className="text-sm font-bold">1.2M</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                        Cost This Month
                    </span>
                    <span className="text-sm font-bold text-emerald-500">$847.32</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">Avg Latency</span>
                    <span className="text-sm font-bold">142ms</span>
                </div>
            </div>
        ),
    },
    {
        icon: CommandLineIcon,
        title: "SDKs",
        description: "TypeScript, Python, and Go with full type safety",
        preview: (
            <div className="bg-muted/30 rounded-lg p-3">
                <div className="flex gap-2">
                    {["TypeScript", "Python", "Go"].map((lang) => (
                        <span
                            key={lang}
                            className="px-2 py-1 text-[10px] rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                        >
                            {lang}
                        </span>
                    ))}
                </div>
            </div>
        ),
    },
    {
        icon: ShieldCheckIcon,
        title: "Security",
        description: "PII detection, prompt injection protection, content filtering",
        preview: (
            <div className="bg-muted/30 rounded-lg p-3 space-y-1.5">
                {["PII Detection", "Prompt Injection", "Content Filter"].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-[10px]">{item}</span>
                        <span className="text-[10px] text-emerald-500 ml-auto">Active</span>
                    </div>
                ))}
            </div>
        ),
    },
    {
        icon: ChartBarIcon,
        title: "Analytics",
        description: "Usage patterns, model performance, and cost optimization",
        preview: (
            <div className="bg-muted/30 rounded-lg p-3">
                <div className="flex items-end gap-1 h-12">
                    {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                        <div
                            key={i}
                            className="flex-1 bg-emerald-500 rounded-t"
                            style={{ height: `${h}%` }}
                        />
                    ))}
                </div>
            </div>
        ),
    },
];

export function ProductSlide() {
    return (
        <div className="h-full flex flex-col p-8 md:p-12">
            {/* Header */}
            <div className="mb-6">
                <span className="text-xs font-medium text-emerald-500 uppercase tracking-wider">
                    The Product
                </span>
                <h2 className="text-2xl md:text-4xl font-bold mt-2">
                    Everything you need.{" "}
                    <span className="text-muted-foreground">Nothing you don't.</span>
                </h2>
            </div>

            {/* Product Grid */}
            <div className="flex-1 grid grid-cols-2 gap-4">
                {productFeatures.map((feature, index) => (
                    <div
                        key={index}
                        className="p-4 rounded-xl border border-border/50 bg-card hover:border-emerald-500/30 transition-colors"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                <feature.icon className="h-4 w-4 text-emerald-500" />
                            </div>
                            <h3 className="font-semibold text-sm">{feature.title}</h3>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">
                            {feature.description}
                        </p>
                        {feature.preview}
                    </div>
                ))}
            </div>

            {/* Supported Providers */}
            <div className="mt-6 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">
                    14+ AI Providers Supported
                </p>
                <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                    {[
                        "OpenAI",
                        "Anthropic",
                        "Google",
                        "Mistral",
                        "Cohere",
                        "DeepSeek",
                        "+ more",
                    ].map((provider) => (
                        <span
                            key={provider}
                            className="px-2 py-1 rounded-full border border-border/50"
                        >
                            {provider}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}
