"use client";

import React, { useState, useEffect, useRef } from "react";
import { BentoCard } from "./BentoCard";
import { cn } from "@/lib/utils";

const stages = [
    { name: "Intercept", icon: "◉" },
    { name: "Transform", icon: "⟳" },
    { name: "Log", icon: "▤" },
];

export const RequestPipelineCard = () => {
    const [isHovered, setIsHovered] = useState(false);
    const [activeStage, setActiveStage] = useState(-1);
    const [packetPosition, setPacketPosition] = useState(0);
    const animationRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (isHovered) {
            let stage = 0;
            animationRef.current = setInterval(() => {
                setActiveStage(stage % stages.length);
                setPacketPosition((stage % stages.length) * 33.33);
                stage++;
            }, 400);
        } else {
            setActiveStage(-1);
            setPacketPosition(0);
            if (animationRef.current) {
                clearInterval(animationRef.current);
            }
        }

        return () => {
            if (animationRef.current) {
                clearInterval(animationRef.current);
            }
        };
    }, [isHovered]);

    return (
        <div
            className="h-full"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <BentoCard
                title="Request Pipeline"
                description="Intercept, transform, and log every request."
                accentColor="orange"
                gridClassName="md:col-span-1 md:row-span-1"
            >
                <div className="relative pt-4">
                    {/* Pipeline track */}
                    <div className="relative">
                        {/* Track line */}
                        <div className="absolute top-4 left-4 right-4 h-0.5 bg-muted rounded-full" />

                        {/* Animated progress line */}
                        <div
                            className={cn(
                                "absolute top-4 left-4 h-0.5 bg-gradient-to-r from-orange-500 to-orange-400 rounded-full transition-all duration-300",
                            )}
                            style={{
                                width: isHovered ? `${packetPosition + 10}%` : '0%',
                            }}
                        />

                        {/* Packet/dot traveling */}
                        {isHovered && (
                            <div
                                className="absolute top-3 w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_12px_3px_rgba(249,115,22,0.5)] z-10 transition-all duration-300"
                                style={{
                                    left: `calc(${packetPosition}% + 8px)`,
                                }}
                            />
                        )}

                        {/* Stage nodes */}
                        <div className="flex justify-between relative z-10">
                            {stages.map((stage, i) => (
                                <div
                                    key={stage.name}
                                    className="flex flex-col items-center gap-2"
                                >
                                    <div
                                        className={cn(
                                            "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 text-lg",
                                            "bg-muted/50 border border-border",
                                            activeStage >= i && "bg-orange-500/20 border-orange-500/40 shadow-[0_0_15px_-3px_rgba(249,115,22,0.4)]"
                                        )}
                                    >
                                        <span className={cn(
                                            "transition-colors duration-300",
                                            activeStage >= i ? "text-orange-400" : "text-muted-foreground"
                                        )}>
                                            {stage.icon}
                                        </span>
                                    </div>
                                    <span
                                        className={cn(
                                            "text-[10px] transition-colors duration-300",
                                            activeStage >= i ? "text-orange-400" : "text-muted-foreground"
                                        )}
                                    >
                                        {stage.name}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </BentoCard>
        </div>
    );
};
