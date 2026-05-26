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
            className="flex-1 flex flex-col md:flex-row"
        >
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
        </motion.div>
    );
}
