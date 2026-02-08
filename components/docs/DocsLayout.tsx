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
                "container mx-auto px-4 md:px-6 flex-1 items-start md:grid md:grid-cols-[240px_minmax(0,1fr)] gap-6 lg:gap-8",
                !isAskAIOpen && "lg:grid-cols-[240px_minmax(0,1fr)_240px] xl:grid-cols-[260px_minmax(0,1fr)_260px]",
                isAskAIOpen && "lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]"
            )}>
            <DocsSidebar />
            <main className={cn("relative py-6 lg:gap-8 lg:py-6", className)}>
                <div className="mx-auto mt-24 w-full min-w-0">
                    {children}
                </div>
            </main>
            {!isAskAIOpen && <DocsTOC />}
        </motion.div>
    );
}
