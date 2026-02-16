"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Zap, Layout, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface UsageProps {
    monthlyRequestsUsed: number;
    monthlyRequestLimit: number;
    projectCount: number;
    projectLimit: number;
    tier: string;
}

export function UsageOverview({
    monthlyRequestsUsed,
    monthlyRequestLimit,
    projectCount,
    projectLimit,
    tier
}: UsageProps) {
    const requestPercentage = Math.min((monthlyRequestsUsed / monthlyRequestLimit) * 100, 100);
    const projectPercentage = Math.min((projectCount / projectLimit) * 100, 100);

    const isNearLimit = requestPercentage >= 80;
    const isAtLimit = requestPercentage >= 100;

    return (
        <div className="grid gap-3 md:grid-cols-2">
            {/* Request Usage Card */}
            <div className="rounded-md border border-border/40 bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
                    <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                        Monthly Requests
                    </h3>
                    <Badge variant="outline" className={cn(
                        "text-[9px] h-4 px-1.5 border-border/50 font-mono",
                        isAtLimit ? "text-red-500 border-red-500/30" : isNearLimit ? "text-amber-500 border-amber-500/30" : "text-muted-foreground"
                    )}>
                        {requestPercentage.toFixed(0)}%
                    </Badge>
                </div>
                <div className="p-4">
                    <div className="flex items-baseline gap-1">
                        <span className="text-base font-medium tabular-nums">
                            {monthlyRequestsUsed.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                            / {monthlyRequestLimit.toLocaleString()}
                        </span>
                    </div>

                    <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-secondary/30">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${requestPercentage}%` }}
                            transition={{ duration: 0.8, ease: "circOut" }}
                            className={cn(
                                "h-full transition-colors",
                                isAtLimit ? "bg-red-500/60" : isNearLimit ? "bg-amber-500/60" : "bg-foreground/40"
                            )}
                        />
                    </div>
                </div>
            </div>

            {/* Project Capacity Card */}
            <div className="rounded-md border border-border/40 bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
                    <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                        Project Capacity
                    </h3>
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-border/50 text-muted-foreground font-mono">
                        {projectCount} / {projectLimit === 999999 ? '∞' : projectLimit}
                    </Badge>
                </div>
                <div className="p-4">
                    <div className="flex items-baseline gap-1">
                        <span className="text-base font-medium tabular-nums">
                            {projectCount}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                            / {projectLimit === 999999 ? 'Unlimited' : projectLimit}
                        </span>
                    </div>

                    <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-secondary/30">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${projectPercentage}%` }}
                            transition={{ duration: 0.8, delay: 0.1, ease: "circOut" }}
                            className="h-full bg-foreground/40"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
