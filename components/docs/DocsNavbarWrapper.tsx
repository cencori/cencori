"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Navbar from "@/components/landing/Navbar";
import { useDocsContext } from "./DocsContext";
import { Logo } from "@/components/logo";
import { siteConfig } from "@/config/site";
import { Search, Sparkles } from "lucide-react";
import { DocsSearchModal } from "@/components/docs/DocsSearchModal";
import { AskAISidebar } from "@/components/docs/AskAISidebar";
import { Button } from "@/components/ui/button";

interface UserProfile {
    name: string | null;
    avatar: string | null;
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
    const { isAskAIOpen, setAskAIOpen } = useDocsContext();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [userProfile, setUserProfile] = useState<UserProfile>({ name: null, avatar: null });
    const [searchOpen, setSearchOpen] = useState(false);

    useEffect(() => {
        const checkUser = async () => {
            const { data } = await supabase.auth.getSession();
            if (data?.session) {
                setIsAuthenticated(true);
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const meta = user.user_metadata ?? {};
                    const avatar = meta.avatar_url ?? meta.picture ?? null;
                    const name = meta.name ?? user.email?.split("@")[0] ?? null;
                    setUserProfile({ name: name as string | null, avatar: avatar as string | null });
                }
            } else {
                setIsAuthenticated(false);
                setUserProfile({ name: null, avatar: null });
            }
        };
        checkUser();

        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                setIsAuthenticated(true);
                const { user } = session;
                if (user) {
                    const meta = user.user_metadata ?? {};
                    const avatar = meta.avatar_url ?? meta.picture ?? null;
                    const name = meta.name ?? user.email?.split("@")[0] ?? null;
                    setUserProfile({ name: name as string | null, avatar: avatar as string | null });
                }
            } else {
                setIsAuthenticated(false);
                setUserProfile({ name: null, avatar: null });
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    const unauthenticatedActions = [
        { text: "Sign in", href: siteConfig.links.signInUrl, isButton: false },
        {
            text: "Get Started",
            href: siteConfig.links.getStartedUrl,
            isButton: true,
            variant: "default",
        },
    ];

    const authenticatedActions = [
        {
            text: userProfile.name || "User",
            href: "#",
            isButton: false,
            isAvatar: true,
            avatarSrc: userProfile.avatar,
            avatarFallback: (userProfile.name || "U").slice(0, 2).toUpperCase(),
        },
    ];

    // Search and Ask AI slot
    const searchSlot = (
        <div className="flex items-center gap-2">
            <DocsSearchTrigger onClick={() => setSearchOpen(true)} />
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
            <Navbar
                logo={<Logo variant="mark" className="h-4" />}
                name="cencori"
                homeUrl="/"
                actions={isAuthenticated ? authenticatedActions : unauthenticatedActions}
                isAuthenticated={isAuthenticated}
                userProfile={isAuthenticated ? userProfile : undefined}
                searchSlot={searchSlot}
                containerClassName="container"
                className={isAskAIOpen ? "right-[380px] transition-[right] duration-300 ease-in-out" : "right-0 transition-[right] duration-300 ease-in-out"}
            />
            <DocsSearchModal open={searchOpen} onOpenChange={setSearchOpen} />
        </>
    );
}
