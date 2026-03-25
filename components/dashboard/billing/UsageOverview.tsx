"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const TOTAL_BARS = 60;

function SegmentedBar({ percentage, color }: { percentage: number; color: string }) {
    const filledBars = Math.round((percentage / 100) * TOTAL_BARS);

    return (
        <div className="flex items-center gap-[2px] w-full h-6">
            {Array.from({ length: TOTAL_BARS }).map((_, i) => (
                <motion.div
                    key={i}
                    initial={{ opacity: 0, scaleY: 0 }}
                    animate={{
                        opacity: i < filledBars ? 1 : 0.15,
                        scaleY: 1,
                    }}
                    transition={{
                        duration: 0.3,
                        delay: i * 0.008,
                        ease: "easeOut",
                    }}
                    className={cn(
                        "flex-1 h-full rounded-[1px]",
                        i < filledBars ? color : "bg-muted-foreground/50"
                    )}
                />
            ))}
        </div>
    );
}

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

    const requestBarColor = isAtLimit ? "bg-red-500" : isNearLimit ? "bg-amber-500" : "bg-emerald-500";

    return (
        <div className="grid gap-6 md:grid-cols-2">
            {/* Request Usage Card */}
            <div className="rounded-md border border-border/40 bg-card overflow-hidden">
                <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-medium tracking-tight">Monthly Requests</h3>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            API usage for the current billing period.
                        </p>
                    </div>
                    <Badge variant="outline" className={cn(
                        "text-[10px] h-5 px-2 border-border/50 font-mono tracking-tight",
                        isAtLimit ? "text-red-500 border-red-500/30 bg-red-500/5" : isNearLimit ? "text-amber-500 border-amber-500/30 bg-amber-500/5" : "text-muted-foreground bg-secondary/50"
                    )}>
                        {requestPercentage.toFixed(0)}% Used
                    </Badge>
                </div>
                <div className="p-6">
                    <div className="flex items-baseline gap-1.5 mb-3">
                        <span className="text-2xl font-semibold tabular-nums tracking-tight">
                            {monthlyRequestsUsed.toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium">
                            of {monthlyRequestLimit.toLocaleString()}
                        </span>
                    </div>

                    <SegmentedBar percentage={requestPercentage} color={requestBarColor} />
                </div>
            </div>

            {/* Project Capacity Card */}
            <div className="rounded-md border border-border/40 bg-card overflow-hidden">
                <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-medium tracking-tight">Project Capacity</h3>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            Active projects in your organization.
                        </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] h-5 px-2 border-border/50 text-muted-foreground font-mono bg-secondary/50 tracking-tight">
                        {tier === 'free' ? 'Free Tier' : tier === 'pro' ? 'Pro Plan' : 'Team Plan'}
                    </Badge>
                </div>
                <div className="p-6">
                    <div className="flex items-baseline gap-1.5 mb-3">
                        <span className="text-2xl font-semibold tabular-nums tracking-tight">
                            {projectCount}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium">
                            active projects
                        </span>
                    </div>

                    <SegmentedBar percentage={projectPercentage} color="bg-emerald-500" />
                </div>
            </div>
        </div>
    );
}
