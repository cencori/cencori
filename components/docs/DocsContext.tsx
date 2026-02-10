"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface UserProfile {
    name: string | null;
    avatar: string | null;
}

interface DocsContextType {
    isAskAIOpen: boolean;
    setAskAIOpen: (open: boolean) => void;
    attachedPage: { title: string; slug: string } | null;
    setAttachedPage: (page: { title: string; slug: string } | null) => void;
    userProfile: UserProfile | null;
    setUserProfile: (profile: UserProfile | null) => void;
}

const DocsContext = createContext<DocsContextType | undefined>(undefined);

export function DocsProvider({ children }: { children: ReactNode }) {
    const [isAskAIOpen, setAskAIOpen] = useState(false);
    const [attachedPage, setAttachedPage] = useState<{ title: string; slug: string } | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

    return (
        <DocsContext.Provider value={{ isAskAIOpen, setAskAIOpen, attachedPage, setAttachedPage, userProfile, setUserProfile }}>
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
