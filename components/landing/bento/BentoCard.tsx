"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface BentoCardProps {
    title: string;
    description: string;
    className?: string;
    children?: React.ReactNode;
    accentColor?: "green" | "orange";
    gridClassName?: string;
}

export const BentoCard = ({
    title,
    description,
    className,
    children,
    accentColor = "green",
    gridClassName,
}: BentoCardProps) => {
    const accentStyles = {
        green: {
            glow: "group-hover:shadow-[0_0_40px_-10px_rgba(16,185,129,0.4)]",
            border: "group-hover:border-emerald-500/30",
            gradient: "from-emerald-500/10 via-transparent to-transparent",
        },
        orange: {
            glow: "group-hover:shadow-[0_0_40px_-10px_rgba(249,115,22,0.4)]",
            border: "group-hover:border-orange-500/30",
            gradient: "from-orange-500/10 via-transparent to-transparent",
        },
    };

    const styles = accentStyles[accentColor];

    return (
        <div
            className={cn(
                "group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-500 h-full",
                "hover:-translate-y-1",
                styles.glow,
                styles.border,
                gridClassName,
                className
            )}
        >
            {/* Hover gradient overlay */}
            <div
                className={cn(
                    "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                    "bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))]",
                    styles.gradient
                )}
            />

            {/* Content header */}
            <div className="relative z-10 flex flex-col gap-2">
                <h3 className="text-xl font-semibold tracking-tight text-foreground">
                    {title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[90%]">
                    {description}
                </p>
            </div>

            {/* Visual content area */}
            <div className="relative z-10 flex-1 mt-4">{children}</div>
        </div>
    );
};
