"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface BentoCardProps {
    title: string;
    description: string;
    className?: string;
    children?: React.ReactNode;
    accentColor?: "green" | "orange";
}

export const BentoCard = ({
    title,
    description,
    className,
    children,
    accentColor = "green",
}: BentoCardProps) => {
    const accentStyles = {
        green: {
            glow: "group-hover:bg-emerald-500/5",
            titleHover: "group-hover:text-emerald-400",
        },
        orange: {
            glow: "group-hover:bg-orange-500/5",
            titleHover: "group-hover:text-orange-400",
        },
    };

    const styles = accentStyles[accentColor];

    return (
        <div
            className={cn(
                "group relative flex flex-col h-full transition-colors duration-300",
                styles.glow,
                className
            )}
        >
            {/* Content header */}
            <div className="relative z-10 flex flex-col gap-2">
                <h3 className={cn(
                    "text-lg font-semibold tracking-tight text-foreground transition-colors duration-300",
                    styles.titleHover
                )}>
                    {title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    {description}
                </p>
            </div>

            {/* Visual content area */}
            <div className="relative z-10 flex-1 mt-4">{children}</div>
        </div>
    );
};
