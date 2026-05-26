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
        <div className="mx-auto w-full max-w-[1440px] flex flex-col md:flex-row gap-6 md:gap-8 lg:gap-10 px-4 md:px-8 lg:px-12">
            <div className="hidden md:block w-[280px] xl:w-[300px] shrink-0">
                <DocsSidebar />
            </div>
            <main className={cn("flex-1 min-w-0 py-10 lg:py-14", className)}>
                <div className="mx-auto w-full max-w-3xl min-w-0">
                    {children}
                </div>
            </main>
            {!isAskAIOpen && (
                <div className="hidden lg:block w-[260px] xl:w-[280px] shrink-0">
                    <DocsTOC />
                </div>
            )}
        </div>
    );
}
