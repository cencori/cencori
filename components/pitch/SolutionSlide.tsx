import React from "react";
import {
    CheckIcon,
    BoltIcon,
    ShieldCheckIcon,
    ChartBarIcon,
    ArrowPathIcon,
} from "@heroicons/react/24/outline";

const features = [
    {
        icon: BoltIcon,
        title: "One SDK",
        description:
            "Access OpenAI, Anthropic, Google Gemini, and 14+ providers with a single integration.",
    },
    {
        icon: ShieldCheckIcon,
        title: "Built-in Security",
        description:
            "Automatic PII detection, prompt injection protection, and content filtering.",
    },
    {
        icon: ChartBarIcon,
        title: "Complete Observability",
        description:
            "Audit logs, analytics, cost tracking, and usage patterns in real-time.",
    },
    {
        icon: ArrowPathIcon,
        title: "Provider Failover",
        description:
            "Automatic fallback to secondary providers when primary fails. Zero downtime.",
    },
];

const codeExample = `import { Cencori } from "cencori";

const cencori = new Cencori({
  apiKey: process.env.CENCORI_API_KEY,
});

// Works with OpenAI, Anthropic, Gemini...
const response = await cencori.ai.chat({
  model: "gpt-4o", // or "claude-3-opus"
  messages: [{ role: "user", content: "Hello!" }],
});`;

export function SolutionSlide() {
    return (
        <div className="h-full flex flex-col p-8 md:p-12">
            {/* Header */}
            <div className="mb-6">
                <span className="text-xs font-medium text-emerald-500 uppercase tracking-wider">
                    The Solution
                </span>
                <h2 className="text-2xl md:text-4xl font-bold mt-2">
                    One integration.{" "}
                    <span className="text-emerald-500">Complete AI infrastructure.</span>
                </h2>
            </div>

            {/* Main content grid */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Features */}
                <div className="space-y-3">
                    {features.map((feature, index) => (
                        <div
                            key={index}
                            className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors"
                        >
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                                <feature.icon className="h-4 w-4 text-emerald-500" />
                            </div>
                            <div>
                                <h3 className="font-medium text-sm">{feature.title}</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {feature.description}
                                </p>
                            </div>
                        </div>
                    ))}

                    {/* Benefit highlight */}
                    <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <div className="flex items-center gap-2 text-sm">
                            <CheckIcon className="h-4 w-4 text-emerald-500" />
                            <span>
                                <strong>10 minutes</strong> to integrate vs weeks of custom work
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right: Code example */}
                <div className="rounded-xl border border-border/50 bg-[#0a0a0a] overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 bg-muted/20">
                        <div className="flex gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                        </div>
                        <span className="text-[10px] text-muted-foreground ml-2">
                            lib/cencori.ts
                        </span>
                    </div>
                    <pre className="p-4 text-[11px] md:text-xs overflow-x-auto">
                        <code className="text-muted-foreground">
                            {codeExample.split("\n").map((line, i) => (
                                <div key={i} className="leading-relaxed">
                                    {line.includes("//") ? (
                                        <span className="text-emerald-500/70">{line}</span>
                                    ) : line.includes("import") ||
                                        line.includes("const") ||
                                        line.includes("await") ? (
                                        <>
                                            <span className="text-purple-400">
                                                {line.split(" ")[0]}
                                            </span>
                                            <span className="text-foreground/80">
                                                {" " + line.slice(line.indexOf(" ") + 1)}
                                            </span>
                                        </>
                                    ) : (
                                        <span className="text-foreground/80">{line}</span>
                                    )}
                                </div>
                            ))}
                        </code>
                    </pre>
                </div>
            </div>
        </div>
    );
}
