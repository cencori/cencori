"use client";

import { ReactNode } from "react";
import { DocsSidebar } from "./DocsSidebar";
import { DocsTOC } from "./DocsTOC";
import { cn } from "@/lib/utils";
import { useDocsContext } from "./DocsContext";

interface DocsLayoutProps {
    children: ReactNode;
    className?: string;
}

export function DocsLayout({ children, className }: DocsLayoutProps) {
    const { isAskAIOpen } = useDocsContext();

    return (
        <div className={cn(
            "flex-1 grid md:grid-cols-[220px_minmax(0,1fr)]",
            !isAskAIOpen && "lg:grid-cols-[220px_minmax(0,1fr)_220px] xl:grid-cols-[240px_minmax(0,1fr)_240px]",
            isAskAIOpen && "lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)]",
        )}>
            <div className="hidden md:block border-r border-border/30">
                <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
                    <DocsSidebar />
                </div>
            </div>
            <main className={cn("min-w-0 px-6 sm:px-12 py-10 lg:py-14", className)}>
                <div className="mx-auto w-full min-w-0">
                    {children}
                </div>
            </main>
            {!isAskAIOpen && (
                <div className="hidden lg:block border-l border-border/30">
                    <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
                        <DocsTOC />
                    </div>
                </div>
            )}
        </div>
    );
}
