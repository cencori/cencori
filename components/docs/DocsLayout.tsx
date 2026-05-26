"use client";

import { ReactNode } from "react";
import { DocsSidebar } from "./DocsSidebar";
import { DocsTOC } from "./DocsTOC";
import { cn } from "@/lib/utils";
import { useDocsContext } from "./DocsContext";
import { motion } from "framer-motion";

interface DocsLayoutProps {
    children: ReactNode;
    className?: string;
}

export function DocsLayout({ children, className }: DocsLayoutProps) {
    const { isAskAIOpen } = useDocsContext();

    return (
        <motion.div
            layout
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={cn(
                "flex-1 items-start md:grid",
                !isAskAIOpen && "md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)_220px] xl:grid-cols-[240px_minmax(0,1fr)_240px]",
                isAskAIOpen && "md:grid-cols-[220px_minmax(0,1fr)]"
            )}>
            <div className="hidden md:block border-r border-border/30 h-full">
                <DocsSidebar />
            </div>
            <main className={cn("relative px-6 sm:px-12 py-10 lg:py-14", className)}>
                <div className="mx-auto w-full min-w-0">
                    {children}
                </div>
            </main>
            {!isAskAIOpen && (
                <div className="hidden lg:block border-l border-border/30">
                    <DocsTOC />
                </div>
            )}
        </motion.div>
    );
}
