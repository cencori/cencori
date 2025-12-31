"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface BentoGridProps {
    children: React.ReactNode;
    className?: string;
}

/**
 * BentoGrid - Vercel-style grid with continuous border lines and + corner markers
 */
export const BentoGrid = ({ children, className }: BentoGridProps) => {
    return (
        <div className={cn("relative", className)}>
            {/* Grid container with borders */}
            <div className="relative border border-border/40 bg-background">
                {/* Corner markers - 4 corners only */}
                <div className="absolute -top-[7px] -left-[7px] w-[14px] h-[14px] flex items-center justify-center text-muted-foreground/50 text-xs z-10">+</div>
                <div className="absolute -top-[7px] -right-[7px] w-[14px] h-[14px] flex items-center justify-center text-muted-foreground/50 text-xs z-10">+</div>
                <div className="absolute -bottom-[7px] -left-[7px] w-[14px] h-[14px] flex items-center justify-center text-muted-foreground/50 text-xs z-10">+</div>
                <div className="absolute -bottom-[7px] -right-[7px] w-[14px] h-[14px] flex items-center justify-center text-muted-foreground/50 text-xs z-10">+</div>

                {/* Grid content */}
                <div className="grid grid-cols-1 md:grid-cols-4">
                    {children}
                </div>
            </div>
        </div>
    );
};

interface BentoGridCellProps {
    children: React.ReactNode;
    className?: string;
    colSpan?: 1 | 2 | 3 | 4;
    rowSpan?: 1 | 2;
}

/**
 * BentoGridCell - Individual cell with border styling
 */
export const BentoGridCell = ({
    children,
    className,
    colSpan = 1,
    rowSpan = 1,
}: BentoGridCellProps) => {
    const colSpanClasses = {
        1: "md:col-span-1",
        2: "md:col-span-2",
        3: "md:col-span-3",
        4: "md:col-span-4",
    };

    const rowSpanClasses = {
        1: "md:row-span-1",
        2: "md:row-span-2",
    };

    return (
        <div
            className={cn(
                "relative border-b border-r border-border/40",
                "last:border-b-0 md:last:border-b",
                "[&:nth-last-child(-n+4)]:md:border-b-0",
                colSpanClasses[colSpan],
                rowSpanClasses[rowSpan],
                className
            )}
        >
            <div className="h-full p-6">
                {children}
            </div>
        </div>
    );
};
