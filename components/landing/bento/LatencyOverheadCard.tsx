"use client";

import React, { useState, useEffect, useRef } from "react";
import { BentoCard } from "./BentoCard";
import { cn } from "@/lib/utils";

export const LatencyOverheadCard = () => {
    const [isHovered, setIsHovered] = useState(false);
    const [latencyValue, setLatencyValue] = useState(47);
    const [pulseIntensity, setPulseIntensity] = useState(0);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (isHovered) {
            // Rapidly change latency values
            intervalRef.current = setInterval(() => {
                setLatencyValue(Math.floor(Math.random() * 15) + 35); // 35-50ms range
                setPulseIntensity((prev) => (prev + 1) % 3);
            }, 150);
        } else {
            setLatencyValue(47);
            setPulseIntensity(0);
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isHovered]);

    // Generate wave points for visualization
    const generateWavePoints = () => {
        const points = [];
        const segments = 20;
        for (let i = 0; i <= segments; i++) {
            const x = (i / segments) * 100;
            const y = 50 + Math.sin((i / segments) * Math.PI * 4 + (isHovered ? Date.now() / 200 : 0)) * 20;
            points.push(`${x},${y}`);
        }
        return points.join(' ');
    };

    return (
        <div
            className="h-full"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <BentoCard
                title="Latency Overhead"
                description="Near-zero latency added to your requests."
                accentColor="green"
            >
                <div className="flex items-center gap-6">
                    {/* Large latency display */}
                    <div className="relative flex items-baseline gap-1">
                        <span
                            className={cn(
                                "text-5xl font-bold tabular-nums transition-all duration-150",
                                isHovered ? "text-emerald-400" : "text-foreground"
                            )}
                        >
                            &lt;{latencyValue}
                        </span>
                        <span className="text-2xl text-muted-foreground">ms</span>

                        {/* Pulse rings */}
                        {isHovered && (
                            <>
                                <div
                                    className={cn(
                                        "absolute inset-0 -m-4 rounded-2xl border border-emerald-500/30 animate-ping",
                                        pulseIntensity === 0 && "opacity-100",
                                        pulseIntensity !== 0 && "opacity-0"
                                    )}
                                />
                                <div
                                    className={cn(
                                        "absolute inset-0 -m-6 rounded-2xl border border-emerald-500/20 animate-ping",
                                        pulseIntensity === 1 && "opacity-100",
                                        pulseIntensity !== 1 && "opacity-0"
                                    )}
                                    style={{ animationDelay: "0.2s" }}
                                />
                            </>
                        )}
                    </div>

                    {/* Latency wave visualization */}
                    <div className="flex-1 h-16 relative overflow-hidden rounded-lg bg-muted/30 border border-border/50">
                        <svg
                            className="absolute inset-0 w-full h-full"
                            preserveAspectRatio="none"
                            viewBox="0 0 100 100"
                        >
                            <defs>
                                <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="rgba(16, 185, 129, 0.1)" />
                                    <stop offset="50%" stopColor="rgba(16, 185, 129, 0.4)" />
                                    <stop offset="100%" stopColor="rgba(16, 185, 129, 0.1)" />
                                </linearGradient>
                            </defs>

                            {/* Wave line */}
                            <polyline
                                points={generateWavePoints()}
                                fill="none"
                                stroke={isHovered ? "rgba(16, 185, 129, 0.8)" : "rgba(255, 255, 255, 0.2)"}
                                strokeWidth="2"
                                className="transition-all duration-300"
                            />

                            {/* Horizontal baseline */}
                            <line
                                x1="0"
                                y1="50"
                                x2="100"
                                y2="50"
                                stroke="rgba(255, 255, 255, 0.1)"
                                strokeWidth="1"
                                strokeDasharray="2,2"
                            />
                        </svg>

                        {/* Scanning line */}
                        {isHovered && (
                            <div
                                className="absolute top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-emerald-400 to-transparent"
                                style={{
                                    animation: "scan 2s linear infinite",
                                }}
                            />
                        )}
                    </div>
                </div>

                {/* Bottom stats */}
                <div className="flex gap-6 mt-4 pt-4 border-t border-border/50">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-xs text-muted-foreground">p50:</span>
                        <span className="text-xs text-foreground/80 tabular-nums">32ms</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500/60" />
                        <span className="text-xs text-muted-foreground">p95:</span>
                        <span className="text-xs text-foreground/80 tabular-nums">48ms</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500/30" />
                        <span className="text-xs text-muted-foreground">p99:</span>
                        <span className="text-xs text-foreground/80 tabular-nums">67ms</span>
                    </div>
                </div>

                <style jsx>{`
          @keyframes scan {
            0% {
              left: 0%;
            }
            100% {
              left: 100%;
            }
          }
        `}</style>
            </BentoCard>
        </div>
    );
};
