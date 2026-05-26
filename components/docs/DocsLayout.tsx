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
        <div className="flex flex-col lg:flex-row">
            <div className="hidden md:block w-[220px] xl:w-[240px] shrink-0 border-r border-border/30">
                <DocsSidebar />
            </div>
            <main className={cn("flex-1 min-w-0 px-6 sm:px-12 py-10 lg:py-14", className)}>
                <div className="mx-auto w-full min-w-0">
                    {children}
                </div>
            </main>
            {!isAskAIOpen && (
                <div className="hidden lg:block w-[220px] xl:w-[240px] shrink-0 border-l border-border/30">
                    <DocsTOC />
                </div>
            )}
        </div>
    );
}
