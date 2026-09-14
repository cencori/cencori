"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { SiteNav } from "@/components/nav/SiteNav";
import { useDocsContext } from "./DocsContext";
import { Search, Sparkles } from "lucide-react";
import { DocsSearchModal } from "@/components/docs/DocsSearchModal";
import { AskAISidebar } from "@/components/docs/AskAISidebar";
import { Button } from "@/components/ui/button";
import { DocsMobileNav } from "@/components/docs/DocsMobileNav";

interface UserProfile {
    name: string | null;
    avatar: string | null;
    email: string | null;
}

function DocsSearchTrigger({ onClick }: { onClick: () => void }) {
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            const isMac = navigator.platform.toUpperCase().includes("MAC");
            if ((isMac && e.metaKey && e.key.toLowerCase() === "k") || (!isMac && e.ctrlKey && e.key.toLowerCase() === "k")) {
                e.preventDefault();
                onClick();
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClick]);

    return (
        <button
            onClick={onClick}
            className="group relative hidden md:flex items-center gap-2 h-8 w-40 lg:w-56 px-3 text-xs rounded-lg bg-muted/50 border border-border/30 text-muted-foreground hover:bg-muted/70 hover:border-border/50 transition-colors"
        >
            <Search className="h-3.5 w-3.5" />
            <span>Search docs...</span>
            <kbd className="ml-auto hidden h-5 select-none items-center gap-0.5 rounded border border-border/40 bg-muted px-1 font-mono text-[10px] font-medium lg:flex">
                <span>⌘K</span>
            </kbd>
        </button>
    );
}

export function DocsNavbarWrapper() {
    const { isAskAIOpen, setAskAIOpen, setUserProfile: setContextUserProfile } = useDocsContext();
    const [searchOpen, setSearchOpen] = useState(false);

    // Expose toggle to window for other components (like TOC) to use
    useEffect(() => {
        (window as any).setAskAIOpen = setAskAIOpen;
        return () => {
            delete (window as any).setAskAIOpen;
        };
    }, [setAskAIOpen]);

    // Search and Ask AI slot
    const searchSlot = (
        <div className="flex items-center gap-2">
            <div className="hidden md:block">
                <DocsSearchTrigger onClick={() => setSearchOpen(true)} />
            </div>

            <Button
                variant="outline"
                size="sm"
                className="md:hidden h-8 px-3 text-xs font-medium rounded-lg border-border/50 hover:bg-muted/50"
                onClick={() => setAskAIOpen(true)}
            >
                Ask AI
            </Button>
            <Button
                variant="outline"
                size="sm"
                className="hidden md:flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg border-border/50 hover:bg-muted/50"
                onClick={() => setAskAIOpen(true)}
            >
                Ask AI
            </Button>
        </div>
    );

    return (
        <>
            <SiteNav solid />
            <DocsMobileNav onOpenSearch={() => setSearchOpen(true)} />
            <DocsSearchModal open={searchOpen} onOpenChange={setSearchOpen} />
        </>
    );
}
