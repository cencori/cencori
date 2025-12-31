"use client";

import React, { useState, useEffect, useRef } from "react";
import { BentoCard } from "./BentoCard";
import { cn } from "@/lib/utils";

interface AnimatedCounterProps {
    value: number;
    suffix?: string;
    prefix?: string;
    isHovered: boolean;
}

const AnimatedCounter = ({ value, suffix = "", prefix = "", isHovered }: AnimatedCounterProps) => {
    const [displayValue, setDisplayValue] = useState(value);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (isHovered) {
            // Fast random counting animation
            intervalRef.current = setInterval(() => {
                setDisplayValue(Math.floor(Math.random() * value * 1.5) + Math.floor(value * 0.5));
            }, 50);

            // Stop after 1 second and settle on final value
            setTimeout(() => {
                if (intervalRef.current) clearInterval(intervalRef.current);
                setDisplayValue(value);
            }, 800);
        } else {
            setDisplayValue(value);
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isHovered, value]);

    return (
        <span className="tabular-nums font-mono">
            {prefix}{displayValue.toLocaleString()}{suffix}
        </span>
    );
};

interface MetricBarProps {
    label: string;
    value: number;
    maxValue: number;
    color: string;
    isHovered: boolean;
}

const MetricBar = ({ label, value, maxValue, color, isHovered }: MetricBarProps) => {
    const percentage = (value / maxValue) * 100;

    return (
        <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-16 shrink-0">{label}</span>
            <div className="flex-1 h-2 bg-white/[0.05] rounded-full overflow-hidden">
                <div
                    className={cn(
                        "h-full rounded-full transition-all duration-500",
                        color,
                        isHovered && "animate-pulse"
                    )}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <span className="text-xs text-muted-foreground w-12 text-right tabular-nums">{value}%</span>
        </div>
    );
};

export const RealTimeMetricsCard = () => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className="h-full"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <BentoCard
                title="Real-time Metrics"
                description="Latency, cost, and usage—updated live."
                accentColor="orange"
            >
                <div className="grid grid-cols-3 gap-4">
                    {/* Metric counters */}
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Requests</span>
                        <span className="text-2xl font-bold text-foreground">
                            <AnimatedCounter value={12847} isHovered={isHovered} />
                        </span>
                        <span className="text-xs text-emerald-400">+12.4%</span>
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Avg Latency</span>
                        <span className="text-2xl font-bold text-foreground">
                            <AnimatedCounter value={42} suffix="ms" isHovered={isHovered} />
                        </span>
                        <span className="text-xs text-emerald-400">-8.2%</span>
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Cost Today</span>
                        <span className="text-2xl font-bold text-foreground">
                            <AnimatedCounter value={847} prefix="$" isHovered={isHovered} />
                        </span>
                        <span className="text-xs text-orange-400">+3.1%</span>
                    </div>
                </div>

                {/* Provider bars */}
                <div className="mt-4 space-y-2">
                    <MetricBar label="OpenAI" value={64} maxValue={100} color="bg-emerald-500" isHovered={isHovered} />
                    <MetricBar label="Anthropic" value={28} maxValue={100} color="bg-orange-500" isHovered={isHovered} />
                    <MetricBar label="Google" value={8} maxValue={100} color="bg-blue-500" isHovered={isHovered} />
                </div>
            </BentoCard>
        </div>
    );
};
