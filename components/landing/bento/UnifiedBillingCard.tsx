"use client";

import React, { useState } from "react";
import { BentoCard } from "./BentoCard";
import { cn } from "@/lib/utils";
import { CreditCard, TrendingDown, Zap, DollarSign } from "lucide-react";

interface CreditItemProps {
    provider: string;
    cost: string;
    savings: string;
    color: string;
    isHovered: boolean;
}

const CreditItem = ({ provider, cost, savings, color, isHovered }: CreditItemProps) => {
    return (
        <div className={cn(
            "flex items-center justify-between p-2 rounded-lg bg-white/[0.03] border border-white/[0.05] transition-all duration-300",
            isHovered && "bg-white/[0.05] scale-[1.02]"
        )}>
            <div className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", color)} />
                <span className="text-xs text-foreground">{provider}</span>
            </div>
            <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{cost}</span>
                <span className="text-xs text-emerald-400">{savings}</span>
            </div>
        </div>
    );
};

export const UnifiedBillingCard = () => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className="h-full"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <BentoCard
                title="Unified Billing"
                description="One bill. All providers. Full control."
                accentColor="green"
            >
                <div className="space-y-4">
                    {/* Credit balance widget */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20">
                        <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-emerald-500" />
                            <span className="text-xs text-muted-foreground">Balance</span>
                        </div>
                        <span className={cn(
                            "text-lg font-bold text-foreground tabular-nums transition-all duration-300",
                            isHovered && "text-emerald-400"
                        )}>
                            $247.50
                        </span>
                    </div>

                    {/* Provider costs */}
                    <div className="space-y-2">
                        <CreditItem
                            provider="OpenAI"
                            cost="$45.20"
                            savings="-15%"
                            color="bg-emerald-500"
                            isHovered={isHovered}
                        />
                        <CreditItem
                            provider="Anthropic"
                            cost="$28.40"
                            savings="-12%"
                            color="bg-orange-500"
                            isHovered={isHovered}
                        />
                        <CreditItem
                            provider="Google AI"
                            cost="$8.90"
                            savings="-20%"
                            color="bg-blue-500"
                            isHovered={isHovered}
                        />
                    </div>

                    {/* Feature highlights */}
                    <div className="grid grid-cols-3 gap-2 pt-2">
                        <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white/[0.02]">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground text-center">Pay-as-go</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white/[0.02]">
                            <TrendingDown className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground text-center">Save 20%</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white/[0.02]">
                            <Zap className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground text-center">Auto top-up</span>
                        </div>
                    </div>
                </div>
            </BentoCard>
        </div>
    );
};
