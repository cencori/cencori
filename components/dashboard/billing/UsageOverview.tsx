"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
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
                    <div className="flex items-baseline gap-1.5 mb-2">
                        <span className="text-2xl font-semibold tabular-nums tracking-tight">
                            {monthlyRequestsUsed.toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium">
                            of {monthlyRequestLimit.toLocaleString()}
                        </span>
                    </div>

                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/30">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${requestPercentage}%` }}
                            transition={{ duration: 0.8, ease: "circOut" }}
                            className={cn(
                                "h-full transition-colors rounded-full",
                                isAtLimit ? "bg-red-500/80" : isNearLimit ? "bg-amber-500/80" : "bg-primary"
                            )}
                        />
                    </div>
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
                    <div className="flex items-baseline gap-1.5 mb-2">
                        <span className="text-2xl font-semibold tabular-nums tracking-tight">
                            {projectCount}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium">
                            active projects
                        </span>
                    </div>

                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/30">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${projectPercentage}%` }}
                            transition={{ duration: 0.8, delay: 0.1, ease: "circOut" }}
                            className="h-full bg-primary rounded-full"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
