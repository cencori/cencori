"use client";

import React, { useState, useEffect } from "react";
import { BentoCard } from "./BentoCard";
import { cn } from "@/lib/utils";

const providers = [
    { name: "OpenAI", color: "bg-emerald-500", textColor: "text-emerald-400" },
    { name: "Anthropic", color: "bg-orange-500", textColor: "text-orange-400" },
    { name: "Google", color: "bg-blue-500", textColor: "text-blue-400" },
];

export const ModelRouterCard = () => {
    const [isHovered, setIsHovered] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        if (isHovered) {
            const interval = setInterval(() => {
                setActiveIndex((prev) => (prev + 1) % providers.length);
            }, 600);
            return () => clearInterval(interval);
        } else {
            setActiveIndex(0);
        }
    }, [isHovered]);

    return (
        <div
            className="h-full"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <BentoCard
                title="Model Router"
                description="Intelligent routing with automatic failover."
                accentColor="green"
                gridClassName="md:col-span-1 md:row-span-2"
            >
                <div className="relative h-full flex flex-col items-center justify-between py-4">
                    {/* Request node */}
                    <div className="relative z-10">
                        <div
                            className={cn(
                                "w-20 h-8 rounded-md bg-white/[0.08] border border-white/[0.12] flex items-center justify-center transition-all duration-300",
                                isHovered && "border-emerald-500/40 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)]"
                            )}
                        >
                            <span className="text-xs text-white/80">Request</span>
                        </div>
                        {/* Pulse animation */}
                        {isHovered && (
                            <div className="absolute inset-0 rounded-md border border-emerald-500/40 animate-ping" />
                        )}
                    </div>

                    {/* Connection lines */}
                    <div className="relative flex-1 w-full flex flex-col items-center justify-center">
                        {/* Main vertical line */}
                        <div className="w-px h-full bg-gradient-to-b from-white/20 to-transparent" />

                        {/* Animated dot moving down */}
                        {isHovered && (
                            <div
                                className="absolute top-0 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(16,185,129,0.6)]"
                                style={{
                                    animation: "flowDown 1s ease-in-out infinite",
                                }}
                            />
                        )}
                    </div>

                    {/* Router node */}
                    <div className="relative z-10 my-4">
                        <div
                            className={cn(
                                "w-24 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center transition-all duration-300",
                                isHovered && "bg-emerald-500/20 border-emerald-500/50"
                            )}
                        >
                            <span className="text-xs font-medium text-emerald-400">Router</span>
                        </div>
                    </div>

                    {/* Branching lines to providers */}
                    <div className="relative w-full flex-1">
                        {/* Lines container */}
                        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                            <defs>
                                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
                                    <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
                                </linearGradient>
                            </defs>
                            {/* Left line */}
                            <line x1="50%" y1="0" x2="15%" y2="100%" stroke="url(#lineGradient)" strokeWidth="1" />
                            {/* Center line */}
                            <line x1="50%" y1="0" x2="50%" y2="100%" stroke="url(#lineGradient)" strokeWidth="1" />
                            {/* Right line */}
                            <line x1="50%" y1="0" x2="85%" y2="100%" stroke="url(#lineGradient)" strokeWidth="1" />
                        </svg>
                    </div>

                    {/* Provider nodes */}
                    <div className="relative z-10 flex w-full justify-between px-1 gap-1">
                        {providers.map((provider, i) => (
                            <div
                                key={provider.name}
                                className={cn(
                                    "flex flex-col items-center gap-1 transition-all duration-300",
                                    isHovered && activeIndex === i && "scale-110"
                                )}
                            >
                                <div
                                    className={cn(
                                        "w-2 h-2 rounded-full transition-all duration-300",
                                        provider.color,
                                        isHovered && activeIndex === i && "shadow-[0_0_12px_2px_currentColor] scale-125"
                                    )}
                                />
                                <span
                                    className={cn(
                                        "text-[10px] transition-all duration-300",
                                        isHovered && activeIndex === i ? provider.textColor : "text-white/40"
                                    )}
                                >
                                    {provider.name}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Fallback indicator */}
                    {isHovered && (
                        <div className="absolute bottom-0 left-0 right-0 flex justify-center">
                            <span className="text-[10px] text-orange-400 animate-pulse">
                                ↻ Auto-failover active
                            </span>
                        </div>
                    )}
                </div>

                <style jsx>{`
          @keyframes flowDown {
            0% {
              top: 0;
              opacity: 1;
            }
            100% {
              top: 100%;
              opacity: 0;
            }
          }
        `}</style>
            </BentoCard>
        </div>
    );
};
