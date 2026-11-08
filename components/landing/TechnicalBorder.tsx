import React from "react";
import { cn } from "@/lib/utils";

interface TechnicalBorderProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    cornerSize?: number;
    borderWidth?: number;
    active?: boolean;
    hoverEffect?: boolean;
}

export const TechnicalBorder = ({
    children,
    className,
    cornerSize = 12,
    borderWidth = 1,
    active = false,
    hoverEffect = true,
    ...props
}: TechnicalBorderProps) => {
    return (
        <div
            className={cn(
                "relative group bg-background p-1",
                className
            )}
            {...props}
        >
            {/* Main Border Container */}
            <div className={cn(
                "relative h-full w-full border border-border/40 transition-colors duration-300",
                active && "border-foreground",
                hoverEffect && "group-hover:border-foreground/60"
            )}>

                {/* Top Left Corner */}
                <div
                    className={cn(
                        "absolute -top-[1px] -left-[1px] border-t border-l border-foreground transition-all duration-300",
                        active ? "border-foreground" : "border-foreground/40",
                        hoverEffect && "group-hover:border-foreground group-hover:w-6 group-hover:h-6"
                    )}
                    style={{ width: cornerSize, height: cornerSize }}
                />

                {/* Top Right Corner */}
                <div
                    className={cn(
                        "absolute -top-[1px] -right-[1px] border-t border-r border-foreground transition-all duration-300",
                        active ? "border-foreground" : "border-foreground/40",
                        hoverEffect && "group-hover:border-foreground group-hover:w-6 group-hover:h-6"
                    )}
                    style={{ width: cornerSize, height: cornerSize }}
                />

                {/* Bottom Right Corner */}
                <div
                    className={cn(
                        "absolute -bottom-[1px] -right-[1px] border-b border-r border-foreground transition-all duration-300",
                        active ? "border-foreground" : "border-foreground/40",
                        hoverEffect && "group-hover:border-foreground group-hover:w-6 group-hover:h-6"
                    )}
                    style={{ width: cornerSize, height: cornerSize }}
                />

                {/* Bottom Left Corner */}
                <div
                    className={cn(
                        "absolute -bottom-[1px] -left-[1px] border-b border-l border-foreground transition-all duration-300",
                        active ? "border-foreground" : "border-foreground/40",
                        hoverEffect && "group-hover:border-foreground group-hover:w-6 group-hover:h-6"
                    )}
                    style={{ width: cornerSize, height: cornerSize }}
                />

                {/* Content */}
                <div className="relative z-10 h-full w-full">
                    {children}
                </div>
            </div>
        </div>
    );
};
