"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface DocsContextType {
    isAskAIOpen: boolean;
    setAskAIOpen: (open: boolean) => void;
}

const DocsContext = createContext<DocsContextType | undefined>(undefined);

export function DocsProvider({ children }: { children: ReactNode }) {
    const [isAskAIOpen, setAskAIOpen] = useState(false);

    return (
        <DocsContext.Provider value={{ isAskAIOpen, setAskAIOpen }}>
            {children}
        </DocsContext.Provider>
    );
}

export function useDocsContext() {
    const context = useContext(DocsContext);
    if (!context) {
        throw new Error("useDocsContext must be used within a DocsProvider");
    }
    return context;
}
