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
                "container mx-auto px-6 flex-1 items-start md:grid md:grid-cols-[220px_minmax(0,1fr)] gap-8 lg:gap-10",
                !isAskAIOpen && "lg:grid-cols-[220px_minmax(0,1fr)_220px] xl:grid-cols-[240px_minmax(0,1fr)_240px]",
                isAskAIOpen && "lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)]"
            )}>
            <DocsSidebar />
            <main className={cn("relative py-6 lg:gap-8 lg:py-6", className)}>
                <div className="mx-auto mt-10 w-full min-w-0">
                    {children}
                </div>
            </main>
            {!isAskAIOpen && <DocsTOC />}
        </motion.div>
    );
}
