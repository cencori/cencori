"use client";

import { useDocsContext } from "./DocsContext";
import { motion } from "framer-motion";
import { ReactNode } from "react";

export function DocsContentWrapper({ children }: { children: ReactNode }) {
    const { isAskAIOpen } = useDocsContext();

    return (
        <motion.div
            layout
            animate={{ marginRight: isAskAIOpen ? 380 : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex flex-col min-h-screen bg-background relative z-10"
        >
            {children}
        </motion.div>
    );
}
