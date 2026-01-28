import React from "react";
import { ArrowTrendingUpIcon } from "@heroicons/react/24/outline";

const marketData = {
    tam: {
        value: "$150B",
        label: "Total Addressable Market",
        description: "Global AI infrastructure & services by 2030",
    },
    sam: {
        value: "$42B",
        label: "Serviceable Addressable Market",
        description: "AI gateway, observability, and security tools",
    },
    som: {
        value: "$2B",
        label: "Serviceable Obtainable Market",
        description: "Developers building AI-powered applications",
    },
};

const trends = [
    { stat: "65%", label: "of enterprises will deploy AI by 2025" },
    { stat: "4.5x", label: "growth in AI API calls year-over-year" },
    { stat: "$200B+", label: "spent on AI infrastructure annually" },
];

export function MarketSlide() {
    return (
        <div className="h-full flex flex-col p-6 md:p-10 overflow-hidden">
            {/* Header */}
            <div className="mb-4 shrink-0">
                <span className="text-xs font-medium text-blue-500 uppercase tracking-wider">
                    Market Opportunity
                </span>
                <h2 className="text-2xl md:text-3xl font-bold mt-1">
                    The AI infrastructure market is{" "}
                    <span className="text-blue-500">exploding.</span>
                </h2>
            </div>

            {/* TAM/SAM/SOM Visualization */}
            <div className="flex-1 min-h-0 flex items-center justify-center py-2">
                <div className="relative h-full aspect-square max-h-[400px]">
                    {/* TAM Circle */}
                    <div className="absolute inset-0 rounded-full border-2 border-blue-500/20 bg-blue-500/5 flex items-center justify-center">
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-center w-full px-4">
                            <span className="text-xl md:text-2xl font-bold text-blue-500">
                                {marketData.tam.value}
                            </span>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                {marketData.tam.label}
                            </p>
                        </div>

                        {/* SAM Circle */}
                        <div className="absolute w-[72%] h-[72%] rounded-full border-2 border-blue-400/30 bg-blue-400/10 flex items-center justify-center">
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-center w-full px-4">
                                <span className="text-lg md:text-xl font-bold text-blue-400">
                                    {marketData.sam.value}
                                </span>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {marketData.sam.label}
                                </p>
                            </div>

                            {/* SOM Circle */}
                            <div className="absolute w-[50%] h-[50%] rounded-full border-2 border-emerald-500/50 bg-emerald-500/20 flex items-center justify-center">
                                <div className="text-center">
                                    <span className="text-base md:text-lg font-bold text-emerald-500">
                                        {marketData.som.value}
                                    </span>
                                    <p className="text-[9px] md:text-[10px] text-muted-foreground mt-0.5">
                                        {marketData.som.label}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Market Trends */}
            <div className="mt-4 grid grid-cols-3 gap-3 shrink-0">
                {trends.map((trend, index) => (
                    <div
                        key={index}
                        className="p-3 rounded-xl border border-border/50 bg-card text-center"
                    >
                        <div className="flex items-center justify-center gap-1 mb-0.5">
                            <ArrowTrendingUpIcon className="h-3 w-3 text-emerald-500" />
                            <span className="text-base md:text-lg font-bold">{trend.stat}</span>
                        </div>
                        <p className="text-[9px] md:text-[10px] text-muted-foreground leading-tight">{trend.label}</p>
                    </div>
                ))}
            </div>

            {/* Source */}
            <div className="mt-3 text-center shrink-0">
                <p className="text-[9px] text-muted-foreground">
                    Sources: Gartner, McKinsey, IDC Market Research 2024
                </p>
            </div>
        </div>
    );
}
