import React from "react";
import { CheckIcon, XMarkIcon, MinusIcon } from "@heroicons/react/24/outline";

type Status = "yes" | "no" | "partial";

interface CompetitorRow {
    feature: string;
    cencori: Status;
    openrouter: Status;
    portkey: Status;
    litellm: Status;
}

const data: CompetitorRow[] = [
    { feature: "Unified AI Gateway", cencori: "yes", openrouter: "yes", portkey: "yes", litellm: "yes" },
    { feature: "End-User Billing", cencori: "yes", openrouter: "no", portkey: "no", litellm: "no" },
    { feature: "PII Detection & Redaction", cencori: "yes", openrouter: "no", portkey: "partial", litellm: "no" },
    { feature: "Prompt Injection Protection", cencori: "yes", openrouter: "no", portkey: "partial", litellm: "no" },
    { feature: "BYOK (Bring Your Own Keys)", cencori: "yes", openrouter: "no", portkey: "yes", litellm: "yes" },
    { feature: "Provider Failover", cencori: "yes", openrouter: "partial", portkey: "yes", litellm: "yes" },
    { feature: "Semantic Caching", cencori: "yes", openrouter: "no", portkey: "yes", litellm: "partial" },
    { feature: "Full Dashboard + SDKs", cencori: "yes", openrouter: "partial", portkey: "yes", litellm: "no" },
];

function StatusIcon({ status }: { status: Status }) {
    if (status === "yes") return <CheckIcon className="h-3.5 w-3.5 text-emerald-500" />;
    if (status === "no") return <XMarkIcon className="h-3.5 w-3.5 text-red-400/70" />;
    return <MinusIcon className="h-3.5 w-3.5 text-yellow-500/70" />;
}

export function CompetitiveSlide() {
    return (
        <div className="h-full flex flex-col p-8 md:p-12">
            {/* Header */}
            <div className="mb-6">
                <span className="text-xs font-medium text-emerald-500 uppercase tracking-wider">
                    Competitive Landscape
                </span>
                <h2 className="text-2xl md:text-4xl font-bold mt-2">
                    More than a gateway.{" "}
                    <span className="text-muted-foreground">A complete platform.</span>
                </h2>
                <p className="text-sm text-muted-foreground mt-2">
                    Others route requests. Cencori secures, meters, and monetizes them.
                </p>
            </div>

            {/* Comparison Table */}
            <div className="flex-1 rounded-xl border border-border/50 overflow-hidden">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-b border-border/50 bg-muted/20">
                            <th className="text-left p-3 font-medium text-muted-foreground w-[200px]">Feature</th>
                            <th className="p-3 font-semibold text-emerald-500 text-center">Cencori</th>
                            <th className="p-3 font-medium text-muted-foreground text-center">OpenRouter</th>
                            <th className="p-3 font-medium text-muted-foreground text-center">Portkey</th>
                            <th className="p-3 font-medium text-muted-foreground text-center">LiteLLM</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, i) => (
                            <tr key={i} className="border-b border-border/30 last:border-0">
                                <td className="p-3 font-medium">{row.feature}</td>
                                <td className="p-3">
                                    <div className="flex justify-center"><StatusIcon status={row.cencori} /></div>
                                </td>
                                <td className="p-3">
                                    <div className="flex justify-center"><StatusIcon status={row.openrouter} /></div>
                                </td>
                                <td className="p-3">
                                    <div className="flex justify-center"><StatusIcon status={row.portkey} /></div>
                                </td>
                                <td className="p-3">
                                    <div className="flex justify-center"><StatusIcon status={row.litellm} /></div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Bottom note */}
            <div className="mt-4 text-center">
                <p className="text-xs text-muted-foreground">
                    OpenRouter is a marketplace. Portkey raised $15M for observability. LiteLLM is open-source proxy.
                    <br />
                    Cencori is the only platform that combines gateway, security, and monetization in one.
                </p>
            </div>
        </div>
    );
}
